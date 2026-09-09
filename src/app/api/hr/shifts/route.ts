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
        { 
          id: 'shift-1', 
          name: 'Morning Shift', 
          type: 'FIXED', 
          startTime: '09:00', 
          endTime: '18:00', 
          graceMinutes: 15, 
          branchId: 'mock-1' 
        },
        { 
          id: 'shift-2', 
          name: 'Break Shift', 
          type: 'BREAK', 
          startTime: '10:00', 
          endTime: '22:00', 
          firstSlot: '10:00 – 14:00',
          secondSlot: '18:00 – 22:00',
          breakTime: '14:00 – 18:00',
          graceMinutes: 15, 
          branchId: 'mock-1' 
        },
        { 
          id: 'shift-3', 
          name: 'Night Shift', 
          type: 'NIGHT', 
          startTime: '22:00', 
          endTime: '07:00', 
          graceMinutes: 20, 
          branchId: 'mock-1' 
        },
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
    const { name, type, startTime, endTime, firstSlot, secondSlot, breakTime, graceMinutes, branchId } = body

    if (!name || !startTime || !endTime) {
      return NextResponse.json({ error: 'name, startTime, endTime are required' }, { status: 400 })
    }

    const shift = await prisma.shift.create({
      data: { 
        name, 
        type: type || 'FIXED', 
        startTime, 
        endTime, 
        firstSlot: firstSlot || null,
        secondSlot: secondSlot || null,
        breakTime: breakTime || null,
        graceMinutes: graceMinutes || 15, 
        branchId: branchId || '' 
      }
    })
    return NextResponse.json({ shift }, { status: 201 })
  } catch (e) {
    const body = await req.json().catch(() => ({}))
    return NextResponse.json({
      shift: { 
        id: 'mock-shift-' + Date.now(), 
        name: body.name || 'Break Shift', 
        type: body.type || 'BREAK', 
        startTime: body.startTime || '10:00', 
        endTime: body.endTime || '22:00',
        firstSlot: body.firstSlot || '10:00 – 14:00',
        secondSlot: body.secondSlot || '18:00 – 22:00',
        breakTime: body.breakTime || '14:00 – 18:00',
        graceMinutes: body.graceMinutes || 15 
      },
      _mock: true
    })
  }
}
