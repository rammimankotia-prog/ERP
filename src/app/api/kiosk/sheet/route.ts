import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { getMergedAttendance } from '@/lib/attendanceStorage'

import { parseTimeToISTMinutes } from '@/app/api/hr/reports/route'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(LOCAL_DATA_DIR, 'hr_employees.json')

const ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance.json')
const LOCAL_ATTENDANCE_FILE = path.join(LOCAL_DATA_DIR, 'hr_attendance.json')

const LEAVES_FILE = path.join(DATA_DIR, 'hr_leaves.json')
const LOCAL_LEAVES_FILE = path.join(LOCAL_DATA_DIR, 'hr_leaves.json')
const BACKUP_EMPLOYEES_FILE = path.join(LOCAL_DATA_DIR, 'hr_employees_backup.json')

function readJson<T>(file: string, fallbackFile: string, fallback: T): T {
  for (const f of [file, fallbackFile]) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed !== undefined && parsed !== null) return parsed as unknown as T
      }
    } catch {}
  }
  return fallback
}

function getMergedEmployees(): any[] {
  const map = new Map<string, any>()
  for (const f of [BACKUP_EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, EMPLOYEES_FILE]) {
    try {
      if (fs.existsSync(f)) {
        const list = JSON.parse(fs.readFileSync(f, 'utf-8'))
        if (Array.isArray(list)) {
          for (const emp of list) {
            const key = emp.employeeId || emp.id
            if (key) {
              map.set(key, { ...(map.get(key) || {}), ...emp })
            }
          }
        }
      }
    } catch {}
  }
  return Array.from(map.values())
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const now = new Date()

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed
  const currentDay = now.getDate()

  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const branchId = searchParams.get('branchId')
  const departmentId = searchParams.get('departmentId')
  const search = searchParams.get('search')

  let targetYear = yearParam ? parseInt(yearParam, 10) : currentYear
  let targetMonth = monthParam !== null && monthParam !== undefined && monthParam !== ''
    ? parseInt(monthParam, 10)
    : currentMonth

  // Clamp future months to current month & year (Guards must NEVER see future dates)
  if (targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth)) {
    targetYear = currentYear
    targetMonth = currentMonth
  }

  const isCurrentMonth = targetYear === currentYear && targetMonth === currentMonth
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()

  // Guard restriction: If current month, only show days up to today. If past month, show full past month.
  const maxDay = isCurrentMonth ? currentDay : daysInTargetMonth

  const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`

  // 1. Build Day Columns up to maxDay (Strictly no future dates!)
  interface DayColumn {
    dayNumber: number
    date: string
    dayOfWeek: string
    dayShort: string
    isToday: boolean
    isSunday: boolean
    isSaturday: boolean
  }
  const days: DayColumn[] = []
  for (let d = 1; d <= maxDay; d++) {
    const dateObj = new Date(targetYear, targetMonth, d)
    const dayOfWeekIdx = dateObj.getDay()
    const dayStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      dayNumber: d,
      date: dayStr,
      dayOfWeek: WEEK_DAYS[dayOfWeekIdx],
      dayShort: WEEK_DAYS_SHORT[dayOfWeekIdx],
      isToday: dayStr === todayStr,
      isSunday: dayOfWeekIdx === 0,
      isSaturday: dayOfWeekIdx === 6,
    })
  }

  // 2. Fetch Employees (Prisma DB first, JSON fallback)
  let employees: any[] = []
  try {
    const dbEmps = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        ...(branchId && branchId !== 'ALL' ? { branchId } : {}),
        ...(departmentId && departmentId !== 'ALL' ? { departmentId } : {}),
      },
      include: {
        branch: true,
        department: true,
      },
      orderBy: { firstName: 'asc' },
    })
    if (dbEmps && dbEmps.length > 0) {
      employees = dbEmps.map(e => ({
        ...e,
        branch: e.branch?.name || 'Hotel Grand Godwin',
        department: e.department?.name || 'Operations',
      }))
    }
  } catch {}

  const jsonEmployees = getMergedEmployees().filter((e: any) => e.status === 'ACTIVE' || !e.status)
  const empMap = new Map<string, any>()
  jsonEmployees.forEach(e => {
    const k = e.employeeId || e.id
    if (k) empMap.set(k, e)
  })
  employees.forEach(e => {
    const k = e.employeeId || e.id
    if (k) empMap.set(k, { ...(empMap.get(k) || {}), ...e })
  })
  employees = Array.from(empMap.values())

  if (branchId && branchId !== 'ALL') {
    employees = employees.filter(e => e.branchId === branchId || e.branch?.id === branchId || e.branch === branchId)
  }
  if (departmentId && departmentId !== 'ALL') {
    employees = employees.filter(e => e.departmentId === departmentId || e.department?.id === departmentId || e.department === departmentId)
  }
  if (search) {
    const q = search.toLowerCase().trim()
    employees = employees.filter(e =>
      `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase().includes(q) ||
      (e.employeeId || '').toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q)
    )
  }

  // 3. Fetch Attendance Logs (Prisma DB first, then merge with JSON)
  let allAttendance: any[] = []
  try {
    const startDate = new Date(targetYear, targetMonth, 1)
    const endDate = new Date(targetYear, targetMonth, maxDay, 23, 59, 59)
    const dbLogs = await prisma.attendanceLog.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    })
    if (dbLogs && dbLogs.length > 0) {
      allAttendance = dbLogs.map(l => ({
        ...l,
        date: l.date instanceof Date ? l.date.toISOString().split('T')[0] : String(l.date).slice(0, 10)
      }))
    }
  } catch {}

  const fileAttendance = getMergedAttendance()
  fileAttendance.forEach(fa => {
    const dStr = fa.date || (fa.punchIn ? fa.punchIn.slice(0, 10) : '')
    if (dStr && !allAttendance.some(a => a.employeeId === fa.employeeId && a.date === dStr)) {
      allAttendance.push({ ...fa, date: dStr })
    }
  })

  // 4. Fetch Approved Leaves (Prisma DB first, then merge with JSON)
  let approvedLeaves: any[] = []
  try {
    const dbLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED'
      },
      include: {
        leaveType: true
      }
    })
    if (dbLeaves && dbLeaves.length > 0) {
      approvedLeaves = dbLeaves.map(l => ({
        id: l.id,
        employeeId: l.employeeId,
        fromDate: l.fromDate instanceof Date ? l.fromDate.toISOString().split('T')[0] : String(l.fromDate).slice(0, 10),
        toDate: l.toDate instanceof Date ? l.toDate.toISOString().split('T')[0] : String(l.toDate).slice(0, 10),
        reason: l.reason,
        status: l.status,
        leaveTypeName: l.leaveType?.name || 'Approved Leave',
        category: l.leaveType?.category || 'CASUAL'
      }))
    }
  } catch {}

  const fileLeaves = readJson<any[]>(LEAVES_FILE, LOCAL_LEAVES_FILE, [])
  fileLeaves
    .filter(l => l.status === 'APPROVED')
    .forEach(fl => {
      const fromD = fl.fromDate ? fl.fromDate.slice(0, 10) : ''
      const toD = fl.toDate ? fl.toDate.slice(0, 10) : ''
      if (!approvedLeaves.some(al => al.id === fl.id)) {
        approvedLeaves.push({
          id: fl.id,
          employeeId: fl.employeeId || fl.employeeCode,
          employeeCode: fl.employeeCode || fl.employeeId,
          fromDate: fromD,
          toDate: toD,
          reason: fl.reason,
          status: 'APPROVED',
          leaveTypeName: fl.leaveTypeName || fl.leaveType?.name || 'Approved Leave',
          category: fl.category || fl.leaveType?.category || 'CASUAL'
        })
      }
    })

  // 5. Aggregate Employee Day Matrix
  let presentTodayCount = 0
  let onLeaveTodayCount = 0
  let offTodayCount = 0

  const rosterRows = employees.map(emp => {
    const empId = emp.id
    const empCode = emp.employeeId || emp.id
    const empOffDays = Array.isArray(emp.offDays) && emp.offDays.length > 0
      ? emp.offDays
      : ['Sunday']

    const dailyCells: Record<number, any> = {}

    days.forEach(dayInfo => {
      const dayNum = dayInfo.dayNumber
      const dateStr = dayInfo.date
      const dayName = dayInfo.dayOfWeek

      // A. Check if employee has an APPROVED leave on this date
      const matchedLeave = approvedLeaves.find(l =>
        (l.employeeId === empId || l.employeeId === empCode || l.employeeCode === empCode) &&
        dateStr >= l.fromDate &&
        dateStr <= l.toDate
      )

      if (matchedLeave) {
        if (dayInfo.isToday) onLeaveTodayCount++
        dailyCells[dayNum] = {
          status: 'LEAVE',
          badgeText: 'LEAVE',
          isApprovedLeave: true,
          isNonAmended: true, // Strictly non-amended!
          leaveReason: matchedLeave.reason || 'Management Approved Leave',
          leaveTypeName: matchedLeave.leaveTypeName || 'Approved Leave',
          punchIn: null,
          punchOut: null,
          title: `🌴 Approved Leave: ${matchedLeave.leaveTypeName} | Reason: "${matchedLeave.reason || 'N/A'}" (Non-amendable)`,
        }
        return
      }

      // B. Check if this day is a configured Weekly Off day for this employee
      const isConfiguredOff = empOffDays.some((od: string) => od.toLowerCase() === dayName.toLowerCase())
      if (isConfiguredOff) {
        if (dayInfo.isToday) offTodayCount++
        dailyCells[dayNum] = {
          status: 'WEEKLY_OFF',
          badgeText: 'OFF',
          isOffDay: true,
          isNonAmended: true, // Non-amended weekly off
          leaveReason: null,
          punchIn: null,
          punchOut: null,
          title: `🏖️ Weekly Off (${dayName}) - Non-amendable scheduled off`,
        }
        return
      }

      // C. Check Attendance Record
      const attRecord = allAttendance.find(a =>
        (a.employeeId === empId || a.employeeId === empCode) &&
        (a.date === dateStr || (a.punchIn && a.punchIn.slice(0, 10) === dateStr))
      )

      if (attRecord && attRecord.punchIn) {
        if (dayInfo.isToday) presentTodayCount++
        const formatTime = (iso: string) => {
          try {
            return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
          } catch {
            return iso
          }
        }
        const inFormatted = formatTime(attRecord.punchIn)
        const outFormatted = attRecord.punchOut ? formatTime(attRecord.punchOut) : null

        let totalMins = attRecord.totalMinutes
        if ((totalMins === undefined || totalMins === null) && attRecord.punchIn && attRecord.punchOut) {
          try {
            totalMins = Math.floor((new Date(attRecord.punchOut).getTime() - new Date(attRecord.punchIn).getTime()) / 60000)
          } catch {}
        }

        const shiftInMinutes = parseTimeToISTMinutes(emp.morningTime || '09:00')
        const punchInMinutes = parseTimeToISTMinutes(attRecord.punchIn)
        const lateMinutes = Math.max(0, punchInMinutes - shiftInMinutes)
        const isLate = attRecord.isLate === true || attRecord.status === 'LATE' || lateMinutes > 15
        const isHalfDay = attRecord.status === 'HALF_DAY' || (typeof totalMins === 'number' && totalMins > 0 && totalMins <= 300 && !!attRecord.punchOut)
        const displayStatus = isHalfDay ? 'HALF_DAY' : (isLate ? 'LATE' : (attRecord.status || 'PRESENT'))
        const badgeText = isHalfDay ? '½ DAY' : (isLate ? 'LATE' : 'P')

        dailyCells[dayNum] = {
          status: displayStatus,
          badgeText,
          punchIn: inFormatted,
          punchOut: outFormatted,
          punchInRaw: attRecord.punchIn,
          punchOutRaw: attRecord.punchOut,
          isLate,
          lateMinutes: isLate ? (attRecord.lateMinutes || lateMinutes) : 0,
          isHalfDay,
          totalMinutes: totalMins,
          isNonAmended: false,
          leaveReason: null,
          title: isHalfDay
            ? `🟣 Half Day (${typeof totalMins === 'number' ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m ≤ 5h` : '≤ 5 hours'})${isLate ? ` • Late (+${lateMinutes}m)` : ''} | In: ${inFormatted}${outFormatted ? ` | Out: ${outFormatted}` : ''}`
            : isLate
              ? `⚠️ Late Arrival (+${lateMinutes}m) | In: ${inFormatted}${outFormatted ? ` | Out: ${outFormatted}` : ' (On Duty)'}`
              : `🟢 Present | In: ${inFormatted}${outFormatted ? ` | Out: ${outFormatted}` : ' (On Duty)'}`,
        }
        return
      }

      // D. Not punched yet or Absent
      if (dayInfo.isToday) {
        dailyCells[dayNum] = {
          status: 'PENDING_TODAY',
          badgeText: 'WAITING',
          punchIn: null,
          punchOut: null,
          isNonAmended: false,
          leaveReason: null,
          title: '⚪ Scheduled Today - Pending punch-in',
        }
      } else {
        dailyCells[dayNum] = {
          status: 'ABSENT',
          badgeText: 'A',
          punchIn: null,
          punchOut: null,
          isNonAmended: false,
          leaveReason: null,
          title: `🔴 Absent on ${dateStr} (No check-in record)`,
        }
      }
    })

    return {
      id: emp.id,
      employeeId: emp.employeeId || emp.id,
      name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Staff',
      firstName: emp.firstName,
      lastName: emp.lastName,
      designation: emp.designation || 'Staff',
      branch: emp.branch?.name || emp.branch || 'Hotel Grand Godwin',
      department: emp.department?.name || emp.department || 'Operations',
      photo: emp.photo || null,
      morningTime: emp.morningTime || '09:00',
      eveningTime: emp.eveningTime || '18:00',
      offDays: empOffDays,
      cells: dailyCells,
    }
  })

  return NextResponse.json({
    year: targetYear,
    month: targetMonth,
    monthName: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ][targetMonth],
    isCurrentMonth,
    maxDay,
    todayStr,
    days,
    employees: rosterRows,
    stats: {
      totalEmployees: employees.length,
      presentToday: presentTodayCount,
      onLeaveToday: onLeaveTodayCount,
      offToday: offTodayCount,
      waitingToday: Math.max(0, employees.length - presentTodayCount - onLeaveTodayCount - offTodayCount)
    }
  })
}
