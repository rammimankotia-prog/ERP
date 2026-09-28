import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getMergedLeaves, saveLeaveRecord, saveAllLeaves, LeaveRecord } from '@/lib/leaveStorage'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const status = searchParams.get('status')

  // 1. Get all records from multi-tier persistent storage (JSON, backup, vault, journal)
  const persistentRequests = getMergedLeaves()

  // 2. Try DB records as additional source
  let dbRequests: any[] = []
  try {
    const list = await prisma.leaveRequest.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(status ? { status: status as any } : {})
      },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' }
    })
    if (list && Array.isArray(list)) {
      dbRequests = list
    }
  } catch {}

  // 3. Merge both sources by ID
  const map = new Map<string, any>()
  for (const r of persistentRequests) {
    if (r && r.id) map.set(String(r.id), r)
  }
  for (const r of dbRequests) {
    if (r && r.id && !map.has(String(r.id))) {
      map.set(String(r.id), r)
    }
  }

  let allRequests = Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || a.fromDate).getTime() || 0
    const timeB = new Date(b.createdAt || b.fromDate).getTime() || 0
    return timeB - timeA
  })

  // Filter if needed
  if (employeeId) {
    const cleanEmp = employeeId.trim().toLowerCase()
    allRequests = allRequests.filter(r => {
      const eId = (r.employeeId || '').trim().toLowerCase()
      const eCode = (r.employeeCode || '').trim().toLowerCase()
      return eId === cleanEmp || eCode === cleanEmp
    })
  }

  if (status) {
    const cleanStatus = status.trim().toUpperCase()
    allRequests = allRequests.filter(r => (r.status || '').trim().toUpperCase() === cleanStatus)
  }

  return NextResponse.json({
    requests: allRequests
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Support client-side batch synchronization
    if (body.action === 'SYNC' && Array.isArray(body.requests)) {
      const existing = getMergedLeaves()
      const existingMap = new Map<string, LeaveRecord>()
      existing.forEach(r => existingMap.set(String(r.id), r))

      for (const r of body.requests) {
        if (r && r.id && !existingMap.has(String(r.id))) {
          existingMap.set(String(r.id), r)
        }
      }

      const merged = Array.from(existingMap.values())
      saveAllLeaves(merged)
      return NextResponse.json({ success: true, count: merged.length, requests: merged })
    }

    const { employeeId, employeeName, designation, leaveTypeId, leaveTypeName, fromDate, toDate, reason } = body

    if (!employeeId || !fromDate || !toDate || !reason) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const from = new Date(fromDate)
    const to = new Date(toDate)
    const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    // Check DB overlap if DB is available
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
    } catch {}

    // Check overlap in multi-tier persistent storage
    const allRequests = getMergedLeaves()
    const cleanEmp = employeeId.trim().toLowerCase()
    const isOverlapping = allRequests.some(r => {
      const eId = (r.employeeId || '').trim().toLowerCase()
      const eCode = (r.employeeCode || '').trim().toLowerCase()
      if (eId !== cleanEmp && eCode !== cleanEmp) return false
      if (!['PENDING', 'APPROVED'].includes((r.status || '').toUpperCase())) return false
      const rFrom = new Date(r.fromDate)
      const rTo = new Date(r.toDate)
      return rFrom <= to && rTo >= from
    })

    if (isOverlapping) {
      return NextResponse.json({ error: 'OVERLAP_DETECTED', message: 'A leave request already exists for this date range.' }, { status: 409 })
    }

    const newLeave: LeaveRecord = {
      id: `leave-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId,
      employeeName: employeeName || 'Employee',
      designation: designation || 'Staff',
      leaveType: {
        id: leaveTypeId || 'lt-1',
        name: leaveTypeName || 'Casual Leave',
        category: 'CASUAL'
      },
      leaveTypeId: leaveTypeId || 'lt-1',
      leaveTypeName: leaveTypeName || 'Casual Leave',
      fromDate,
      toDate,
      totalDays,
      reason,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    }

    // Always save to multi-tier persistent vaults & backup
    saveLeaveRecord(newLeave)

    // Attempt DB record creation in background
    try {
      await prisma.leaveRequest.create({
        data: {
          id: newLeave.id,
          employeeId,
          leaveTypeId: leaveTypeId || 'lt-casual',
          fromDate: from,
          toDate: to,
          totalDays,
          reason,
          status: 'PENDING'
        }
      })
    } catch {}

    return NextResponse.json({ success: true, request: newLeave }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to submit leave request' }, { status: 500 })
  }
}

