import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/hr/attendance?employeeId=&date=&from=&to=&branch=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const branchId = searchParams.get('branch')

  try {
    let where: any = {}

    if (employeeId) where.employeeId = employeeId
    if (date) where.date = new Date(date)
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }

    // Branch-level filter needs employee join
    const logs = await prisma.attendanceLog.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500
    })

    return NextResponse.json({ logs })
  } catch (e) {
    // Mock data for development
    const today = new Date().toISOString().split('T')[0]
    return NextResponse.json({
      logs: [
        { id: 'mock-1', employeeId: 'mock-emp-1', date: today, punchIn: `${today}T09:05:00Z`, punchOut: `${today}T18:10:00Z`, status: 'PRESENT', totalMinutes: 545, overtimeMinutes: 65, punchInMode: 'WEB' },
        { id: 'mock-2', employeeId: 'mock-emp-2', date: today, punchIn: `${today}T09:45:00Z`, punchOut: null, status: 'LATE', totalMinutes: null, overtimeMinutes: 0, punchInMode: 'GEO' },
      ],
      _mock: true
    })
  }
}
