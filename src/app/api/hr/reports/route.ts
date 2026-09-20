import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getMergedAttendance } from '@/lib/attendanceStorage'
import { getAllEmployees } from '@/lib/employeeData'

export const dynamic = 'force-dynamic'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

const ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance.json')
const LOCAL_ATTENDANCE_FILE = path.join(LOCAL_DATA_DIR, 'hr_attendance.json')
const LEAVES_FILE = path.join(DATA_DIR, 'hr_leaves.json')
const LOCAL_LEAVES_FILE = path.join(LOCAL_DATA_DIR, 'hr_leaves.json')


export type ReportRecord = {
  id: string
  date: string
  dayOfWeek: string
  isWeekend: boolean
  employeeId: string
  empCode: string
  employeeName: string
  designation: string
  branchName: string
  departmentName: string
  scheduledIn: string
  scheduledOut: string
  punchIn: string | null
  punchOut: string | null
  lateMinutes: number
  isLate: boolean
  earlyOutMinutes: number
  isEarlyOut: boolean
  totalMinutes: number
  overtimeMinutes: number
  status: 'PRESENT' | 'LATE' | 'EARLY_OUT' | 'LATE_AND_EARLY' | 'HALF_DAY' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'ABSENT' | 'WEEKLY_OFF'
  leaveType?: string
  remarks?: string
}

export function parseTimeToISTMinutes(timeOrIso: string | null | undefined): number {
  if (!timeOrIso) return 0
  const trimmed = timeOrIso.trim()

  // 1. "12:30 pm", "09:00 am", "9:15 AM"
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const isPm = ampmMatch[3].toLowerCase() === 'pm'
    if (isPm && h < 12) h += 12
    if (!isPm && h === 12) h = 0
    return h * 60 + m
  }

  // 2. "09:00", "18:30" (24-hour simple format)
  const time24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (time24Match) {
    const h = parseInt(time24Match[1], 10)
    const m = parseInt(time24Match[2], 10)
    return h * 60 + m
  }

  // 3. ISO timestamp or date string (e.g. "2026-09-15T07:00:00.000Z") converted to Asia/Kolkata (IST UTC+5:30)
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

export function formatDurationHoursMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function parseTimeToMinutes(t: string): number {
  return parseTimeToISTMinutes(t)
}

