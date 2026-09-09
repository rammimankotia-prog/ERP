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
    const allMockRequests = [
      {
        id: 'leave-2',
        employeeId: 'e2',
        employeeName: 'Priya Sharma',
        designation: 'Front Desk Executive',
        leaveType: { name: 'Sick Leave', category: 'SICK' },
        fromDate: '2026-09-05',
        toDate: '2026-09-06',
        totalDays: 2,
        reason: 'Viral Fever & Medical Rest',
        status: 'APPROVED',
        approvedAt: '2026-09-04T10:00:00.000Z',
        createdAt: '2026-09-04T09:00:00.000Z'
      },
      {
        id: 'leave-3',
        employeeId: 'e3',
        employeeName: 'Rajiv Kumar',
        designation: 'Housekeeping Supervisor',
        leaveType: { name: 'Casual Leave', category: 'CASUAL' },
        fromDate: '2026-09-09',
        toDate: '2026-09-10',
        totalDays: 2,
        reason: 'Urgent Family Work at Village',
        status: 'APPROVED',
        approvedAt: '2026-09-08T11:30:00.000Z',
        createdAt: '2026-09-08T08:00:00.000Z'
      },
      {
        id: 'leave-4',
        employeeId: 'e4',
        employeeName: 'Sunita Verma',
        designation: 'Security Officer',
        leaveType: { name: 'Earned Leave', category: 'EARNED' },
        fromDate: '2026-09-09',
        toDate: '2026-09-11',
        totalDays: 3,
        reason: 'Attending Sister Wedding Out of Town',
        status: 'APPROVED',
        approvedAt: '2026-09-07T14:00:00.000Z',
        createdAt: '2026-09-07T10:00:00.000Z'
      },
      {
        id: 'leave-5',
        employeeId: 'e5',
        employeeName: 'Amit Singh',
        designation: 'Accounts Executive',
        leaveType: { name: 'Casual Leave', category: 'CASUAL' },
        fromDate: '2026-09-14',
        toDate: '2026-09-15',
        totalDays: 2,
        reason: 'Personal Bank & Government Documentation',
        status: 'APPROVED',
        approvedAt: '2026-09-12T16:00:00.000Z',
        createdAt: '2026-09-12T11:00:00.000Z'
      },
      {
        id: 'leave-1',
        employeeId: 'e1',
        employeeName: 'Raman Mankotia',
        designation: 'General Manager',
        leaveType: { name: 'Casual Leave', category: 'CASUAL' },
        fromDate: '2026-09-24',
        toDate: '2026-09-25',
        totalDays: 2,
        reason: 'Hotel Operations Conference & Personal Work',
        status: 'PENDING',
        createdAt: '2026-09-09T09:30:00.000Z'
      },
    ]

    const filtered = allMockRequests.filter(r => {
      if (employeeId && r.employeeId !== employeeId) return false
      if (status && r.status !== status) return false
      return true
    })

    return NextResponse.json({
      requests: filtered,
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
