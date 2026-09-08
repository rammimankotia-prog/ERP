import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    const shifts = await prisma.shift.findMany({
      include: { assignments: true },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json({ shifts })
  } catch {
    return NextResponse.json({
      shifts: [
        { id: 'shift-1', name: 'Morning Shift', type: 'FIXED', startTime: '09:00', endTime: '18:00', graceMinutes: 15, branchId: 'mock-1' },
        { id: 'shift-2', name: 'Evening Shift', type: 'FIXED', startTime: '14:00', endTime: '23:00', graceMinutes: 15, branchId: 'mock-1' },
        { id: 'shift-3', name: 'Night Shift', type: 'NIGHT', startTime: '22:00', endTime: '07:00', graceMinutes: 20, branchId: 'mock-1' },
      ],
      _mock: true
    })
  }
}

export async function POST(req: NextRequest) {
  // RBAC check
  const role = req.headers.get('x-user-role')
  if (role && !['ADMIN', 'HR_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, type, startTime, endTime, graceMinutes, branchId } = body

    if (!name || !startTime || !endTime) {
      return NextResponse.json({ error: 'name, startTime, endTime are required' }, { status: 400 })
    }

    const shift = await prisma.shift.create({
      data: { name, type: type || 'FIXED', startTime, endTime, graceMinutes: graceMinutes || 15, branchId: branchId || '' }
    })
    return NextResponse.json({ shift }, { status: 201 })
  } catch (e) {
    return NextResponse.json({
      shift: { id: 'mock-shift-' + Date.now(), name: 'Mock Shift', type: 'FIXED', startTime: '09:00', endTime: '18:00', graceMinutes: 15 },
      _mock: true
    })
  }
}
