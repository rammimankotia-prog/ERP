import { NextRequest, NextResponse } from 'next/server'
import { getMergedAttendance } from '@/lib/attendanceStorage'
import { getAllEmployees } from '@/lib/employeeData'

export const dynamic = 'force-dynamic'


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const branch = searchParams.get('branch')
  const department = searchParams.get('department')

  try {
    const employees = await getAllEmployees()
    const allAttendance = getMergedAttendance()

    const monthStr = String(month).padStart(2, '0')
    const yearMonth = `${year}-${monthStr}`
    const daysInMonth = new Date(year, month, 0).getDate()

    // Filter attendance for the selected year & month
    const monthLogs = allAttendance.filter(a => a.date && a.date.startsWith(yearMonth))

    let summary = employees.map(emp => {
      const empLogs = monthLogs.filter(
        a => a.employeeId === emp.id || a.employeeId === emp.employeeId
      )

      let presentDays = 0
      let absentDays = 0
      let lateDays = 0
      let halfDays = 0
      let totalMinutes = 0

      empLogs.forEach(log => {
        const isHalf = log.status === 'HALF_DAY' || (log.totalMinutes && log.totalMinutes > 0 && log.totalMinutes <= 300)
        if (isHalf) {
          halfDays++
        } else if (log.status === 'PRESENT') {
          presentDays++
        } else if (log.status === 'LATE') {
          presentDays++
          lateDays++
        } else if (log.status === 'ABSENT') {
          absentDays++
        }
        totalMinutes += log.totalMinutes || 0
      })

      const baseSalary = emp.baseSalary || 25000
      const payableDays = presentDays + (halfDays * 0.5)
      const dailyRate = Math.round(baseSalary / daysInMonth)
      const grossEarned = Math.round(dailyRate * payableDays)
      const deductions = 0
      const netSalary = grossEarned

      return {
        employeeId: emp.employeeId || emp.id,
        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        designation: emp.designation || 'Staff',
        department: emp.department?.name || emp.department || 'General',
        branchId: emp.branchId || emp.branch?.id || 'branch-1',
        branchName: emp.branch?.name || emp.branch || 'Hotel Grand Godwin',
        branchPrefix: emp.branch?.prefix || (emp.employeeId?.startsWith('GD') ? 'GD' : 'GG'),
        baseSalary,
        presentDays,
        absentDays,
        lateDays,
        halfDays,
        leaveDays: 0,
        totalMinutes,
        overtimeMinutes: 0,
        overtimeRate: 0,
        overtimeAmount: 0,
        deductions,
        paymentStatus: 'PENDING',
        paymentDate: null,
        daysInMonth,
        payableDays,
        dailyRate,
        grossEarned,
        netSalary
      }
    })

    if (branch && branch !== 'ALL') {
      summary = summary.filter(e => e.branchPrefix === branch || e.branchId === branch)
    }

    if (department && department !== 'ALL') {
      summary = summary.filter(e => e.department.toLowerCase() === department.toLowerCase())
    }

    return NextResponse.json({
      month,
      year,
      summary,
      success: true
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to calculate payroll summary' }, { status: 500 })
  }
}
