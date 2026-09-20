import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { sendLeaveApprovalEmail } from '@/lib/email'

const prisma = new PrismaClient()

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

const LEAVES_FILE = path.join(DATA_DIR, 'hr_leaves.json')
const LOCAL_LEAVES_FILE = path.join(LOCAL_DATA_DIR, 'hr_leaves.json')

const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(LOCAL_DATA_DIR, 'hr_employees.json')

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
  let approverNote = 'Approved by HR / Administration'

  try {
    const body = await req.json()
    if (body.approverId) approverId = body.approverId
    if (body.approverNote) approverNote = body.approverNote
  } catch {}

  let targetLeave: any = null

  // 1. Try DB update
  try {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: true }
    })
    if (leaveRequest) {
      targetLeave = leaveRequest
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: 'APPROVED', approverId, approverNote, approvedAt: new Date() }
      })
      targetLeave = { ...targetLeave, ...updated }

      // Deduct balance
      await prisma.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year: new Date().getFullYear()
        },
        data: {
          usedDays: { increment: leaveRequest.totalDays },
          remainingDays: { decrement: leaveRequest.totalDays }
        }
      }).catch(() => {})

      // Attendance ON_LEAVE records
      const from = new Date(leaveRequest.fromDate)
      const to = new Date(leaveRequest.toDate)
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const day = new Date(d)
        day.setHours(0, 0, 0, 0)
        await prisma.attendanceLog.upsert({
          where: { employeeId_date: { employeeId: leaveRequest.employeeId, date: day } },
          create: { employeeId: leaveRequest.employeeId, date: day, status: 'ON_LEAVE' },
          update: { status: 'ON_LEAVE' }
        }).catch(() => {})
      }

      await prisma.auditTrail.create({
        data: { actorId: approverId || 'system', targetId: id, action: 'LEAVE_APPROVE' }
      }).catch(() => {})
    }
  } catch {}

  // 2. Always update persistent JSON file storage
  const allLeaves = readJson<any[]>(LEAVES_FILE, LOCAL_LEAVES_FILE, [])
  const idx = allLeaves.findIndex(l => l.id === id)
  if (idx !== -1) {
    allLeaves[idx] = {
      ...allLeaves[idx],
      status: 'APPROVED',
      approverId,
      approverNote,
      approvedAt: new Date().toISOString(),
    }
    targetLeave = allLeaves[idx]
    writeJson(LEAVES_FILE, LOCAL_LEAVES_FILE, allLeaves)
  } else if (targetLeave) {
    allLeaves.unshift(targetLeave)
    writeJson(LEAVES_FILE, LOCAL_LEAVES_FILE, allLeaves)
  }

  if (!targetLeave) {
    targetLeave = { id, status: 'APPROVED', fromDate: new Date().toISOString(), toDate: new Date().toISOString() }
  }

  // 3. Find Employee contact details for Notification & Email
  const employees = readJson<any[]>(EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, [])
  const empId = targetLeave.employeeId || targetLeave.employeeCode
  const emp = employees.find(e => e.id === empId || e.employeeId === empId)

  const empName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (targetLeave.employeeName || 'Staff Member')
  const empEmail = emp?.email || targetLeave.email
  const fromDateStr = targetLeave.fromDate ? String(targetLeave.fromDate).slice(0, 10) : ''
  const toDateStr = targetLeave.toDate ? String(targetLeave.toDate).slice(0, 10) : ''
  const leaveTypeName = targetLeave.leaveTypeName || targetLeave.leaveType?.name || 'Leave'

  // 4. Create In-App Notification in notifications.json
  const notifications = readJson<any[]>(NOTIFICATIONS_FILE, LOCAL_NOTIFICATIONS_FILE, [])
  const newNotification = {
    id: `notif-leave-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    employeeId: empId,
    employeeCode: emp?.employeeId || targetLeave.employeeCode || empId,
    employeeName: empName,
    type: 'LEAVE_APPROVED',
    title: '🌴 Leave Request Approved!',
    message: `Your leave request for ${fromDateStr} to ${toDateStr} (${leaveTypeName}) has been APPROVED by Management.`,
    fromDate: fromDateStr,
    toDate: toDateStr,
    leaveType: leaveTypeName,
    approverNote,
    read: false,
    createdAt: new Date().toISOString(),
    metadata: {
      leaveId: id,
      approverId,
      approverNote,
    }
  }

  notifications.unshift(newNotification)
  writeJson(NOTIFICATIONS_FILE, LOCAL_NOTIFICATIONS_FILE, notifications)

  // 5. Send Professional Email Notification (Non-blocking)
  if (empEmail) {
    sendLeaveApprovalEmail({
      to: empEmail,
      name: empName,
      employeeId: emp?.employeeId || empId || 'Staff',
      fromDate: fromDateStr,
      toDate: toDateStr,
      leaveType: leaveTypeName,
      approverNote,
    }).catch(err => {
      console.error('Error dispatching leave approval email:', err)
    })
  }

  return NextResponse.json({
    success: true,
    message: 'Leave approved and notification sent successfully',
    updated: targetLeave,
    notification: newNotification,
  })
}
