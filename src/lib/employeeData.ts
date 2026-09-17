/**
 * Shared employee helper used by all HR API routes.
 * Single source of truth: Prisma DB first, JSON files merged/fallback.
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
 * Returns ALL active employees, normalized and unified across Prisma DB and JSON files.
 * - Queries Prisma DB (production source of truth).
 * - Merges with JSON files so no employee is missed.
 * - Always excludes employees in deleted_employees.json.
 */
export async function getAllEmployees(): Promise<any[]> {
  const deletedKeys = getDeletedEmployeeKeys()
  const map = new Map<string, any>()

  // 1. Prisma DB (production source of truth)
  try {
    const dbEmployees = await prisma.employee.findMany({
      include: { branch: true, department: true },
      orderBy: { firstName: 'asc' },
    })
    if (dbEmployees && dbEmployees.length > 0) {
      for (const e of dbEmployees) {
        if (isEmployeeDeleted(e, deletedKeys)) continue
        const key = (e.employeeId || e.id || '').toUpperCase().trim()
        if (key) {
          map.set(key, {
            id: e.id,
            employeeId: e.employeeId || e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            email: (e as any).email || '',
            password: (e as any).password || '',
            contactNo: e.contactNo || '',
            gender: (e as any).gender || 'Other',
            employmentType: (e as any).employmentType || 'PERMANENT',
            designation: e.designation || 'Staff',
            department: e.department || null,
            departmentId: e.departmentId || null,
            branch: e.branch || null,
            branchId: e.branchId || null,
            morningTime: e.morningTime || '09:00',
            eveningTime: e.eveningTime || '18:00',
            status: e.status || 'ACTIVE',
            role: (e as any).role || 'Employee',
            baseSalary: (e as any).baseSalary || 0,
            doj: (e as any).doj || new Date(),
            photo: (e as any).photo || null,
            address: (e as any).address || '',
            emergencyContact: (e as any).emergencyContact || '',
            offDays: (e as any).offDays || [],
          })
        }
      }
    }
  } catch {
    // Prisma unavailable — fall through to JSON
  }

  // 2. JSON fallback / merge (reads local and persistent files)
  for (const f of [BACKUP_EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, EMPLOYEES_FILE]) {
    try {
      if (fs.existsSync(f)) {
        const list = JSON.parse(fs.readFileSync(f, 'utf-8'))
        if (Array.isArray(list)) {
          for (const emp of list) {
            const key = (emp.employeeId || emp.id || '').toUpperCase().trim()
            if (!key || isEmployeeDeleted(emp, deletedKeys)) continue
            // Only add if not already populated by Prisma
            if (!map.has(key)) {
              map.set(key, {
                ...emp,
                id: emp.id || key,
                employeeId: emp.employeeId || key,
                morningTime: emp.morningTime || '09:00',
                eveningTime: emp.eveningTime || '18:00',
                status: emp.status || 'ACTIVE',
                offDays: emp.offDays || [],
              })
            }
          }
        }
      }
    } catch {}
  }

  return Array.from(map.values())
}