function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const employeeIdFilter = searchParams.get('employeeId')
  const branchFilter = searchParams.get('branchId')
  const deptFilter = searchParams.get('departmentId')

  const today = new Date()
  const todayStr = formatYMD(today)
  const defaultTo = todayStr
  const defaultFromDate = new Date()
  defaultFromDate.setDate(1) // 1st of current month
  const defaultFrom = formatYMD(defaultFromDate)

  const fromStr = fromParam || defaultFrom
  const toStr = toParam || defaultTo

  const fromDate = new Date(fromStr + 'T00:00:00')
  const toDate = new Date(toStr + 'T23:59:59')

  // Load real records — uses Prisma DB first, JSON fallback
  const rawEmployees = await getAllEmployees()
  const allAttendance = getMergedAttendance()
  const { getMergedLeaves } = await import('@/lib/leaveStorage')
  const allLeaves = getMergedLeaves()

  // Filter employees
  let employees = rawEmployees.filter(e => e.status === 'ACTIVE' || !e.status)
  if (employeeIdFilter && employeeIdFilter !== 'ALL') {
    employees = employees.filter(e => e.id === employeeIdFilter || e.employeeId === employeeIdFilter)
  }
  if (branchFilter && branchFilter !== 'ALL') {
    employees = employees.filter(e => e.branchId === branchFilter || e.branch?.id === branchFilter || e.branch?.name === branchFilter)
  }
  if (deptFilter && deptFilter !== 'ALL') {
    employees = employees.filter(e => e.departmentId === deptFilter || e.department?.id === deptFilter || e.department?.name === deptFilter)
  }

  // Generate date list between fromDate and toDate
  const dateList: string[] = []
  const cur = new Date(fromDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(toDate)
  end.setHours(0, 0, 0, 0)

  while (cur <= end) {
    dateList.push(formatYMD(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const daysOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const allRecords: ReportRecord[] = []

  employees.forEach(emp => {
    const shiftIn = emp.morningTime || '09:00'
    const shiftOut = emp.eveningTime || '18:00'
    const shiftInMins = parseTimeToMinutes(shiftIn)
    const shiftOutMins = parseTimeToMinutes(shiftOut)
    const scheduledTotalMins = shiftOutMins > shiftInMins ? shiftOutMins - shiftInMins : (1440 - shiftInMins) + shiftOutMins

    dateList.forEach(dateStr => {
      const d = new Date(dateStr + 'T12:00:00')
      const dayIndex = d.getDay() // 0=Sun, 6=Sat
      const dayName = daysOfWeekNames[dayIndex]
      const isSunday = dayIndex === 0
      const isSaturday = dayIndex === 6
      const empOffDays = Array.isArray(emp.offDays) && emp.offDays.length > 0
        ? emp.offDays
        : ['Sunday']
      const isOffDay = empOffDays.some((od: string) => od.toLowerCase() === dayName.toLowerCase())
      const isWeekend = isSunday || isSaturday || isOffDay

      // Check real approved leave
      const approvedLeave = allLeaves.find(l =>
        l.status === 'APPROVED' &&
        (l.employeeId === emp.id || l.employeeCode === emp.employeeId || l.employeeId === emp.employeeId) &&
        dateStr >= (l.fromDate ? l.fromDate.slice(0, 10) : '') &&
        dateStr <= (l.toDate ? l.toDate.slice(0, 10) : '')
      )

      // Check real punch attendance
      const attendanceRecord = allAttendance.find(a =>
        (a.employeeId === emp.id || a.employeeId === emp.employeeId) &&
        (a.date === dateStr || (a.punchIn && a.punchIn.slice(0, 10) === dateStr))
      )

      let record: ReportRecord

      if (approvedLeave) {
        const isUnpaid = approvedLeave.category === 'UNPAID' || approvedLeave.leaveType?.category === 'UNPAID'
        record = {
          id: `rec-${emp.employeeId || emp.id}-${dateStr}`,
          date: dateStr,
          dayOfWeek: dayName,
          isWeekend,
          employeeId: emp.id,
          empCode: emp.employeeId || emp.id,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Staff',
          designation: emp.designation || 'Staff',
          branchName: emp.branch?.name || emp.branch || 'Hotel Grand Godwin',
          departmentName: emp.department?.name || emp.department || 'Operations',
          scheduledIn: shiftIn,
          scheduledOut: shiftOut,
          punchIn: null,
          punchOut: null,
          lateMinutes: 0,
          isLate: false,
          earlyOutMinutes: 0,
          isEarlyOut: false,
          totalMinutes: 0,
          overtimeMinutes: 0,
          status: isUnpaid ? 'UNPAID_LEAVE' : 'PAID_LEAVE',
          leaveType: approvedLeave.leaveTypeName || approvedLeave.leaveType?.name || (isUnpaid ? 'Unpaid Leave (LWP)' : 'Paid Leave'),
          remarks: approvedLeave.reason || 'Approved leave'
        }
      } else if (attendanceRecord && attendanceRecord.punchIn) {
        const punchInIso = attendanceRecord.punchIn
        const punchOutIso = attendanceRecord.punchOut || null

        // Accurate IST minutes calculation
        const punchInMinutes = parseTimeToISTMinutes(punchInIso)
        const computedLateMins = Math.max(0, punchInMinutes - shiftInMins)
        const isLateComputed = computedLateMins > 15
        const isLate = isLateComputed || attendanceRecord.isLate === true || attendanceRecord.status === 'LATE'
        const lateMins = attendanceRecord.lateMinutes && attendanceRecord.lateMinutes > 0
          ? attendanceRecord.lateMinutes
          : computedLateMins

        let earlyOutMins = 0
        let isEarlyOut = false
        let totalMins = attendanceRecord.totalMinutes || 0

        if (punchOutIso) {
          const punchOutMinutes = parseTimeToISTMinutes(punchOutIso)
          earlyOutMins = Math.max(0, shiftOutMins - punchOutMinutes)
          isEarlyOut = earlyOutMins > 15
          if (!totalMins) {
            totalMins = punchOutMinutes >= punchInMinutes ? punchOutMinutes - punchInMinutes : (1440 - punchInMinutes) + punchOutMinutes
          }
        }

        const otMins = Math.max(0, totalMins - scheduledTotalMins)

        let status: ReportRecord['status'] = 'PRESENT'
        // Half Day Policy: if worked <= 5 hours (300 mins) or already recorded as HALF_DAY
        if ((punchOutIso && totalMins > 0 && totalMins <= 300) || attendanceRecord.status === 'HALF_DAY') {
          status = 'HALF_DAY'
        } else if (isLate && isEarlyOut) {
          status = 'LATE_AND_EARLY'
        } else if (isLate) {
          status = 'LATE'
        } else if (isEarlyOut) {
          status = 'EARLY_OUT'
        }

        let remarks = 'On Time (Present)'
        if (status === 'HALF_DAY') {
          const latePart = isLate ? ` • Late by ${formatDurationHoursMinutes(lateMins)}` : ''
          remarks = `Half Day (worked ${formatDurationHoursMinutes(totalMins)} ≤ 5h)${latePart}`
        } else if (isLate && isEarlyOut) {
          remarks = `Late (+${formatDurationHoursMinutes(lateMins)}) & Early Out (-${formatDurationHoursMinutes(earlyOutMins)})`
        } else if (isLate) {
          remarks = `Late arrival by ${formatDurationHoursMinutes(lateMins)} (+${lateMins}m)`
        } else if (isEarlyOut) {
          remarks = `Early departure by ${formatDurationHoursMinutes(earlyOutMins)} (-${earlyOutMins}m)`
        } else if (otMins > 0) {
          remarks = `Overtime +${formatDurationHoursMinutes(otMins)}`
        }

        record = {
          id: `rec-${emp.employeeId || emp.id}-${dateStr}`,
          date: dateStr,
          dayOfWeek: dayName,
          isWeekend,
          employeeId: emp.id,
          empCode: emp.employeeId || emp.id,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Staff',
          designation: emp.designation || 'Staff',
          branchName: emp.branch?.name || emp.branch || 'Hotel Grand Godwin',
          departmentName: emp.department?.name || emp.department || 'Operations',
          scheduledIn: shiftIn,
          scheduledOut: shiftOut,
          punchIn: punchInIso,
          punchOut: punchOutIso,
          lateMinutes: lateMins,
          isLate,
          earlyOutMinutes: earlyOutMins,
          isEarlyOut,
          totalMinutes: totalMins,
          overtimeMinutes: otMins,
          status,
          remarks
        }
      } else if (isOffDay) {
        record = {
          id: `rec-${emp.employeeId || emp.id}-${dateStr}`,
          date: dateStr,
          dayOfWeek: dayName,
          isWeekend: true,
          employeeId: emp.id,
          empCode: emp.employeeId || emp.id,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Staff',
          designation: emp.designation || 'Staff',
          branchName: emp.branch?.name || emp.branch || 'Hotel Grand Godwin',
          departmentName: emp.department?.name || emp.department || 'Operations',
          scheduledIn: shiftIn,
          scheduledOut: shiftOut,
          punchIn: null,
          punchOut: null,
          lateMinutes: 0,
          isLate: false,
          earlyOutMinutes: 0,
          isEarlyOut: false,
          totalMinutes: 0,
          overtimeMinutes: 0,
          status: 'WEEKLY_OFF',
          remarks: 'Weekly Roster Off'
        }
      } else if (dateStr <= todayStr) {
        record = {
          id: `rec-${emp.employeeId || emp.id}-${dateStr}`,
          date: dateStr,
          dayOfWeek: dayName,
          isWeekend,
          employeeId: emp.id,
          empCode: emp.employeeId || emp.id,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Staff',
          designation: emp.designation || 'Staff',
          branchName: emp.branch?.name || emp.branch || 'Hotel Grand Godwin',
          departmentName: emp.department?.name || emp.department || 'Operations',
          scheduledIn: shiftIn,
          scheduledOut: shiftOut,
          punchIn: null,
          punchOut: null,
          lateMinutes: 0,
          isLate: false,
          earlyOutMinutes: 0,
          isEarlyOut: false,
          totalMinutes: 0,
          overtimeMinutes: 0,
          status: 'ABSENT',
          remarks: 'No punch recorded'
        }
      } else {
        // Future dates
        record = {
          id: `rec-${emp.employeeId || emp.id}-${dateStr}`,
          date: dateStr,
          dayOfWeek: dayName,
          isWeekend,
          employeeId: emp.id,
          empCode: emp.employeeId || emp.id,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Staff',
          designation: emp.designation || 'Staff',
          branchName: emp.branch?.name || emp.branch || 'Hotel Grand Godwin',
          departmentName: emp.department?.name || emp.department || 'Operations',
          scheduledIn: shiftIn,
          scheduledOut: shiftOut,
          punchIn: null,
          punchOut: null,
          lateMinutes: 0,
          isLate: false,
          earlyOutMinutes: 0,
          isEarlyOut: false,
          totalMinutes: 0,
          overtimeMinutes: 0,
          status: 'WEEKLY_OFF',
          remarks: 'Upcoming schedule'
        }
      }

      allRecords.push(record)
    })
  })

  // Calculate Employee-wise aggregations
  const employeeSummaries = employees.map(emp => {
    const code = emp.employeeId || emp.id
    const empRecords = allRecords.filter(r => r.empCode === code || r.employeeId === emp.id)
    const workingRecords = empRecords.filter(r => r.status !== 'WEEKLY_OFF')
    const totalWorkingDays = workingRecords.length || 1

    const presentDays = empRecords.filter(r => ['PRESENT', 'LATE', 'EARLY_OUT', 'LATE_AND_EARLY'].includes(r.status)).length
    const lateDays = empRecords.filter(r => r.isLate).length
    const earlyOutDays = empRecords.filter(r => r.isEarlyOut).length
    const paidLeaveDays = empRecords.filter(r => r.status === 'PAID_LEAVE').length
    const unpaidLeaveDays = empRecords.filter(r => r.status === 'UNPAID_LEAVE').length
    const absentDays = empRecords.filter(r => r.status === 'ABSENT').length
    const halfDays = empRecords.filter(r => r.status === 'HALF_DAY').length

    const totalMinutes = empRecords.reduce((acc, r) => acc + r.totalMinutes, 0)
    const overtimeMinutes = empRecords.reduce((acc, r) => acc + r.overtimeMinutes, 0)
    const lateMinutes = empRecords.reduce((acc, r) => acc + r.lateMinutes, 0)
    const earlyOutMinutes = empRecords.reduce((acc, r) => acc + r.earlyOutMinutes, 0)

    const effectivePresent = presentDays + (halfDays * 0.5) + paidLeaveDays
    const attendanceRate = totalWorkingDays > 0 ? Math.min(100, Math.round((effectivePresent / totalWorkingDays) * 100)) : 0

    return {
      employeeId: emp.id,
      empCode: code,
      employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Staff',
      designation: emp.designation || 'Staff',
      branchName: emp.branch?.name || emp.branch || 'Hotel Grand Godwin',
      departmentName: emp.department?.name || emp.department || 'Operations',
      scheduledIn: emp.morningTime || '09:00',
      scheduledOut: emp.eveningTime || '18:00',
      totalDays: empRecords.length,
      workingDays: totalWorkingDays,
      presentDays,
      lateDays,
      lateMinutes,
      earlyOutDays,
      earlyOutMinutes,
      paidLeaveDays,
      unpaidLeaveDays,
      absentDays,
      halfDays,
      totalMinutes,
      overtimeMinutes,
      attendanceRate
    }
  })

  // Calculate overall summary metrics
  const totalRecordsCount = allRecords.length
  const totalWorkingRecords = allRecords.filter(r => r.status !== 'WEEKLY_OFF').length || 1
  const totalPresent = allRecords.filter(r => ['PRESENT', 'LATE', 'EARLY_OUT', 'LATE_AND_EARLY'].includes(r.status)).length
  const totalLate = allRecords.filter(r => r.isLate).length
  const totalEarlyOut = allRecords.filter(r => r.isEarlyOut).length
  const totalPaidLeave = allRecords.filter(r => r.status === 'PAID_LEAVE').length
  const totalUnpaidLeave = allRecords.filter(r => r.status === 'UNPAID_LEAVE').length
  const totalAbsent = allRecords.filter(r => r.status === 'ABSENT').length
  const totalHalfDay = allRecords.filter(r => r.status === 'HALF_DAY').length
  const totalWorkingMinutes = allRecords.reduce((acc, r) => acc + r.totalMinutes, 0)
  const totalOvertimeMinutes = allRecords.reduce((acc, r) => acc + r.overtimeMinutes, 0)

  const overallAttendanceRate = totalWorkingRecords > 0
    ? Math.min(100, Math.round(((totalPresent + (totalHalfDay * 0.5) + totalPaidLeave) / totalWorkingRecords) * 100))
    : 0

  return NextResponse.json({
    dateRange: { from: fromStr, to: toStr, totalDays: dateList.length },
    summary: {
      totalEmployees: employees.length,
      totalRecords: totalRecordsCount,
      totalWorkingDays: totalWorkingRecords,
      totalPresent,
      totalLate,
      totalEarlyOut,
      totalPaidLeave,
      totalUnpaidLeave,
      totalAbsent,
      totalHalfDay,
      totalWorkingMinutes,
      totalOvertimeMinutes,
      attendanceRate: overallAttendanceRate
    },
    employeeSummaries,
    records: allRecords
  })
}
