import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const BRANCHES_FILE = path.join(DATA_DIR, 'hr_branches.json')
const DEPARTMENTS_FILE = path.join(DATA_DIR, 'hr_departments.json')

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch {}
  return fallback
}

const DEFAULT_EMPLOYEES = [
  {
    id: "mock-emp-1",
    employeeId: "GG-1001",
    firstName: "Raman",
    lastName: "Mankotia",
    designation: "General Manager",
    contactNo: "9876543210",
    branchId: "mock-1",
    branch: { id: "mock-1", name: "Hotel Grand Godwin", prefix: "GG" },
    departmentId: "dept-1",
    department: { id: "dept-1", name: "Front Office" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    morningTime: "09:00",
    eveningTime: "18:00",
    gender: "Male"
  },
  {
    id: "mock-emp-2",
    employeeId: "GG-1002",
    firstName: "Priya",
    lastName: "Sharma",
    designation: "Front Desk Executive",
    contactNo: "9812345678",
    branchId: "mock-1",
    branch: { id: "mock-1", name: "Hotel Grand Godwin", prefix: "GG" },
    departmentId: "dept-1",
    department: { id: "dept-1", name: "Front Office" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    morningTime: "07:00",
    eveningTime: "15:30",
    gender: "Female"
  },
  {
    id: "mock-emp-3",
    employeeId: "GD-1001",
    firstName: "Rajiv",
    lastName: "Kumar",
    designation: "Housekeeping Supervisor",
    contactNo: "9823456789",
    branchId: "mock-2",
    branch: { id: "mock-2", name: "Hotel Godwin Deluxe", prefix: "GD" },
    departmentId: "dept-2",
    department: { id: "dept-2", name: "Housekeeping" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    morningTime: "08:00",
    eveningTime: "17:00",
    gender: "Male"
  },
  {
    id: "mock-emp-4",
    employeeId: "GD-1002",
    firstName: "Sunita",
    lastName: "Verma",
    designation: "Security Officer",
    contactNo: "9834567890",
    branchId: "mock-2",
    branch: { id: "mock-2", name: "Hotel Godwin Deluxe", prefix: "GD" },
    departmentId: "dept-3",
    department: { id: "dept-3", name: "Security" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    morningTime: "22:00",
    eveningTime: "06:00",
    gender: "Female"
  },
  {
    id: "mock-emp-5",
    employeeId: "GG-1003",
    firstName: "Amit",
    lastName: "Singh",
    designation: "Accounts Executive",
    contactNo: "9845678901",
    branchId: "mock-1",
    branch: { id: "mock-1", name: "Hotel Grand Godwin", prefix: "GG" },
    departmentId: "dept-4",
    department: { id: "dept-4", name: "Accounts" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    morningTime: "10:00",
    eveningTime: "19:00",
    gender: "Male"
  }
]

// Known scheduled leaves for realism
const SCHEDULED_LEAVES = [
  { employeeId: 'mock-emp-2', from: '2026-09-05', to: '2026-09-06', type: 'PAID_LEAVE', reason: 'Sick Leave (Viral Fever)' },
  { employeeId: 'mock-emp-3', from: '2026-09-09', to: '2026-09-10', type: 'PAID_LEAVE', reason: 'Casual Leave (Family Work)' },
  { employeeId: 'mock-emp-4', from: '2026-09-09', to: '2026-09-11', type: 'PAID_LEAVE', reason: 'Earned Leave (Sister Wedding)' },
  { employeeId: 'mock-emp-5', from: '2026-09-03', to: '2026-09-03', type: 'UNPAID_LEAVE', reason: 'Unapproved Absence / LWP' },
  { employeeId: 'mock-emp-1', from: '2026-08-18', to: '2026-08-18', type: 'UNPAID_LEAVE', reason: 'Leave Without Pay (LWP)' },
  { employeeId: 'mock-emp-3', from: '2026-08-25', to: '2026-08-25', type: 'UNPAID_LEAVE', reason: 'Unexcused Absence (LWP)' },
]

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

function parseTimeToMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function formatMinutesToTime(mins: number): string {
  const norm = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function pseudoHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const employeeIdFilter = searchParams.get('employeeId')
  const branchFilter = searchParams.get('branchId')
  const deptFilter = searchParams.get('departmentId')

  const today = new Date()
  const defaultTo = today.toISOString().split('T')[0]
  const defaultFromDate = new Date()
  defaultFromDate.setDate(1) // 1st of current month
  const defaultFrom = defaultFromDate.toISOString().split('T')[0]

  const fromStr = fromParam || defaultFrom
  const toStr = toParam || defaultTo

  const fromDate = new Date(fromStr + 'T00:00:00')
  const toDate = new Date(toStr + 'T23:59:59')

  // Load employees
  let rawEmployees = readJson<any[]>(EMPLOYEES_FILE, DEFAULT_EMPLOYEES)
  if (!rawEmployees || rawEmployees.length === 0) {
    rawEmployees = DEFAULT_EMPLOYEES
  }

  // Filter employees
  let employees = rawEmployees
  if (employeeIdFilter && employeeIdFilter !== 'ALL') {
    employees = employees.filter(e => e.id === employeeIdFilter || e.employeeId === employeeIdFilter)
  }
  if (branchFilter && branchFilter !== 'ALL') {
    employees = employees.filter(e => e.branchId === branchFilter || e.branch?.id === branchFilter)
  }
  if (deptFilter && deptFilter !== 'ALL') {
    employees = employees.filter(e => e.departmentId === deptFilter || e.department?.id === deptFilter)
  }

function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
      const isWeekend = isSunday || isSaturday

      const seed = pseudoHash(`${emp.employeeId}-${dateStr}`)

      // Check scheduled leaves
      const scheduledLeave = SCHEDULED_LEAVES.find(l =>
        l.employeeId === emp.id && dateStr >= l.from && dateStr <= l.to
      )

      let record: ReportRecord

      if (scheduledLeave) {
        if (scheduledLeave.type === 'UNPAID_LEAVE') {
          record = {
            id: `rec-${emp.employeeId}-${dateStr}`,
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            employeeId: emp.id,
            empCode: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
            departmentName: emp.department?.name || 'Operations',
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
            status: 'UNPAID_LEAVE',
            leaveType: 'Unpaid Leave (LWP)',
            remarks: scheduledLeave.reason
          }
        } else {
          record = {
            id: `rec-${emp.employeeId}-${dateStr}`,
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            employeeId: emp.id,
            empCode: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
            departmentName: emp.department?.name || 'Operations',
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
            status: 'PAID_LEAVE',
            leaveType: 'Paid Leave',
            remarks: scheduledLeave.reason
          }
        }
      } else if (isSunday && emp.designation !== 'Security Officer') {
        // Sunday weekly off for general staff (Security has rotational shift)
        record = {
          id: `rec-${emp.employeeId}-${dateStr}`,
          date: dateStr,
          dayOfWeek: dayName,
          isWeekend: true,
          employeeId: emp.id,
          empCode: emp.employeeId,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          designation: emp.designation,
          branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
          departmentName: emp.department?.name || 'Operations',
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
      } else {
        // Attendance determination by pseudoHash for determinism
        const variant = seed % 100

        if (variant < 8) {
          // Unpaid Leave / Unexcused Absent
          record = {
            id: `rec-${emp.employeeId}-${dateStr}`,
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            employeeId: emp.id,
            empCode: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
            departmentName: emp.department?.name || 'Operations',
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
            status: variant < 4 ? 'UNPAID_LEAVE' : 'ABSENT',
            leaveType: variant < 4 ? 'Unpaid Leave (LWP)' : undefined,
            remarks: variant < 4 ? 'Unpaid Leave (LWP)' : 'Absent without notice'
          }
        } else if (variant < 14) {
          // Half Day
          const halfMins = Math.floor(scheduledTotalMins / 2)
          const actualInMins = shiftInMins + 5
          const actualOutMins = actualInMins + halfMins
          const earlyMins = Math.max(0, scheduledTotalMins - halfMins)

          record = {
            id: `rec-${emp.employeeId}-${dateStr}`,
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            employeeId: emp.id,
            empCode: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
            departmentName: emp.department?.name || 'Operations',
            scheduledIn: shiftIn,
            scheduledOut: shiftOut,
            punchIn: `${dateStr}T${formatMinutesToTime(actualInMins)}:00`,
            punchOut: `${dateStr}T${formatMinutesToTime(actualOutMins)}:00`,
            lateMinutes: 0,
            isLate: false,
            earlyOutMinutes: earlyMins,
            isEarlyOut: true,
            totalMinutes: halfMins,
            overtimeMinutes: 0,
            status: 'HALF_DAY',
            remarks: 'Half Day approved leave'
          }
        } else if (variant < 34) {
          // Late Arrive (e.g. 20 to 55 minutes late)
          const lateMins = 20 + (seed % 35)
          const actualInMins = shiftInMins + lateMins
          const stayExtra = (seed % 2 === 0) ? (seed % 40) : 0
          const actualOutMins = shiftOutMins + stayExtra
          const actualTotalMins = (actualOutMins >= actualInMins ? actualOutMins - actualInMins : 1440 - actualInMins + actualOutMins)
          const otMins = Math.max(0, actualTotalMins - scheduledTotalMins)

          record = {
            id: `rec-${emp.employeeId}-${dateStr}`,
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            employeeId: emp.id,
            empCode: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
            departmentName: emp.department?.name || 'Operations',
            scheduledIn: shiftIn,
            scheduledOut: shiftOut,
            punchIn: `${dateStr}T${formatMinutesToTime(actualInMins)}:00`,
            punchOut: `${dateStr}T${formatMinutesToTime(actualOutMins)}:00`,
            lateMinutes: lateMins,
            isLate: true,
            earlyOutMinutes: 0,
            isEarlyOut: false,
            totalMinutes: actualTotalMins,
            overtimeMinutes: otMins,
            status: 'LATE',
            remarks: `Late arrival by ${lateMins} minutes`
          }
        } else if (variant < 50) {
          // Early Out (e.g. 25 to 60 minutes early)
          const earlyMins = 25 + (seed % 35)
          const actualInMins = shiftInMins + (seed % 10) // on-time or slight
          const actualOutMins = shiftOutMins - earlyMins
          const actualTotalMins = (actualOutMins >= actualInMins ? actualOutMins - actualInMins : 1440 - actualInMins + actualOutMins)

          record = {
            id: `rec-${emp.employeeId}-${dateStr}`,
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            employeeId: emp.id,
            empCode: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
            departmentName: emp.department?.name || 'Operations',
            scheduledIn: shiftIn,
            scheduledOut: shiftOut,
            punchIn: `${dateStr}T${formatMinutesToTime(actualInMins)}:00`,
            punchOut: `${dateStr}T${formatMinutesToTime(actualOutMins)}:00`,
            lateMinutes: 0,
            isLate: false,
            earlyOutMinutes: earlyMins,
            isEarlyOut: true,
            totalMinutes: actualTotalMins,
            overtimeMinutes: 0,
            status: 'EARLY_OUT',
            remarks: `Left ${earlyMins} minutes before shift end`
          }
        } else if (variant < 60) {
          // Both Late AND Early Out
          const lateMins = 20 + (seed % 20)
          const earlyMins = 25 + (seed % 25)
          const actualInMins = shiftInMins + lateMins
          const actualOutMins = shiftOutMins - earlyMins
          const actualTotalMins = (actualOutMins >= actualInMins ? actualOutMins - actualInMins : 1440 - actualInMins + actualOutMins)

          record = {
            id: `rec-${emp.employeeId}-${dateStr}`,
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            employeeId: emp.id,
            empCode: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
            departmentName: emp.department?.name || 'Operations',
            scheduledIn: shiftIn,
            scheduledOut: shiftOut,
            punchIn: `${dateStr}T${formatMinutesToTime(actualInMins)}:00`,
            punchOut: `${dateStr}T${formatMinutesToTime(actualOutMins)}:00`,
            lateMinutes: lateMins,
            isLate: true,
            earlyOutMinutes: earlyMins,
            isEarlyOut: true,
            totalMinutes: actualTotalMins,
            overtimeMinutes: 0,
            status: 'LATE_AND_EARLY',
            remarks: `Late by ${lateMins}m & early exit by ${earlyMins}m`
          }
        } else {
          // Standard On-time Present (some with Overtime)
          const actualInMins = shiftInMins + (seed % 8)
          const ot = variant > 85 ? (seed % 60 + 30) : 0
          const actualOutMins = shiftOutMins + ot + (seed % 10)
          const actualTotalMins = (actualOutMins >= actualInMins ? actualOutMins - actualInMins : 1440 - actualInMins + actualOutMins)

          record = {
            id: `rec-${emp.employeeId}-${dateStr}`,
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            employeeId: emp.id,
            empCode: emp.employeeId,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
            departmentName: emp.department?.name || 'Operations',
            scheduledIn: shiftIn,
            scheduledOut: shiftOut,
            punchIn: `${dateStr}T${formatMinutesToTime(actualInMins)}:00`,
            punchOut: `${dateStr}T${formatMinutesToTime(actualOutMins)}:00`,
            lateMinutes: 0,
            isLate: false,
            earlyOutMinutes: 0,
            isEarlyOut: false,
            totalMinutes: actualTotalMins,
            overtimeMinutes: ot,
            status: 'PRESENT',
            remarks: ot > 0 ? `Overtime +${ot} mins` : 'On Time'
          }
        }
      }

      allRecords.push(record)
    })
  })

  // Calculate Employee-wise aggregations
  const employeeSummaries = employees.map(emp => {
    const empRecords = allRecords.filter(r => r.empCode === emp.employeeId)
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
    const attendanceRate = Math.min(100, Math.round((effectivePresent / totalWorkingDays) * 100))

    return {
      employeeId: emp.id,
      empCode: emp.employeeId,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      designation: emp.designation,
      branchName: emp.branch?.name || (emp.employeeId.startsWith('GD') ? 'Hotel Godwin Deluxe' : 'Hotel Grand Godwin'),
      departmentName: emp.department?.name || 'Operations',
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

  const overallAttendanceRate = Math.min(
    100,
    Math.round(((totalPresent + (totalHalfDay * 0.5) + totalPaidLeave) / totalWorkingRecords) * 100)
  )

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
