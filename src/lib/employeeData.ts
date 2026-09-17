/**
 * Shared employee helper used by all HR API routes.
 * Single source of truth: Prisma DB first, JSON files as fallback.
 * Deleted employees are always excluded.
 */
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(LOCAL_DATA_DIR, 'hr_employees.json')
const BACKUP_EMPLOYEES_FILE = path.join(LOCAL_DATA_DIR, 'hr_employees_backup.json')
const DELETED_EMP_FILE = path.join(LOCAL_DATA_DIR, 'deleted_employees.json')

export function getDeletedEmployeeKeys(): string[] {
  try {
    if (fs.existsSync(DELETED_EMP_FILE)) {
      const raw = fs.readFileSync(DELETED_EMP_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((k: any) => String(k).toLowerCase().trim())
    }
  } catch {}
  return []
}

export function isEmployeeDeleted(emp: any, deletedKeys: string[]): boolean {
  const id = (emp.id || '').toLowerCase().trim()
  const empId = (emp.employeeId || '').toLowerCase().trim()
  const email = (emp.email || '').toLowerCase().trim()
  return (
    (id !== '' && deletedKeys.includes(id)) ||
    (empId !== '' && deletedKeys.includes(empId)) ||
    (email !== '' && deletedKeys.includes(email))
  )
}

/**
 * Returns ALL active employees, normalized.
 * - Tries Prisma DB first (same source as /hr/employees page).
 * - Falls back to JSON files if Prisma is unavailable.
 * - Always excludes employees in deleted_employees.json.
 */
export async function getAllEmployees(): Promise<any[]> {
  const deletedKeys = getDeletedEmployeeKeys()

  // 1. Prisma DB (production source of truth)
  try {
    const dbEmployees = await prisma.employee.findMany({
      include: { branch: true, department: true },
      orderBy: { firstName: 'asc' },
    })
    if (dbEmployees && dbEmployees.length > 0) {
      return dbEmployees
        .filter((e: any) => !isEmployeeDeleted(e, deletedKeys))
        .map((e: any) => ({
          id: e.id,
          employeeId: e.employeeId || e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          contactNo: e.contactNo,
          designation: e.designation,
          department: e.department,
          departmentId: e.departmentId,
          branch: e.branch,
          branchId: e.branchId,
          morningTime: e.morningTime || '09:00',
          eveningTime: e.eveningTime || '18:00',
          status: e.status,
          role: e.role,
          baseSalary: e.baseSalary,
          offDays: (e as any).offDays || [],
        }))
    }
  } catch {
    // Prisma unavailable — fall through to JSON
  }

  // 2. JSON fallback (dev / offline)
  const map = new Map<string, any>()
  for (const f of [BACKUP_EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, EMPLOYEES_FILE]) {
    try {
      if (fs.existsSync(f)) {
        const list = JSON.parse(fs.readFileSync(f, 'utf-8'))
        if (Array.isArray(list)) {
          for (const emp of list) {
            const key = emp.employeeId || emp.id
            if (!key || isEmployeeDeleted(emp, deletedKeys)) continue
            if (!map.has(key)) map.set(key, emp)
          }
        }
      }
    } catch {}
  }
  return Array.from(map.values())
}
