import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(LOCAL_DATA_DIR, 'hr_employees.json')
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

// GET /api/hr/attendance?date=2024-05-15
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]

  try {
    const employees = readJson<any[]>(EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, [])
    const allAttendance = readJson<any[]>(ATTENDANCE_FILE, LOCAL_ATTENDANCE_FILE, [])

    const todayAttendance = allAttendance.filter(a => a.date === dateStr)

    // Combine employees with their attendance
    const teamAttendance = employees.map(emp => {
      const record = todayAttendance.find(a => a.employeeId === emp.employeeId || a.employeeId === emp.id)
      return {
        employeeId: emp.employeeId || emp.id,
        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        department: emp.department?.name || emp.departmentId || 'Unassigned',
        designation: emp.designation || 'Staff',
        status: record ? record.status : 'ABSENT', // Default absent if no punch in
        punchIn: record ? record.punchIn : null,
        punchOut: record ? record.punchOut : null,
        totalMinutes: record ? record.totalMinutes : null,
        punchInMode: record ? record.punchInMode : null
      }
    })

    return NextResponse.json({ date: dateStr, logs: teamAttendance })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500 })
  }
}
