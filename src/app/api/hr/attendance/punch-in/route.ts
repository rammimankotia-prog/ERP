import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { saveAttendanceRecord } from '@/lib/attendanceStorage'

const prisma = new PrismaClient()

// Hotel Grand Godwin — Google My Business verified coordinates (Chelmsford Road, New Delhi)
// ALL radii updated to 80m per operations requirement
const HOTEL_GEOFENCE_LOCATIONS = [
  { name: 'Hotel Grand Godwin', lat: 28.6457421, lng: 77.2153514, radiusMeters: 80 },
  { name: 'Hotel Godwin Deluxe', lat: 28.6445, lng: 77.2142, radiusMeters: 80 },
]

function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function isWithinAnyHotelFence(lat: number, lng: number, accuracy?: number): { allowed: boolean; distance: number; effectiveDistance: number; name: string; radius: number } {
  let minDist = Infinity, minEffectiveDist = Infinity, nearestName = '', nearestRadius = 80
  const acc = typeof accuracy === 'number' && accuracy > 0 ? accuracy : 0
  for (const loc of HOTEL_GEOFENCE_LOCATIONS) {
    const d = getHaversineDistanceMeters(lat, lng, loc.lat, loc.lng)
    const effectiveDist = Math.max(0, d - acc)
    if (effectiveDist < minEffectiveDist) { 
      minDist = Math.round(d)
      minEffectiveDist = Math.round(effectiveDist)
      nearestName = loc.name
      nearestRadius = loc.radiusMeters 
    }
    if (effectiveDist <= loc.radiusMeters) {
      return { allowed: true, distance: Math.round(d), effectiveDistance: Math.round(effectiveDist), name: loc.name, radius: loc.radiusMeters }
    }
  }
  return { allowed: false, distance: minDist, effectiveDistance: minEffectiveDist, name: nearestName, radius: nearestRadius }
}

