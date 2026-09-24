import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getMergedAttendance, saveAttendanceRecord } from '@/lib/attendanceStorage'
import { getMergedShifts, getEmployeeRosterShift } from '@/lib/shiftStorage'
import { getAllEmployees } from '@/lib/employeeData'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance.json')
const LOCAL_ATTENDANCE_FILE = path.join(process.cwd(), 'data', 'hr_attendance.json')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees.json')
const AUDIT_FILE = path.join(DATA_DIR, 'audit_trail.json')
const LOCAL_AUDIT_FILE = path.join(process.cwd(), 'data', 'audit_trail.json')
const CONFIG_FILE = path.join(DATA_DIR, 'global_config.json')
const LOCAL_CONFIG_FILE = path.join(process.cwd(), 'data', 'global_config.json')
const SHIFTS_FILE = path.join(DATA_DIR, 'hr_shifts.json')
const LOCAL_SHIFTS_FILE = path.join(process.cwd(), 'data', 'hr_shifts.json')

// Hotel premises geo-coordinates for geofencing
// PRIMARY: Hotel Grand Godwin — Google My Business verified pin: 28.64574210, 77.21535140
// SECONDARY: Hotel Godwin Deluxe — 28.6445, 77.2142
const HOTEL_LAT = 28.64574210;
const HOTEL_LNG = 77.21535140;
const ALLOWED_RADIUS_METERS = 80;

function getGeofenceConfig() {
  const config = readJson<any>(CONFIG_FILE, LOCAL_CONFIG_FILE, {})
  const radius = typeof config?.geofence?.radius === 'number' ? config.geofence.radius : ALLOWED_RADIUS_METERS
  const enabled = config?.geofence?.enabled !== undefined ? config.geofence.enabled : true

  // Use config override if present, else fall back to verified GMB pin
  const primaryLat = config?.geofence?.lat ? Number(config.geofence.lat) : HOTEL_LAT
  const primaryLng = config?.geofence?.lng ? Number(config.geofence.lng) : HOTEL_LNG

  const locations = [
    // PRIMARY — Hotel Grand Godwin (Google My Business verified pin)
    { name: 'Hotel Grand Godwin', lat: primaryLat, lng: primaryLng, radiusMeters: radius },
    // SECONDARY — Hotel Godwin Deluxe (same campus group)
    { name: 'Hotel Godwin Deluxe', lat: 28.6445, lng: 77.2142, radiusMeters: radius },
  ]

  return { enabled, radius, locations }
}

function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function parseTimeToISTMinutes(timeOrIso: string | null | undefined): number {
  if (!timeOrIso) return 0
  const trimmed = timeOrIso.trim()

  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const isPm = ampmMatch[3].toLowerCase() === 'pm'
    if (isPm && h < 12) h += 12
    if (!isPm && h === 12) h = 0
    return h * 60 + m
  }

  const time24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (time24Match) {
    const h = parseInt(time24Match[1], 10)
    const m = parseInt(time24Match[2], 10)
    return h * 60 + m
  }

  try {
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      const istStr = d.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
      const [hStr, mStr] = istStr.split(':')
      const h = parseInt(hStr, 10) || 0
      const m = parseInt(mStr, 10) || 0
      return h * 60 + m
    }
  } catch {}

  return 0
}

function formatDurationHoursMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function readJson<T>(file: string, fallbackFile: string = '', fallback: T = [] as unknown as T): T {
  const list = [file]
  if (fallbackFile && typeof fallbackFile === 'string') list.push(fallbackFile)
  for (const f of list) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed !== undefined && parsed !== null) return parsed as unknown as T
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

/**
 * getRosterShiftTimes:
 * Reads the employee's monthly roster for today's date and returns the
 * actual shift startTime + endTime from hr_shifts.json (e.g. 20:00 to 08:00 / 8 PM to 8 AM for Night Shift).
 * Falls back to employee's default morningTime/eveningTime if roster not found.
 */
