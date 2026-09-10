import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance.json')
const LOCAL_ATTENDANCE_FILE = path.join(process.cwd(), 'data', 'hr_attendance.json')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees.json')
const AUDIT_FILE = path.join(DATA_DIR, 'audit_trail.json')
const LOCAL_AUDIT_FILE = path.join(process.cwd(), 'data', 'audit_trail.json')

// Hotel premises geo-coordinates for geofencing
const HOTEL_LOCATIONS = [
  { name: 'Hotel Grand Godwin', lat: 28.6448, lng: 77.2140, radiusMeters: 150 },
  { name: 'Hotel Godwin Deluxe', lat: 28.6445, lng: 77.2142, radiusMeters: 150 },
]

function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

function readJson<T>(file: string, fallbackFile: string = '', fallback: T = [] as unknown as T): T {
  const list = [file]
  if (fallbackFile && typeof fallbackFile === 'string') list.push(fallbackFile)
  for (const f of list) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf-8')
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as unknown as T
        if (!Array.isArray(parsed) && parsed) return parsed as unknown as T
      }
    } catch {}
  }
  return (typeof fallbackFile !== 'string' && fallbackFile ? fallbackFile : fallback) as T
}

function writeJson(file: string, data: any, localMirror: string = '') {
  try {
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
    if (localMirror && localMirror !== file) {
      const localDir = path.dirname(localMirror)
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true })
      }
      fs.writeFileSync(localMirror, JSON.stringify(data, null, 2))
    }
  } catch (err) {
    console.error('Error writing json to', file, err)
  }
}