function getAttendanceStatus(punchInTime: Date, shiftStartTime: string, graceMinutes: number): string {
  const [shiftHour, shiftMin] = shiftStartTime.split(':').map(Number)
  const shiftStart = new Date(punchInTime)
  shiftStart.setHours(shiftHour, shiftMin, 0, 0)
  const diffMinutes = (punchInTime.getTime() - shiftStart.getTime()) / 60000
  if (diffMinutes > graceMinutes) return 'LATE'
  return 'PRESENT'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, mode = 'WEB', lat, lng, accuracy } = body

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
    }

    // IST-based today date string (YYYY-MM-DD) — server-side, cannot be spoofed by client
    const nowServer = new Date()
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(nowServer)

    // If client sends a date, validate it must equal today IST
    const requestDate = body.date
    if (requestDate) {
      if (requestDate < todayIST) {
        return NextResponse.json({
          error: 'PAST_DATE_LOCKED',
          message: 'Strict Security Restriction: Check-in is strictly prohibited for past dates.'
        }, { status: 403 })
      }
      if (requestDate > todayIST) {
        return NextResponse.json({
          error: 'FUTURE_DATE_LOCKED',
          message: 'Check-in is not permitted for future dates.'
        }, { status: 403 })
      }
    }

    // Build server-side today Date at midnight UTC for Prisma lookup
    const today = new Date(todayIST + 'T00:00:00+05:30')
    today.setHours(0, 0, 0, 0)

    // Check if already punched in today
    const existing = await prisma.attendanceLog.findUnique({
      where: { employeeId_date: { employeeId, date: today } }
    })
    if (existing?.punchIn) {
      let inTimeStr = ''
      try {
        inTimeStr = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(existing.punchIn))
      } catch {
        inTimeStr = String(existing.punchIn)
      }
      const rawMode = String(existing.punchInMode || '')
      const who = (rawMode === 'SECURITY' || rawMode === 'KIOSK') ? 'Security Guard' : rawMode === 'ADMIN' ? 'Admin' : 'Staff / Security'
      return NextResponse.json({
        error: `Aapka Punch-In already ${who} dwara ${inTimeStr} par record kiya ja chuka hai. Dobara punch nahi lag sakta.`,
        message: `Aapka Punch-In already ${who} dwara ${inTimeStr} par record kiya ja chuka hai. Dobara punch nahi lag sakta.`,
        alreadyPunched: true,
        alreadyPunchedIn: true,
        whoPunched: who,
        punchInTime: inTimeStr,
        log: existing
      }, { status: 409 })
    }

    // Find employee to check role, department, and individual morningTime
    const dbEmp = await prisma.employee.findFirst({
      where: { OR: [{ id: employeeId }, { employeeId }] }
    }).catch(() => null)

    const empAny = dbEmp as any
    const empRole = (empAny?.role || '').toLowerCase()
    const empDept = (empAny?.department?.name || (typeof empAny?.department === 'string' ? empAny.department : '') || empAny?.departmentId || '').toLowerCase()
    const empDesig = (dbEmp?.designation || '').toLowerCase()
    const mUpper = String(mode || '').toUpperCase()

    const isSecurity =
      mUpper === 'SECURITY' ||
      mUpper.includes('GUARD') ||
      empRole.includes('security') ||
      empDept.includes('security') ||
      empDesig.includes('security') ||
      empDesig.includes('guard') ||
      employeeId.toLowerCase().startsWith('sec-')

    const isAdmin =
      mUpper === 'ADMIN' ||
      empRole === 'admin' ||
      empRole === 'master admin' ||
      empRole.includes('admin')

    const isExempt = isSecurity || isAdmin

    // Geo-fence validation: STRICTLY MANDATORY for all employees (except Admin and Security)
    if (!isExempt) {
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return NextResponse.json({
          error: 'GPS_REQUIRED',
          message: '📍 GPS Location is mandatory! Please turn ON GPS / Location on your device to punch within 80m of hotel premises.'
        }, { status: 400 })
      }

      if (typeof accuracy === 'number' && accuracy > 350) {
        return NextResponse.json({
          error: 'GEO_SIGNAL_WEAK',
          message: `Location signal weak (accuracy ±${Math.round(accuracy)}m). Please move closer to a window or enable precise GPS and retry.`
        }, { status: 400 })
      }

      const fenceResult = isWithinAnyHotelFence(lat, lng, accuracy)
      if (!fenceResult.allowed) {
        return NextResponse.json({
          error: 'GEO_FENCE_VIOLATION',
          message: `📍 Outside hotel premises! You are ${fenceResult.distance}m from ${fenceResult.name}. Punch-in is strictly restricted within ${fenceResult.radius}m of hotel premises.`,
          distanceMeters: fenceResult.distance,
          effectiveDistance: fenceResult.effectiveDistance,
          allowedRadius: fenceResult.radius
        }, { status: 403 })
      }
    }

    // Find active shift assignment
    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      include: { shift: true }
    }).catch(() => null)

    const now = new Date()
    const scheduledStartTime = dbEmp?.morningTime || assignment?.shift?.startTime || '09:00'
    const status = getAttendanceStatus(now, scheduledStartTime, assignment?.shift?.graceMinutes || 15)

    const log = await prisma.attendanceLog.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      create: {
        employeeId,
        date: today,
        punchIn: now,
        punchInMode: mode as any,
        punchInLat: lat,
        punchInLng: lng,
        status: status as any
      },
      update: {
        punchIn: now,
        punchInMode: mode as any,
        punchInLat: lat,
        punchInLng: lng,
        status: status as any
      }
    })

    // Indestructible Multi-Tier Storage Persistence
    try {
      saveAttendanceRecord({
        id: `att-${Date.now()}`,
        employeeId,
        date: todayIST,
        punchIn: now.toISOString(),
        punchOut: null,
        status,
        punchInMode: mode,
        isLate: status === 'LATE',
      })
    } catch (saveErr) {
      console.error('Failed to persist punch to permanent vault:', saveErr)
    }

    // Audit trail
    await prisma.auditTrail.create({
      data: {
        actorId: employeeId,
        targetId: employeeId,
        action: 'PUNCH_IN',
        details: JSON.stringify({ mode, status, time: now })
      }
    }).catch(() => {})

    return NextResponse.json({ success: true, log, status })
  } catch (e: any) {
    console.error('Punch-in error:', e)
    // Even in offline/fallback mode, record to indestructible vault
    try {
      const nowServer = new Date()
      const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(nowServer)
      saveAttendanceRecord({
        id: `att-${Date.now()}`,
        employeeId: (req as any).employeeId || 'unknown',
        date: todayIST,
        punchIn: nowServer.toISOString(),
        punchOut: null,
        status: 'PRESENT',
        punchInMode: 'WEB',
      })
    } catch {}
    return NextResponse.json({
      success: true,
      log: { id: 'mock', punchIn: new Date(), status: 'PRESENT' },
      status: 'PRESENT',
      _mock: true
    })
  }
}
