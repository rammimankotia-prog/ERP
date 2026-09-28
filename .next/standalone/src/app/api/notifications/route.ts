import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json')
const LOCAL_NOTIFICATIONS_FILE = path.join(LOCAL_DATA_DIR, 'notifications.json')

function readNotifications(): any[] {
  for (const f of [NOTIFICATIONS_FILE, LOCAL_NOTIFICATIONS_FILE]) {
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

function writeNotifications(data: any[]): void {
  for (const f of [NOTIFICATIONS_FILE, LOCAL_NOTIFICATIONS_FILE]) {
    try {
      const dir = path.dirname(f)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error(`Error writing notifications to ${f}:`, err)
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const employeeCode = searchParams.get('employeeCode')

  const all = readNotifications()
  const filtered = (employeeId || employeeCode)
    ? all.filter(n =>
        (employeeId && (n.employeeId === employeeId || n.employeeCode === employeeId || n.userId === employeeId)) ||
        (employeeCode && (n.employeeCode === employeeCode || n.employeeId === employeeCode))
      )
    : all

  // Sort descending by creation date
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const unreadCount = filtered.filter(n => !n.read).length

  return NextResponse.json({
    notifications: filtered,
    unreadCount,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, id, employeeId } = body

    const all = readNotifications()

    if (action === 'MARK_READ') {
      let updated = false
      all.forEach(n => {
        if (id && n.id === id) {
          n.read = true
          updated = true
        } else if (!id && employeeId && (n.employeeId === employeeId || n.employeeCode === employeeId)) {
          n.read = true
          updated = true
        }
      })
      if (updated) {
        writeNotifications(all)
      }
      return NextResponse.json({ success: true, message: 'Notification(s) marked as read' })
    }

    // Direct create notification
    if (body.title && body.employeeId) {
      const newNotif = {
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeId: body.employeeId,
        employeeName: body.employeeName || 'Staff Member',
        type: body.type || 'GENERAL',
        title: body.title,
        message: body.message,
        read: false,
        createdAt: new Date().toISOString(),
        metadata: body.metadata || {},
      }
      all.unshift(newNotif)
      writeNotifications(all)
      return NextResponse.json({ success: true, notification: newNotif }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action or payload' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process notification' }, { status: 500 })
  }
}
