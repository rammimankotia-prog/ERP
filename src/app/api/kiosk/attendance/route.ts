import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { getMergedAttendance } from '@/lib/attendanceStorage'

const prisma = new PrismaClient()
const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')
const ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance.json')
const LOCAL_ATTENDANCE_FILE = path.join(LOCAL_DATA_DIR, 'hr_attendance.json')

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

// GET /api/kiosk/attendance?employeeId=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
  }

  try {
    let logs: any[] = []
    try {
      const dbLogs = await prisma.attendanceLog.findMany({
        where: {
          employeeId: employeeId
        },
        orderBy: {
          date: 'desc'
        },
        take: 30
      })
      if (dbLogs && dbLogs.length > 0) {
        logs = dbLogs.map(l => ({
          ...l,
          date: l.date instanceof Date ? l.date.toISOString().split('T')[0] : String(l.date).slice(0, 10)
        }))
      }
    } catch (dbErr) {
      // DB failed, fallback to JSON
    }

    const allAttendance = getMergedAttendance()
    const targetId = employeeId.trim().toUpperCase()
    const jsonLogs = allAttendance.filter(a => (a.employeeId || '').trim().toUpperCase() === targetId)

    // Merge JSON logs into DB logs
    jsonLogs.forEach(jl => {
      const jDate = jl.date || (jl.punchIn ? jl.punchIn.slice(0, 10) : '')
      const idx = logs.findIndex(l => (l.date === jDate || (l.punchIn && l.punchIn.slice(0, 10) === jDate)))
      if (idx === -1) {
        logs.push({ ...jl, date: jDate })
      } else {
        logs[idx] = {
          ...logs[idx],
          ...jl,
          punchIn: jl.punchIn || logs[idx].punchIn || null,
          punchOut: jl.punchOut || logs[idx].punchOut || null,
          totalMinutes: jl.totalMinutes !== undefined && jl.totalMinutes !== null ? jl.totalMinutes : logs[idx].totalMinutes,
        }
      }
    })

    // Sort by date descending and take last 30
    logs.sort((a, b) => new Date(b.date || b.punchIn || 0).getTime() - new Date(a.date || a.punchIn || 0).getTime())
    logs = logs.slice(0, 30)

    return NextResponse.json({ logs })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch attendance history' }, { status: 500 })
  }
}
