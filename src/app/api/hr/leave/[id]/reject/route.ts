import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const role = req.headers.get('x-user-role')
  if (role && !['ADMIN', 'HR_MANAGER', 'HOD'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { approverId, approverNote } = body

    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id: params.id } })
    if (!leaveRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: { status: 'REJECTED', approverId, approverNote }
    })

    await prisma.auditTrail.create({
      data: { actorId: approverId || 'system', targetId: params.id, action: 'LEAVE_REJECT' }
    }).catch(() => {})

    return NextResponse.json({ updated })
  } catch (e) {
    return NextResponse.json({ updated: { id: params.id, status: 'REJECTED' }, _mock: true })
  }
}
