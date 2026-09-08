import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const branchId = searchParams.get('branch')

  try {
    const from = new Date(year, month - 1, 1)
    const to = new Date(year, month, 0) // last day of month

    const logs = await prisma.attendanceLog.findMany({
      where: {
        date: { gte: from, lte: to }
      }
    })

    // Group by employee
    const summaryMap: Record<string, any> = {}
    for (const log of logs) {
      if (!summaryMap[log.employeeId]) {
        summaryMap[log.employeeId] = {
          employeeId: log.employeeId,
          presentDays: 0,
          absentDays: 0,
          lateDays: 0,
          halfDays: 0,
          leaveDays: 0,
          totalMinutes: 0,
          overtimeMinutes: 0
        }
      }
      const s = summaryMap[log.employeeId]
      if (log.status === 'PRESENT') s.presentDays++
      if (log.status === 'ABSENT') s.absentDays++
      if (log.status === 'LATE') { s.presentDays++; s.lateDays++ }
      if (log.status === 'HALF_DAY') s.halfDays++
      if (log.status === 'ON_LEAVE') s.leaveDays++
      s.totalMinutes += log.totalMinutes || 0
      s.overtimeMinutes += log.overtimeMinutes || 0
    }

    const summary = Object.values(summaryMap)
    return NextResponse.json({ month, year, summary })
  } catch {
    // Mock payroll data
    return NextResponse.json({
      month, year,
      summary: [
        { employeeId: 'GG-1001', employeeName: 'Raman Mankotia', designation: 'General Manager', presentDays: 22, absentDays: 1, lateDays: 2, halfDays: 0, leaveDays: 3, totalMinutes: 10560, overtimeMinutes: 480, grossOT: 1, deductions: 0 },
        { employeeId: 'GG-1002', employeeName: 'Priya Sharma', designation: 'Front Desk Manager', presentDays: 20, absentDays: 2, lateDays: 3, halfDays: 1, leaveDays: 3, totalMinutes: 9600, overtimeMinutes: 0, grossOT: 0, deductions: 1 },
        { employeeId: 'GD-1001', employeeName: 'Rajiv Kumar', designation: 'Housekeeping Supervisor', presentDays: 23, absentDays: 0, lateDays: 0, halfDays: 0, leaveDays: 3, totalMinutes: 11040, overtimeMinutes: 960, grossOT: 2, deductions: 0 },
      ],
      _mock: true
    })
  }
}
