import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

import { parseTimeToISTMinutes } from '@/app/api/hr/reports/route'
import { getMergedAttendance } from '@/lib/attendanceStorage'

const prisma = new PrismaClient()

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(LOCAL_DATA_DIR, 'hr_employees.json')
const BACKUP_EMPLOYEES_FILE = path.join(LOCAL_DATA_DIR, 'hr_employees_backup.json')
const DELETED_EMP_FILE = path.join(LOCAL_DATA_DIR, 'deleted_employees.json')

function getDeletedEmpKeys(): string[] {
  try {
    if (fs.existsSync(DELETED_EMP_FILE)) {
      const raw = fs.readFileSync(DELETED_EMP_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((k: any) => String(k).toLowerCase().trim())
    }
  } catch {}
  return []
}

/**
 * Get employees: Prisma DB first (same source as /hr/employees page),
 * fall back to JSON files if Prisma unavailable.
 * Deleted employees are always excluded.
 */
async function getActiveEmployees(): Promise<any[]> {
  const deletedKeys = getDeletedEmpKeys()

  const isDeleted = (emp: any): boolean => {
    const id = (emp.id || '').toLowerCase().trim()
    const empId = (emp.employeeId || '').toLowerCase().trim()
    const email = (emp.email || '').toLowerCase().trim()
    return (
      (id && deletedKeys.includes(id)) ||
      (empId && deletedKeys.includes(empId)) ||
      (email && deletedKeys.includes(email))
    )
  }

  // 1. Try Prisma first (same source as Employee Directory page)
  try {
    const dbEmployees = await prisma.employee.findMany({
      include: { branch: true, department: true },
      orderBy: { firstName: 'asc' },
    })
    if (dbEmployees && dbEmployees.length > 0) {
      return dbEmployees
        .filter((e: any) => !isDeleted(e))
        .map((e: any) => ({
          id: e.id,
          employeeId: e.employeeId || e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          designation: e.designation,
          department: e.department,
          departmentId: e.departmentId,
          branch: e.branch,
          branchId: e.branchId,
          morningTime: e.morningTime || '09:00',
          eveningTime: e.eveningTime || '18:00',
          status: e.status,
          offDays: e.offDays || [],
        }))
    }
  } catch {
    // Prisma unavailable → fall back to JSON
  }

  // 2. Fallback: read from JSON files (merged, deduplicated)
  const map = new Map<string, any>()
  for (const f of [BACKUP_EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, EMPLOYEES_FILE]) {
    try {
      if (fs.existsSync(f)) {
        const list = JSON.parse(fs.readFileSync(f, 'utf-8'))
        if (Array.isArray(list)) {
          for (const emp of list) {
            const key = emp.employeeId || emp.id
            if (!key || isDeleted(emp)) continue
            if (!map.has(key)) map.set(key, emp)
          }
        }
      }
    } catch {}
  }
  return Array.from(map.values())
}

// GET /api/hr/attendance?date=2024-05-15
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]

  try {
    const employees = await getActiveEmployees()
    const allAttendance = getMergedAttendance()

    const todayAttendance = allAttendance.filter(a => a.date === dateStr)

    // Combine employees with their attendance
    const teamAttendance = employees.map(emp => {
      const empIdNorm = (emp.employeeId || emp.id || '').trim().toUpperCase()
      const record = todayAttendance.find(a => {
        const aIdNorm = (a.employeeId || '').trim().toUpperCase()
        return aIdNorm === empIdNorm || (emp.id && aIdNorm === emp.id.trim().toUpperCase())
      })
      let status = record ? record.status : 'ABSENT'

      // Late arrival check
      let isLate = false
      let lateMinutes = 0
      if (record && record.punchIn) {
        const shiftInMinutes = parseTimeToISTMinutes(emp.morningTime || '09:00')
        const punchInMinutes = parseTimeToISTMinutes(record.punchIn)
        lateMinutes = Math.max(0, punchInMinutes - shiftInMinutes)
        isLate = record.isLate === true || record.status === 'LATE' || lateMinutes > 15
        if (isLate && status === 'PRESENT') {
          status = 'LATE'
        }
      }

      // Half-day check: worked <= 5 hours
      if (record && record.punchIn && record.punchOut) {
        let totalMins = record.totalMinutes
        if (totalMins === undefined || totalMins === null) {
          try {
            totalMins = Math.floor(
              (new Date(record.punchOut).getTime() - new Date(record.punchIn).getTime()) / 60000
            )
          } catch {}
        }
        if (typeof totalMins === 'number' && totalMins > 0 && totalMins <= 300) {
          status = 'HALF_DAY'
        }
      }

      return {
        employeeId: emp.employeeId || emp.id,
        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        department: emp.department?.name || emp.departmentId || 'Unassigned',
        designation: emp.designation || 'Staff',
        status,
        isLate,
        lateMinutes,
        punchIn: record ? record.punchIn : null,
        punchOut: record ? record.punchOut : null,
        totalMinutes: record ? record.totalMinutes : null,
        punchInMode: record ? record.punchInMode : null,
      }
    })

    return NextResponse.json({ date: dateStr, logs: teamAttendance })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500 })
  }
}
