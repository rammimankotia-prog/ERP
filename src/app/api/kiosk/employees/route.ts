import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const ATTENDANCE_FILE = path.join(DATA_DIR, 'hr_attendance.json')

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch {}
  return fallback
}

export async function GET() {
  try {
    const employees = readJson<any[]>(EMPLOYEES_FILE, [])
    const allAttendance = readJson<any[]>(ATTENDANCE_FILE, [])
    const dateStr = new Date().toISOString().split('T')[0]

    const activeList = employees
      .filter(e => e.status === 'ACTIVE' || !e.status)
      .map(emp => {
        const todayRecord = allAttendance.find(
          a => (a.employeeId === emp.id || a.employeeId === emp.employeeId) && a.date === dateStr
        )
        return {
          id: emp.id,
          employeeId: emp.employeeId || emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          contactNo: emp.contactNo,
          designation: emp.designation || 'Staff',
          department: emp.department?.name || emp.departmentId || 'General',
          branch: emp.branch?.name || emp.branchId || 'Hotel Grand Godwin',
          morningTime: emp.morningTime || '09:00',
          eveningTime: emp.eveningTime || '18:00',
          photo: emp.photo || null,
          gender: emp.gender || 'Male',
          checkedIn: !!(todayRecord && todayRecord.punchIn),
          checkedOut: !!(todayRecord && todayRecord.punchOut),
          punchInTime: todayRecord?.punchIn || null,
          punchOutTime: todayRecord?.punchOut || null,
        }
      })

    return NextResponse.json({ success: true, employees: activeList })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch kiosk employees' }, { status: 500 })
  }
}
