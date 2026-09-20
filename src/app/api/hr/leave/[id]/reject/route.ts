import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

const LEAVES_FILE = path.join(DATA_DIR, 'hr_leaves.json')
const LOCAL_LEAVES_FILE = path.join(LOCAL_DATA_DIR, 'hr_leaves.json')

const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json')
const LOCAL_NOTIFICATIONS_FILE = path.join(LOCAL_DATA_DIR, 'notifications.json')

function readJson<T>(file: string, fallbackFile: string, fallback: T): T {
  for (const f of [file, fallbackFile]) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed !== undefined && parsed !== null) return parsed as unknown as T
      }
    } catch {}
  }
  return fallback
}

function writeJson(file: string, fallbackFile: string, data: any): void {
  for (const f of [file, fallbackFile]) {
    try {
      const dir = path.dirname(f)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error(`Error writing to ${f}:`, err)
    }
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const role = req.headers.get('x-user-role')?.toUpperCase()
  if (role && !['ADMIN', 'MASTER ADMIN', 'MANAGER', 'HR_MANAGER', 'HOD'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let approverId = 'admin'
  let approverNote = 'Rejected by HR / Administration'

  try {
    const body = await req.json()
    if (body.approverId) approverId = body.approverId
    if (body.approverNote) approverNote = body.approverNote
  } catch {}

  let targetLeave: any = null

  try {
    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } })
    if (leaveRequest) {
      targetLeave = leaveRequest
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: 'REJECTED', approverId, approverNote }
      })
      targetLeave = { ...targetLeave, ...updated }

      await prisma.auditTrail.create({
        data: { actorId: approverId || 'system', targetId: id, action: 'LEAVE_REJECT' }
      }).catch(() => {})
    }
  } catch {}

  // Persistent multi-tier storage update
  const { updateLeaveRecord } = await import('@/lib/leaveStorage')
  const updatedRecord = updateLeaveRecord(id, {
    status: 'REJECTED',
    approverId,
    approverNote,
    rejectedAt: new Date().toISOString()
  })

  if (updatedRecord) {
    targetLeave = updatedRecord
  }

  if (targetLeave) {
    const notifications = readJson<any[]>(NOTIFICATIONS_FILE, LOCAL_NOTIFICATIONS_FILE, [])
    notifications.unshift({
      id: `notif-leave-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: targetLeave.employeeId || targetLeave.employeeCode,
      employeeName: targetLeave.employeeName || 'Staff Member',
      type: 'LEAVE_REJECTED',
      title: '⚠️ Leave Request Not Approved',
      message: `Your leave request for ${targetLeave.fromDate} to ${targetLeave.toDate} was not approved. Note: ${approverNote}`,
      read: false,
      createdAt: new Date().toISOString(),
    })
    writeJson(NOTIFICATIONS_FILE, LOCAL_NOTIFICATIONS_FILE, notifications)
  }

  return NextResponse.json({ success: true, updated: targetLeave || { id, status: 'REJECTED' } })
}
