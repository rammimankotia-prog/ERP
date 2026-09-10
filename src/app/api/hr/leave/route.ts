import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LEAVES_FILE = path.join(DATA_DIR, 'hr_leaves.json')
const LOCAL_LEAVES_FILE = path.join(process.cwd(), 'data', 'hr_leaves.json')

function readLeaves(): any[] {
  for (const f of [LEAVES_FILE, LOCAL_LEAVES_FILE]) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf-8')
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {}
  }
  return []
}

function writeLeaves(leaves: any[]) {
  try {
    const dir = path.dirname(LEAVES_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(LEAVES_FILE, JSON.stringify(leaves, null, 2), 'utf-8')

    if (LEAVES_FILE !== LOCAL_LEAVES_FILE && fs.existsSync(path.dirname(LOCAL_LEAVES_FILE))) {
      fs.writeFileSync(LOCAL_LEAVES_FILE, JSON.stringify(leaves, null, 2), 'utf-8')
    }
  } catch (err) {
    console.error('Error saving leaves:', err)
  }
}

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
    if (requests && requests.length > 0) {
      return NextResponse.json({ requests })
    }
  } catch {}

  // Persistent JSON file operations
  const allRequests = readLeaves()
  const filtered = allRequests.filter(r => {
    if (employeeId && r.employeeId !== employeeId && r.employeeCode !== employeeId) return false
    if (status && r.status !== status) return false
    return true
  })

  return NextResponse.json({
    requests: filtered
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, employeeName, designation, leaveTypeId, leaveTypeName, fromDate, toDate, reason } = body

    if (!employeeId || !fromDate || !toDate || !reason) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const from = new Date(fromDate)
    const to = new Date(toDate)
    const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    // Check DB first
    try {
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

      const created = await prisma.leaveRequest.create({
        data: {
          employeeId,
          leaveTypeId: leaveTypeId || 'lt-casual',
          fromDate: from,
          toDate: to,
          totalDays,
          reason,
          status: 'PENDING'
        }
      })
      return NextResponse.json({ success: true, request: created }, { status: 201 })
    } catch {}

    // Persistent JSON file save
    const allRequests = readLeaves()
    const isOverlapping = allRequests.some(r =>
      (r.employeeId === employeeId || r.employeeCode === employeeId) &&
      ['PENDING', 'APPROVED'].includes(r.status) &&
      new Date(r.fromDate) <= to && new Date(r.toDate) >= from
    )

    if (isOverlapping) {
      return NextResponse.json({ error: 'OVERLAP_DETECTED', message: 'A leave request already exists for this date range.' }, { status: 409 })
    }

    const newLeave = {
      id: `leave-${Date.now()}`,
      employeeId,
      employeeName: employeeName || 'Employee',
      designation: designation || 'Staff',
      leaveType: {
        name: leaveTypeName || 'Casual Leave',
        category: 'CASUAL'
      },
      fromDate,
      toDate,
      totalDays,
      reason,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    }

    allRequests.unshift(newLeave)
    writeLeaves(allRequests)

    return NextResponse.json({ success: true, request: newLeave }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to submit leave request' }, { status: 500 })
  }
}
