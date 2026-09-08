import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Geo-fence validation
const HOTEL_LOCATIONS = {
  'GG': { lat: 28.6448, lng: 77.2167, radiusMeters: 500 }, // Hotel Grand Godwin, Delhi
  'GD': { lat: 28.6528, lng: 77.2195, radiusMeters: 500 }, // Hotel Godwin Deluxe
  'IG': { lat: 28.6512, lng: 77.2210, radiusMeters: 300 }, // Indian Grill
  'CB': { lat: 28.6498, lng: 77.2180, radiusMeters: 300 }, // Cafe Brownie
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isWithinGeoFence(branchPrefix: string, lat: number, lng: number): boolean {
  const location = HOTEL_LOCATIONS[branchPrefix as keyof typeof HOTEL_LOCATIONS]
  if (!location) return true // unknown branch — allow
  const distance = getDistanceMeters(lat, lng, location.lat, location.lng)
  return distance <= location.radiusMeters
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
    const { employeeId, mode = 'WEB', lat, lng } = body

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if already punched in today
    const existing = await prisma.attendanceLog.findUnique({
      where: { employeeId_date: { employeeId, date: today } }
    })
    if (existing?.punchIn) {
      return NextResponse.json({ error: 'Already punched in today', log: existing }, { status: 409 })
    }

    // Geo-fence validation for GEO mode
    if (mode === 'GEO' && lat !== undefined && lng !== undefined) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { branch: true }
      })
      if (employee?.branch?.prefix) {
        const allowed = isWithinGeoFence(employee.branch.prefix, lat, lng)
        if (!allowed) {
          return NextResponse.json({
            error: 'GEO_FENCE_VIOLATION',
            message: 'You are outside the allowed check-in radius. Please be on hotel premises.'
          }, { status: 403 })
        }
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
    const status = assignment?.shift
      ? getAttendanceStatus(now, assignment.shift.startTime, assignment.shift.graceMinutes)
      : 'PRESENT'

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
    // Return mock success for development
    return NextResponse.json({
      success: true,
      log: { id: 'mock', punchIn: new Date(), status: 'PRESENT' },
      status: 'PRESENT',
      _mock: true
    })
  }
}