function getRosterShiftTimes(emp: any, dateStr: string): {
  startTime: string
  endTime: string
  shiftName: string
  shiftDisplay: string
  isNightShift: boolean
  isOff: boolean
} {
  const res = getEmployeeRosterShift(emp, dateStr)
  return {
    startTime: res.startTime,
    endTime: res.endTime,
    shiftName: res.shiftName,
    shiftDisplay: res.formatted12H,
    isNightShift: res.isNightShift,
    isOff: res.isOff,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
    const dateStr = searchParams.get('date') || todayIST

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId required' }, { status: 400 })
    }

    const employees = await getAllEmployees()
    const targetEmpId = employeeId.trim().toUpperCase()
    const emp = employees.find(e => 
      (e.id && e.id.trim().toUpperCase() === targetEmpId) || 
      (e.employeeId && e.employeeId.trim().toUpperCase() === targetEmpId)
    )

    const allAttendance = getMergedAttendance()
    const empIdUpper = emp?.id?.trim().toUpperCase()
    const empCodeUpper = emp?.employeeId?.trim().toUpperCase()

    const record = allAttendance.find(a => {
      const aEmp = (a.employeeId || '').trim().toUpperCase()
      const empMatch = aEmp === targetEmpId || (empIdUpper && aEmp === empIdUpper) || (empCodeUpper && aEmp === empCodeUpper)
      if (!empMatch) return false

      if (a.date === dateStr) return true
      if (a.punchIn) {
        if (a.punchIn.slice(0, 10) === dateStr) return true
        try {
          const inDateIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(a.punchIn))
          if (inDateIST === dateStr) return true
        } catch {}
      }
      return false
    })

    const checkedIn = !!(record && record.punchIn)
    const checkedOut = !!(record && record.punchOut)
    const isLate = checkedIn && !!(record?.isLate || record?.status === 'LATE')
    const lateMinutes = isLate ? (record?.lateMinutes || 0) : 0
    const effectiveStatus = !checkedIn ? 'ABSENT' : (record?.status || 'PRESENT')

    // Dynamic shift info for dateStr
    const rosterShift = getRosterShiftTimes(emp, dateStr)

    return NextResponse.json({
      checkedIn,
      checkedOut,
      punchInTime: checkedIn ? record?.punchIn : null,
      punchOutTime: checkedOut ? record?.punchOut : null,
      totalMinutes: checkedOut ? record?.totalMinutes : null,
      status: effectiveStatus,
      isLate,
      lateMinutes,
      punchInMode: checkedIn ? record?.punchInMode : null,
      punchOutMode: checkedOut ? record?.punchOutMode : null,
      record: checkedIn ? record : null,
      shiftStartTime: rosterShift.startTime,
      shiftEndTime: rosterShift.endTime,
      shiftName: rosterShift.shiftName,
      shiftDisplay: rosterShift.shiftDisplay,
      isNightShift: rosterShift.isNightShift,
      isOff: rosterShift.isOff,
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
      punchedBy, // 'SECURITY' | employee ID (e.g. 'GG-1003') | 'ADMIN'
      lat,
      lng,
      accuracy,
    } = body

    if (!employeeId || !action) {
      return NextResponse.json({ error: 'employeeId and action required' }, { status: 400 })
    }

    const employees = await getAllEmployees()
    const emp = employees.find(e => 
      (e.id && e.id.trim().toUpperCase() === employeeId.trim().toUpperCase()) || 
      (e.employeeId && e.employeeId.trim().toUpperCase() === employeeId.trim().toUpperCase())
    )
    const normalizedEmpId = emp ? (emp.employeeId || emp.id) : employeeId
    const employeeName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (body.employeeName || normalizedEmpId)

    // Active mode: If punched by employee -> employeeId, if security guard -> 'SECURITY', if admin -> 'ADMIN'
    let effectiveMode = 'SECURITY'
    if (punchedBy) {
      const pUpper = String(punchedBy).trim().toUpperCase()
      if (pUpper === 'SECURITY' || pUpper.includes('GUARD') || pUpper.includes('SEC')) {
        effectiveMode = 'SECURITY'
      } else if (pUpper === 'ADMIN' || pUpper === 'MANAGER' || pUpper === 'HR') {
        effectiveMode = 'ADMIN'
      } else {
        effectiveMode = punchedBy.trim()
      }
    } else if (punchMode === 'MOBILE_GEOFENCE') {
      effectiveMode = normalizedEmpId
    } else if (punchMode === 'KIOSK') {
      effectiveMode = 'SECURITY'
    } else {
      effectiveMode = punchMode || 'SECURITY'
    }
    // Check if employee has been deactivated
    if (emp && emp.status && emp.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your account has been deactivated. You have been logged out from all platforms.', deactivated: true },
        { status: 403 }
      )
    }

    // Check revoked sessions
    const REVOKED_FILE = path.join(DATA_DIR, 'revoked_sessions.json')
    const LOCAL_REVOKED_FILE = path.join(process.cwd(), 'data', 'revoked_sessions.json')
    const revoked = readJson<any[]>(REVOKED_FILE, LOCAL_REVOKED_FILE, [])
    const isRevoked = revoked.some((r: any) => 
      r.userId === employeeId || r.employeeId === employeeId || (emp && (r.employeeId === emp.id || r.employeeId === emp.employeeId))
    )
    if (isRevoked) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. You have been logged out from all platforms.', deactivated: true },
        { status: 403 }
      )
    }

    // Extract client IP and user agent
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = req.headers.get('user-agent') || ''

    let minDistance = 0
    let nearestHotel = 'Hotel Grand Godwin'

    // GEOFENCE VALIDATION: Mandatory for ALL employees, ONLY Admin and Security Guard are exempt
    const { enabled: geofenceEnabled, locations: hotelLocations, radius: defaultRadius } = getGeofenceConfig()

    const isSecurityGuard =
      effectiveMode === 'SECURITY' ||
      emp?.role?.toLowerCase().includes('security') ||
      emp?.assignedRole?.toLowerCase().includes('security') ||
      emp?.designation?.toLowerCase().includes('guard') ||
      emp?.designation?.toLowerCase().includes('security') ||
      (typeof emp?.department === 'string' && emp?.department?.toLowerCase().includes('security')) ||
      emp?.department?.name?.toLowerCase().includes('security') ||
      emp?.departmentId === 'dept-4' ||
      emp?.departmentId === 'dept-11' ||
      emp?.dept?.toLowerCase().includes('security')

    const isAdmin =
      effectiveMode === 'ADMIN' ||
      emp?.role?.toLowerCase().includes('admin') ||
      emp?.assignedRole?.toLowerCase().includes('admin')

    const isExempt = isSecurityGuard || isAdmin

    if (geofenceEnabled && !isExempt) {
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return NextResponse.json(
            { error: `📍 GPS Location is OFF or disabled! Please turn ON GPS / Location on your device to punch within ${defaultRadius || 80}m of hotel premises.` },
            { status: 400 }
          )
        }

        // GPS signal weak (>350m accuracy)
        if (typeof accuracy === 'number' && accuracy > 350) {
          return NextResponse.json(
            { error: `Location signal weak (accuracy ±${Math.round(accuracy)}m). Please move closer to a window or enable precise GPS and retry.` },
            { status: 400 }
          )
        }

        // Calculate distance to properties with GPS accuracy buffer
        const distances = hotelLocations.map(loc => {
          const rawDist = getHaversineDistanceMeters(lat, lng, loc.lat, loc.lng)
          const effectiveDist = typeof accuracy === 'number' && accuracy > 0
            ? Math.max(0, rawDist - accuracy)
            : rawDist
          return {
            name: loc.name,
            distance: Math.round(rawDist),
            effectiveDistance: Math.round(effectiveDist),
            radius: loc.radiusMeters || defaultRadius || 80,
          }
        })

        const withinPremises = distances.find(d => d.effectiveDistance <= d.radius)
        const closest = distances.reduce((prev, curr) => (curr.effectiveDistance < prev.effectiveDistance ? curr : prev))
        const matched = withinPremises || closest

        minDistance = matched.distance
        nearestHotel = matched.name

        // Check if within boundary
        if (!withinPremises) {
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
            accuracy,
            distanceMeters: closest.distance,
            effectiveDistance: closest.effectiveDistance,
            nearestHotel: closest.name,
            allowedRadius: closest.radius,
            ip: clientIp,
            userAgent,
            note: `Rejected: ${closest.distance}m away (effective ${closest.effectiveDistance}m, ±${accuracy ? Math.round(accuracy) : 0}m, ${closest.radius}m premises limit)`
          })

          return NextResponse.json(
            {
              error: `📍 Outside hotel premises! You are currently ${closest.distance}m away from ${closest.name}. Punch-in is strictly restricted within ${closest.radius}m in premises. Please ensure you are physically inside the hotel premises.`,
              distanceMeters: closest.distance,
              effectiveDistance: closest.effectiveDistance,
              accuracy: typeof accuracy === 'number' ? Math.round(accuracy) : undefined,
              allowedRadius: closest.radius,
              nearestHotel: closest.name
            },
            { status: 403 }
          )
        }
      }

    const now = new Date()
    const nowIso = now.toISOString()
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)

    // Strict Restriction: Check-in, punch-in, and punch-out are only allowed for TODAY
    const targetDate = body.date || todayIST
    if (targetDate < todayIST) {
      return NextResponse.json(
        { error: 'Strict Security Restriction: Check-in, punch-in, and punch-out are strictly prohibited for past dates.' },
        { status: 403 }
      )
    }
    if (targetDate > todayIST) {
      return NextResponse.json(
        { error: 'Strict Security Restriction: Check-in, punch-in, and punch-out are not permitted for future dates.' },
        { status: 403 }
      )
    }

    const dateStr = todayIST

    const allAttendance = getMergedAttendance()

    let existingIndex = allAttendance.findIndex(a => {
      const aEmp = (a.employeeId || '').trim().toUpperCase()
      const normEmp = normalizedEmpId.trim().toUpperCase()
      const empIdMatch = aEmp === normEmp || (emp && (aEmp === emp.id?.trim().toUpperCase() || aEmp === emp.employeeId?.trim().toUpperCase()))
      if (!empIdMatch) return false

      if (a.date === dateStr) return true
      if (a.punchIn) {
        if (a.punchIn.slice(0, 10) === dateStr) return true
        try {
          const inDateIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(a.punchIn))
          if (inDateIST === dateStr) return true
        } catch {}
      }
      return false
    })

    if (action === 'IN') {
      if (existingIndex !== -1 && allAttendance[existingIndex].punchIn) {
        const existRec = allAttendance[existingIndex]
        let formattedInTime = ''
        try {
          if (existRec.punchIn) {
            formattedInTime = new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }).format(new Date(String(existRec.punchIn)))
          }
        } catch {
          formattedInTime = existRec.punchIn || ''
        }

        const rawInMode = (existRec.punchInMode || '').trim()
        const whoIn = (rawInMode === 'SECURITY' || rawInMode === 'KIOSK')
          ? 'Security Guard'
          : rawInMode === 'ADMIN'
          ? 'Admin'
          : (rawInMode && rawInMode !== 'WEB' && rawInMode !== 'MOBILE_GEOFENCE' && rawInMode !== 'MANUAL')
          ? `Employee (${rawInMode})`
          : 'Staff'

        if (existRec.punchOut) {
          let formattedOutTime = ''
          try {
            formattedOutTime = new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }).format(new Date(String(existRec.punchOut)))
          } catch {
            formattedOutTime = existRec.punchOut || ''
          }
          const rawOutMode = (existRec.punchOutMode || '').trim()
          const whoOut = (rawOutMode === 'SECURITY' || rawOutMode === 'KIOSK')
            ? 'Security Guard'
            : rawOutMode === 'ADMIN'
            ? 'Admin'
            : 'Staff'

          return NextResponse.json({
            error: `Aapka aaj ka Punch-In (${whoIn} dwara ${formattedInTime}) aur Check-Out (${whoOut} dwara ${formattedOutTime}) dono already complete ho chuka hai. Dobara punch nahi lag sakta.`,
            alreadyPunched: true,
            alreadyPunchedIn: true,
            alreadyPunchedOut: true,
            whoPunched: whoIn,
            punchInTime: formattedInTime,
            punchOutTime: formattedOutTime,
            record: existRec
          }, { status: 400 })
        }

        return NextResponse.json({
          error: `Aapka Punch-In already ${whoIn} dwara ${formattedInTime} par record kiya ja chuka hai. Dobara punch nahi lag sakta.`,
          alreadyPunched: true,
          alreadyPunchedIn: true,
          whoPunched: whoIn,
          punchInTime: formattedInTime,
          record: existRec
        }, { status: 400 })
      }

      // AUTO-LATE FLAGGING: Use roster-assigned shift for today (falls back to default shift time)
      const rosterShift = getRosterShiftTimes(emp, dateStr)
      const shiftStartTime = rosterShift.startTime
      const activeShiftName = rosterShift.shiftName
      const punchInMinutes = parseTimeToISTMinutes(nowIso)
      const scheduledInMinutes = parseTimeToISTMinutes(shiftStartTime)
      const graceMinutes = activeShiftName === 'Night Shift' ? 20 : 15
      const lateMinutes = Math.max(0, punchInMinutes - scheduledInMinutes)
      const isLate = lateMinutes > graceMinutes
      const attendanceStatus = isLate ? 'LATE' : 'PRESENT'

      const formattedLate = formatDurationHoursMinutes(lateMinutes)
      const lateNoticeHindi = isLate
        ? `Aaj aap apne scheduled time (${shiftStartTime}) se ${formattedLate} late hain.`
        : null

      const newRecord = {
        id: `att-${Date.now()}`,
        employeeId: normalizedEmpId,
        date: dateStr,
        punchIn: nowIso,
        punchOut: null,
        status: attendanceStatus,
        isLate,
        lateMinutes: isLate ? lateMinutes : 0,
        punchInMode: effectiveMode,
        punchInCoordinates: punchMode === 'MOBILE_GEOFENCE' ? { lat, lng, distanceMeters: minDistance } : null,
        totalMinutes: null,
        shiftName: activeShiftName,
        scheduledTime: shiftStartTime,
        remarks: isLate ? `Late arrival by ${formattedLate} (+${lateMinutes}m) [${activeShiftName}]` : `Present [${activeShiftName}]`
      }

      saveAttendanceRecord(newRecord)

      // Record Audit Trail
      logAudit({
        id: `audit-${Date.now()}`,
        timestamp: nowIso,
        employeeId: normalizedEmpId,
        employeeName,
        action: 'IN',
        punchMode: effectiveMode,
        status: attendanceStatus,
        shiftScheduled: shiftStartTime,
        shiftName: activeShiftName,
        lateMinutes: isLate ? lateMinutes : 0,
        lat: lat || null,
        lng: lng || null,
        distanceMeters: minDistance,
        nearestHotel,
        ip: clientIp,
        userAgent,
        note: isLate ? `Marked LATE: Arrived at +${lateMinutes}m (${activeShiftName}: ${shiftStartTime} + ${graceMinutes}m grace)` : undefined
      })

      return NextResponse.json({
        success: true,
        record: newRecord,
        status: attendanceStatus,
        isLate,
        lateMinutes: isLate ? lateMinutes : 0,
        scheduledTime: shiftStartTime,
        shiftName: activeShiftName,
        lateNotice: lateNoticeHindi,
        message: attendanceStatus === 'LATE' 
          ? `Punch-In Recorded (Marked Late: Aaj aap apne scheduled time ${shiftStartTime} se ${formattedLate} late hain) [${activeShiftName}]`
          : `Punch-In Recorded (On-Time / Present) [${activeShiftName}]`
      })

    } else if (action === 'OUT') {
      if (existingIndex === -1 || !allAttendance[existingIndex].punchIn) {
        return NextResponse.json({ error: 'No punch-in found for today. Pehle Punch-In hona zaroori hai.' }, { status: 400 })
      }
      if (allAttendance[existingIndex].punchOut) {
        const existRec = allAttendance[existingIndex]
        let formattedOutTime = ''
        try {
          if (existRec.punchOut) {
            formattedOutTime = new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }).format(new Date(String(existRec.punchOut)))
          }
        } catch {
          formattedOutTime = existRec.punchOut || ''
        }

        const rawOutMode = (existRec.punchOutMode || '').trim()
        const whoOut = (rawOutMode === 'SECURITY' || rawOutMode === 'KIOSK')
          ? 'Security Guard'
          : rawOutMode === 'ADMIN'
          ? 'Admin'
          : (rawOutMode && rawOutMode !== 'WEB' && rawOutMode !== 'MOBILE_GEOFENCE' && rawOutMode !== 'MANUAL')
          ? `Employee (${rawOutMode})`
          : 'Staff'

        return NextResponse.json({
          error: `Aapka Check-Out already ${whoOut} dwara ${formattedOutTime} par record kiya ja chuka hai. Dobara check-out nahi kiya ja sakta.`,
          alreadyPunched: true,
          alreadyPunchedOut: true,
          whoPunched: whoOut,
          punchOutTime: formattedOutTime,
          record: existRec
        }, { status: 400 })
      }

      const punchInTime = new Date(allAttendance[existingIndex].punchIn).getTime()
      const punchOutTime = now.getTime()
      const totalMinutes = Math.max(0, Math.floor((punchOutTime - punchInTime) / 60000))

      // Compute early departure against employee's active shift time
      const rosterShiftOut = getRosterShiftTimes(emp, dateStr)
      const shiftEndTime = rosterShiftOut.endTime || (emp?.eveningTime && String(emp.eveningTime).trim()) || '18:00'
      const shiftStartTimeOut = rosterShiftOut.startTime || (emp?.morningTime && String(emp.morningTime).trim()) || '09:00'
      const activeShiftNameOut = rosterShiftOut.shiftName
      const shiftOutMinutes = parseTimeToISTMinutes(shiftEndTime)
      const shiftInMinutes = parseTimeToISTMinutes(shiftStartTimeOut)
      const punchOutMinutes = parseTimeToISTMinutes(nowIso)

      let earlyOutMinutes = 0
      if (shiftOutMinutes < shiftInMinutes) {
        // Cross-midnight shift (e.g. 20:00 to 08:00)
        const effShiftOut = shiftOutMinutes + 1440
        const effPunchOut = punchOutMinutes < shiftInMinutes ? punchOutMinutes + 1440 : punchOutMinutes
        earlyOutMinutes = Math.max(0, effShiftOut - effPunchOut)
      } else {
        earlyOutMinutes = Math.max(0, shiftOutMinutes - punchOutMinutes)
      }
      const isEarlyOut = earlyOutMinutes > 15

      // Half-Day Policy: If total hours worked is <= 5 hours (300 mins), mark as HALF_DAY
      const wasLate = allAttendance[existingIndex].status === 'LATE' || allAttendance[existingIndex].isLate === true
      let finalStatus = allAttendance[existingIndex].status || 'PRESENT'
      if (totalMinutes <= 300) {
        finalStatus = 'HALF_DAY'
      } else if (wasLate && isEarlyOut) {
        finalStatus = 'LATE_AND_EARLY'
      } else if (wasLate) {
        finalStatus = 'LATE'
      } else if (isEarlyOut) {
        finalStatus = 'EARLY_OUT'
      }

      allAttendance[existingIndex].status = finalStatus
      allAttendance[existingIndex].punchOut = nowIso
      allAttendance[existingIndex].punchOutMode = effectiveMode
      allAttendance[existingIndex].punchOutCoordinates = punchMode === 'MOBILE_GEOFENCE' ? { lat, lng, distanceMeters: minDistance } : null
      allAttendance[existingIndex].totalMinutes = totalMinutes
      allAttendance[existingIndex].isEarlyOut = isEarlyOut
      allAttendance[existingIndex].earlyOutMinutes = isEarlyOut ? earlyOutMinutes : 0
      allAttendance[existingIndex].scheduledOutTime = shiftEndTime
      if (!allAttendance[existingIndex].shiftName) {
        allAttendance[existingIndex].shiftName = activeShiftNameOut
      }

      saveAttendanceRecord(allAttendance[existingIndex])

      // Record Audit Trail
      logAudit({
        id: `audit-${Date.now()}`,
        timestamp: nowIso,
        employeeId: normalizedEmpId,
        employeeName,
        action: 'OUT',
        punchMode: effectiveMode,
        status: finalStatus,
        totalMinutes,
        shiftScheduledOut: shiftEndTime,
        shiftName: activeShiftNameOut,
        earlyOutMinutes: isEarlyOut ? earlyOutMinutes : 0,
        lat: lat || null,
        lng: lng || null,
        distanceMeters: minDistance,
        nearestHotel,
        ip: clientIp,
        userAgent,
        note: totalMinutes <= 300
          ? `Marked HALF_DAY: ${totalMinutes}m worked (<= 5 hours) [${activeShiftNameOut}]`
          : isEarlyOut
            ? `Early Out: departed -${earlyOutMinutes}m before scheduled departure [${activeShiftNameOut}: ${shiftEndTime}]`
            : undefined
      })

      const hoursWorked = Math.floor(totalMinutes / 60)
      const minsWorked = totalMinutes % 60
      const earlyDurationText = isEarlyOut ? formatDurationHoursMinutes(earlyOutMinutes) : ''
      const earlyNoticeHindi = isEarlyOut
        ? `Aaj aap apne scheduled departure time (${shiftEndTime}) se ${earlyDurationText} pehle checkout kar rahe hain.`
        : null

      return NextResponse.json({
        success: true,
        record: allAttendance[existingIndex],
        totalMinutes,
        status: finalStatus,
        isHalfDay: totalMinutes <= 300,
        isEarlyOut,
        earlyOutMinutes: isEarlyOut ? earlyOutMinutes : 0,
        scheduledOutTime: shiftEndTime,
        earlyNotice: earlyNoticeHindi,
        message: isEarlyOut
          ? `Punch-Out Recorded: Aaj aap apne scheduled departure time (${shiftEndTime}) se ${earlyDurationText} pehle checkout kar rahe hain.`
          : `Punch-Out Recorded (${hoursWorked}h ${minsWorked}m worked)`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('Kiosk punch API error:', err)
    return NextResponse.json({ error: err.message || 'Punch failed' }, { status: 500 })
  }
}