function logAudit(entry: any) {
  try {
    const logs = readJson<any[]>(AUDIT_FILE, LOCAL_AUDIT_FILE, [])
    logs.unshift(entry)
    // Keep last 1000 audit records
    const trimmed = logs.slice(0, 1000)
    writeJson(AUDIT_FILE, trimmed, LOCAL_AUDIT_FILE)
  } catch (e) {
    console.warn('Audit trail log error:', e)
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId required' }, { status: 400 })
    }

    const employees = readJson<any[]>(EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, [])
    const emp = employees.find(e => e.id === employeeId || e.employeeId === employeeId)

    const allAttendance = readJson<any[]>(ATTENDANCE_FILE, LOCAL_ATTENDANCE_FILE, [])
    const record = allAttendance.find(a => 
      (a.employeeId === employeeId || (emp && (a.employeeId === emp.id || a.employeeId === emp.employeeId))) && 
      a.date === dateStr
    )

    return NextResponse.json({
      checkedIn: !!(record && record.punchIn),
      checkedOut: !!(record && record.punchOut),
      punchInTime: record?.punchIn || null,
      punchOutTime: record?.punchOut || null,
      totalMinutes: record?.totalMinutes || null,
      status: record ? record.status : 'ABSENT',
      punchInMode: record?.punchInMode || null,
      punchOutMode: record?.punchOutMode || null,
      record: record || null
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      employeeId,
      action,
      punchMode = 'KIOSK', // 'KIOSK' | 'MOBILE_GEOFENCE'
      lat,
      lng,
    } = body

    if (!employeeId || !action) {
      return NextResponse.json({ error: 'employeeId and action required' }, { status: 400 })
    }

    const employees = readJson<any[]>(EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, [])
    const emp = employees.find(e => e.id === employeeId || e.employeeId === employeeId)
    const normalizedEmpId = emp ? (emp.employeeId || emp.id) : employeeId
    const employeeName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : normalizedEmpId

    // Extract client IP and user agent
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = req.headers.get('user-agent') || ''

    let minDistance = 0
    let nearestHotel = 'Hotel Grand Godwin'

    // GEOFENCE VALIDATION for Mobile Punch
    if (punchMode === 'MOBILE_GEOFENCE') {
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return NextResponse.json(
          { error: 'GPS coordinates are mandatory for mobile punch-in. Please enable device location.' },
          { status: 400 }
        )
      }

      // Calculate distance to both properties
      const distances = HOTEL_LOCATIONS.map(loc => ({
        name: loc.name,
        distance: getHaversineDistanceMeters(lat, lng, loc.lat, loc.lng),
        radius: loc.radiusMeters,
      }))

      const closest = distances.reduce((prev, curr) => (curr.distance < prev.distance ? curr : prev))
      minDistance = closest.distance
      nearestHotel = closest.name

      // Check if within 150m boundary
      if (closest.distance > closest.radius) {
        // Log rejected attempt in audit
        logAudit({
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          employeeId: normalizedEmpId,
          employeeName,
          action,
          punchMode: 'MOBILE_GEOFENCE',
          status: 'REJECTED_GEOFENCE',
          lat,
          lng,
          distanceMeters: closest.distance,
          nearestHotel: closest.name,
          allowedRadius: closest.radius,
          ip: clientIp,
          userAgent,
          note: `Rejected: ${closest.distance}m away (limit: ${closest.radius}m)`
        })

        return NextResponse.json(
          {
            error: `Outside hotel boundary! You are currently ${closest.distance}m away from ${closest.name}. Mobile punch-in is strictly restricted within ${closest.radius}m of hotel premises.`,
            distanceMeters: closest.distance,
            allowedRadius: closest.radius,
            nearestHotel: closest.name
          },
          { status: 403 }
        )
      }
    }

    const allAttendance = readJson<any[]>(ATTENDANCE_FILE, LOCAL_ATTENDANCE_FILE, [])
    const dateStr = new Date().toISOString().split('T')[0]

    let existingIndex = allAttendance.findIndex(a => 
      (a.employeeId === employeeId || (emp && (a.employeeId === emp.id || a.employeeId === emp.employeeId))) && 
      a.date === dateStr
    )

    const now = new Date()
    const nowIso = now.toISOString()

    if (action === 'IN') {
      if (existingIndex !== -1 && allAttendance[existingIndex].punchIn) {
        return NextResponse.json({ error: 'Already punched in today' }, { status: 400 })
      }

      // AUTO-LATE FLAGGING against shift start + 15 mins grace period
      let attendanceStatus = 'PRESENT'
      const shiftStartTime = emp?.morningTime || '09:00'
      const [shiftH, shiftM] = shiftStartTime.split(':').map(Number)
      
      // Calculate shift start with 15 mins grace period in current date
      const scheduledArrival = new Date(now)
      scheduledArrival.setHours(shiftH || 9, (shiftM || 0) + 15, 0, 0)

      if (now.getTime() > scheduledArrival.getTime()) {
        attendanceStatus = 'LATE'
      }

      const newRecord = {
        id: `att-${Date.now()}`,
        employeeId: normalizedEmpId,
        date: dateStr,
        punchIn: nowIso,
        punchOut: null,
        status: attendanceStatus,
        punchInMode: punchMode,
        punchInCoordinates: punchMode === 'MOBILE_GEOFENCE' ? { lat, lng, distanceMeters: minDistance } : null,
        totalMinutes: null
      }

      allAttendance.push(newRecord)
      writeJson(ATTENDANCE_FILE, allAttendance, LOCAL_ATTENDANCE_FILE)

      // Record Audit Trail
      logAudit({
        id: `audit-${Date.now()}`,
        timestamp: nowIso,
        employeeId: normalizedEmpId,
        employeeName,
        action: 'IN',
        punchMode,
        status: attendanceStatus,
        shiftScheduled: shiftStartTime,
        lat: lat || null,
        lng: lng || null,
        distanceMeters: minDistance,
        nearestHotel,
        ip: clientIp,
        userAgent,
      })

      return NextResponse.json({
        success: true,
        record: newRecord,
        status: attendanceStatus,
        message: attendanceStatus === 'LATE' 
          ? `Punch-In Recorded (Marked Late - Past ${shiftStartTime} + 15m grace period)`
          : `Punch-In Recorded (On-Time / Present)`
      })

    } else if (action === 'OUT') {
      if (existingIndex === -1 || !allAttendance[existingIndex].punchIn) {
        return NextResponse.json({ error: 'No punch-in found for today' }, { status: 400 })
      }
      if (allAttendance[existingIndex].punchOut) {
        return NextResponse.json({ error: 'Already punched out today' }, { status: 400 })
      }

      const punchInTime = new Date(allAttendance[existingIndex].punchIn).getTime()
      const punchOutTime = now.getTime()
      const totalMinutes = Math.max(0, Math.floor((punchOutTime - punchInTime) / 60000))

      allAttendance[existingIndex].punchOut = nowIso
      allAttendance[existingIndex].punchOutMode = punchMode
      allAttendance[existingIndex].punchOutCoordinates = punchMode === 'MOBILE_GEOFENCE' ? { lat, lng, distanceMeters: minDistance } : null
      allAttendance[existingIndex].totalMinutes = totalMinutes

      writeJson(ATTENDANCE_FILE, allAttendance, LOCAL_ATTENDANCE_FILE)

      // Record Audit Trail
      logAudit({
        id: `audit-${Date.now()}`,
        timestamp: nowIso,
        employeeId: normalizedEmpId,
        employeeName,
        action: 'OUT',
        punchMode,
        status: allAttendance[existingIndex].status,
        totalMinutes,
        lat: lat || null,
        lng: lng || null,
        distanceMeters: minDistance,
        nearestHotel,
        ip: clientIp,
        userAgent,
      })

      return NextResponse.json({
        success: true,
        record: allAttendance[existingIndex],
        totalMinutes,
        message: `Punch-Out Recorded (${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m worked)`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('Kiosk punch API error:', err)
    return NextResponse.json({ error: err.message || 'Punch failed' }, { status: 500 })
  }
}
