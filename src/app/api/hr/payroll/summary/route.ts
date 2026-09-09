import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MOCK_PAYROLL_DATA = [
  {
    employeeId: 'GG-1001',
    employeeName: 'Raman Mankotia',
    designation: 'General Manager',
    department: 'Operations',
    branchId: 'mock-1',
    branchName: 'Hotel Grand Godwin',
    branchPrefix: 'GG',
    baseSalary: 65000,
    presentDays: 24,
    absentDays: 0,
    lateDays: 1,
    halfDays: 0,
    leaveDays: 2, // Paid Leave
    totalMinutes: 11520, // 192 hrs
    overtimeMinutes: 480, // 8 hrs
    overtimeRate: 500, // per hour
    overtimeAmount: 6000, // 8 hrs * 500 * 1.5
    deductions: 0,
    paymentStatus: 'PAID',
    paymentDate: '2026-09-05'
  },
  {
    employeeId: 'GG-1002',
    employeeName: 'Priya Sharma',
    designation: 'Front Desk Executive',
    department: 'Front Office',
    branchId: 'mock-1',
    branchName: 'Hotel Grand Godwin',
    branchPrefix: 'GG',
    baseSalary: 28000,
    presentDays: 21,
    absentDays: 1,
    lateDays: 3,
    halfDays: 1,
    leaveDays: 2, // Paid Leave
    totalMinutes: 9840, // 164 hrs
    overtimeMinutes: 240, // 4 hrs
    overtimeRate: 200,
    overtimeAmount: 1200,
    deductions: 1400, // 1 day LOP + late penalty
    paymentStatus: 'PROCESSED',
    paymentDate: null
  },
  {
    employeeId: 'GD-1001',
    employeeName: 'Rajiv Kumar',
    designation: 'Housekeeping Supervisor',
    department: 'Housekeeping',
    branchId: 'mock-2',
    branchName: 'Hotel Godwin Deluxe',
    branchPrefix: 'GD',
    baseSalary: 24000,
    presentDays: 23,
    absentDays: 0,
    lateDays: 0,
    halfDays: 0,
    leaveDays: 2, // Paid Leave
    totalMinutes: 11040, // 184 hrs
    overtimeMinutes: 720, // 12 hrs
    overtimeRate: 180,
    overtimeAmount: 3240,
    deductions: 0,
    paymentStatus: 'PROCESSED',
    paymentDate: null
  },
  {
    employeeId: 'GD-1002',
    employeeName: 'Sunita Verma',
    designation: 'Security Officer',
    department: 'Security',
    branchId: 'mock-2',
    branchName: 'Hotel Godwin Deluxe',
    branchPrefix: 'GD',
    baseSalary: 22000,
    presentDays: 20,
    absentDays: 1,
    lateDays: 2,
    halfDays: 0,
    leaveDays: 3, // Paid Leave
    totalMinutes: 9600,
    overtimeMinutes: 360, // 6 hrs
    overtimeRate: 160,
    overtimeAmount: 1440,
    deductions: 1100, // 1 day LOP
    paymentStatus: 'PENDING',
    paymentDate: null
  },
  {
    employeeId: 'GG-1003',
    employeeName: 'Amit Singh',
    designation: 'Accounts Executive',
    department: 'Accounts',
    branchId: 'mock-1',
    branchName: 'Hotel Grand Godwin',
    branchPrefix: 'GG',
    baseSalary: 30000,
    presentDays: 23,
    absentDays: 0,
    lateDays: 1,
    halfDays: 0,
    leaveDays: 2,
    totalMinutes: 10800,
    overtimeMinutes: 300, // 5 hrs
    overtimeRate: 220,
    overtimeAmount: 1650,
    deductions: 0,
    paymentStatus: 'PAID',
    paymentDate: '2026-09-05'
  }
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const branch = searchParams.get('branch')
  const department = searchParams.get('department')

  try {
    const from = new Date(year, month - 1, 1)
    const to = new Date(year, month, 0)

    const logs = await prisma.attendanceLog.findMany({
      where: {
        date: { gte: from, lte: to }
      }
    })

    if (!logs || logs.length === 0) {
      throw new Error('Fallback to comprehensive mock')
    }

    // Group by employee if logs exist
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
    // Return comprehensive Hotel Grand Godwin & Godwin Deluxe payroll
    const daysInMonth = new Date(year, month, 0).getDate()

    let filtered = MOCK_PAYROLL_DATA.map(emp => {
      // Calculate payable days: present + leave + (halfDays * 0.5)
      const payableDays = emp.presentDays + emp.leaveDays + (emp.halfDays * 0.5)
      const dailyRate = Math.round(emp.baseSalary / daysInMonth)
      const grossEarned = Math.round(dailyRate * payableDays) + emp.overtimeAmount
      const netSalary = Math.max(0, grossEarned - emp.deductions)

      return {
        ...emp,
        daysInMonth,
        payableDays,
        dailyRate,
        grossEarned,
        netSalary
      }
    })

    if (branch && branch !== 'ALL') {
      filtered = filtered.filter(e => e.branchPrefix === branch || e.branchId === branch)
    }

    if (department && department !== 'ALL') {
      filtered = filtered.filter(e => e.department.toLowerCase() === department.toLowerCase())
    }

    return NextResponse.json({
      month,
      year,
      summary: filtered,
      _mock: true
    })
  }
}

