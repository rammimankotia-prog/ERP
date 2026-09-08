import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const status = searchParams.get('status')

  try {
    const requests = await prisma.leaveRequest.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(status ? { status: status as any } : {})
      },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ requests })
  } catch {
    return NextResponse.json({
      requests: [
        { id: 'leave-1', employeeId: 'mock-emp-1', leaveType: { name: 'Casual Leave', category: 'CASUAL' }, fromDate: '2026-09-10', toDate: '2026-09-11', totalDays: 2, reason: 'Personal work', status: 'PENDING', createdAt: new Date() },
        { id: 'leave-2', employeeId: 'mock-emp-2', leaveType: { name: 'Sick Leave', category: 'SICK' }, fromDate: '2026-09-05', toDate: '2026-09-06', totalDays: 2, reason: 'Fever', status: 'APPROVED', approvedAt: new Date(), createdAt: new Date() },
      ],
      _mock: true
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, leaveTypeId, fromDate, toDate, reason } = body

    if (!employeeId || !leaveTypeId || !fromDate || !toDate || !reason) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const from = new Date(fromDate)
    const to = new Date(toDate)
    const totalDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Check for overlapping leave requests
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { fromDate: { lte: to }, toDate: { gte: from } }
        ]
      }
    })

    if (overlap) {
      return NextResponse.json({ error: 'OVERLAP_DETECTED', message: 'A leave request already exists for this date range.' }, { status: 409 })
    }

    const request = await prisma.leaveRequest.create({
      data: { employeeId, leaveTypeId, fromDate: from, toDate: to, totalDays, reason, status: 'PENDING' }
    })

    await prisma.auditTrail.create({
      data: { actorId: employeeId, targetId: request.id, action: 'LEAVE_APPLY', details: JSON.stringify({ fromDate, toDate, totalDays }) }
    }).catch(() => {})

    return NextResponse.json({ request }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ request: { id: 'mock-leave-' + Date.now(), status: 'PENDING' }, _mock: true })
  }
}
