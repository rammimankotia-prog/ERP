import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getAllEmployees } from '@/lib/employeeData'
import { writeToAllTiers, getAllDataDirs } from '@/lib/persistentVault'

export const dynamic = 'force-dynamic'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees.json')
const BACKUP_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees_backup.json')
const BRANCHES_FILE = path.join(DATA_DIR, 'hr_branches.json')
const LOCAL_BRANCHES_FILE = path.join(process.cwd(), 'data', 'hr_branches.json')
const DEPARTMENTS_FILE = path.join(DATA_DIR, 'hr_departments.json')
const LOCAL_DEPARTMENTS_FILE = path.join(process.cwd(), 'data', 'hr_departments.json')
const DELETED_EMP_FILE = path.join(process.cwd(), 'data', 'deleted_employees.json')

// ─── Deleted employees registry ────────────────────────────────────────────────
function getDeletedEmployeeKeys(): string[] {
  try {
    if (fs.existsSync(DELETED_EMP_FILE)) {
      const raw = fs.readFileSync(DELETED_EMP_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((k: any) => String(k).toLowerCase().trim())
    }
  } catch {}
  return []
}

function saveDeletedEmployeeKey(keys: string[]): void {
  try {
    const existing = getDeletedEmployeeKeys()
    const merged = Array.from(new Set([...existing, ...keys.map(k => k.toLowerCase().trim())]))
    writeToAllTiers('deleted_employees.json', merged)
  } catch {}
}

function isDeleted(emp: any, deletedKeys: string[]): boolean {
  const id = (emp.id || '').toLowerCase().trim()
  const empId = (emp.employeeId || '').toLowerCase().trim()
  const email = (emp.email || '').toLowerCase().trim()
  return (
    (id && deletedKeys.includes(id)) ||
    (empId && deletedKeys.includes(empId)) ||
    (email && deletedKeys.includes(email))
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function readJson<T>(file: string, fallbackFile: string = '', fallback: T = [] as unknown as T): T {
  for (const f of [file, fallbackFile]) {
    if (f) {
      try {
        if (fs.existsSync(f)) {
          const content = fs.readFileSync(f, 'utf-8')
          const parsed = JSON.parse(content)
          if (parsed !== undefined && parsed !== null) return parsed as unknown as T
        }
      } catch {}
    }
  }
  return fallback
}

/**
 * getMergedEmployees:
 * Reads all employee files (persistent > local > backup), deduplicates by ID,
 * and EXCLUDES any employee whose ID/email is in the deleted registry.
 */
function getMergedEmployees(): any[] {
  const deletedKeys = getDeletedEmployeeKeys()
  const mergedMap = new Map<string, any>()

  for (const f of [EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, BACKUP_EMPLOYEES_FILE]) {
    if (fs.existsSync(f)) {
      try {
        const raw = fs.readFileSync(f, 'utf-8')
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          for (const item of list) {
            const key = item.id || item.employeeId
            // Skip deleted employees
            if (!key || isDeleted(item, deletedKeys)) continue
            if (!mergedMap.has(key)) {
              mergedMap.set(key, item)
            }
          }
        }
      } catch {}
    }
  }
  return Array.from(mergedMap.values())
}

/**
 * writeEmployees:
 * Writes the canonical employee list to ALL locations (persistent + local + backup)
 * so all files are always in sync.
 */
function writeEmployees(data: any[]): void {
  writeToAllTiers('hr_employees.json', data)
}

function writeJson(file: string, data: any): void {
  const fileName = path.basename(file)
  writeToAllTiers(fileName, data)
}

// ─── GET ────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const departmentId = searchParams.get('departmentId')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  let employees = await getAllEmployees()
  const branches = readJson<any[]>(BRANCHES_FILE, LOCAL_BRANCHES_FILE, [])
  const departments = readJson<any[]>(DEPARTMENTS_FILE, LOCAL_DEPARTMENTS_FILE, [])

  if (branchId) {
    employees = employees.filter(e => e.branchId === branchId || e.branch?.id === branchId)
  }

  if (departmentId) {
    employees = employees.filter(e => e.departmentId === departmentId || e.department?.id === departmentId)
  }

  if (status && status !== 'ALL') {
    employees = employees.filter(e => e.status === status)
  }

  if (search) {
    const q = search.toLowerCase()
    employees = employees.filter(e =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.employeeId || '').toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q) ||
      (e.contactNo || '').includes(q)
    )
  }

  return NextResponse.json({
    employees,
    branches,
    departments,
    total: employees.length
  })
}

// ─── PUT (Update / Add) ─────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, employeeId, ...updates } = body
    const targetId = id || employeeId

    if (!targetId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    const employees = getMergedEmployees()
    const index = employees.findIndex((e: any) => e.id === targetId || e.employeeId === targetId)

    let updatedRecord: any = null
    if (index !== -1) {
      updatedRecord = {
        ...employees[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      employees[index] = updatedRecord
    } else {
      updatedRecord = {
        id: targetId,
        employeeId: employeeId || targetId,
        ...updates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      employees.push(updatedRecord)
    }

    writeEmployees(employees)

    // Unmark from deleted if active
    if (updatedRecord.status === 'ACTIVE') {
      try {
        const { unmarkEmployeeDeleted } = await import('@/lib/employeeData')
        unmarkEmployeeDeleted([targetId, updatedRecord.employeeId, updatedRecord.email])
      } catch {}
    }

    // Sync status to users.json
    try {
      const USERS_FILE = path.join(DATA_DIR, 'users.json')
      const LOCAL_USERS_FILE = path.join(process.cwd(), 'data', 'users.json')
      const users = readJson<any[]>(USERS_FILE, LOCAL_USERS_FILE, [])
      const uIdx = users.findIndex(
        (u: any) =>
          u.id === targetId ||
          (updatedRecord.email && u.email?.toLowerCase() === updatedRecord.email.toLowerCase()) ||
          (updatedRecord.employeeId && u.username?.toLowerCase() === updatedRecord.employeeId.toLowerCase())
      )
      if (uIdx !== -1) {
        users[uIdx] = {
          ...users[uIdx],
          name: `${updatedRecord.firstName || ''} ${updatedRecord.lastName || ''}`.trim() || users[uIdx].name,
          email: updatedRecord.email || users[uIdx].email,
          username: updatedRecord.email || users[uIdx].username,
          status: updatedRecord.status === 'ACTIVE' ? 'Active' : 'Inactive',
          ...(updatedRecord.password ? { password: updatedRecord.password } : {})
        }
        writeJson(USERS_FILE, users)
      }
    } catch (e) {
      console.warn('Failed to sync updated user in users.json:', e)
    }

    // When reactivating, remove from revoked sessions
    if (updatedRecord.status === 'ACTIVE') {
      try {
        const REVOKED_FILE = path.join(DATA_DIR, 'revoked_sessions.json')
        const LOCAL_REVOKED_FILE = path.join(process.cwd(), 'data', 'revoked_sessions.json')
        let revoked = readJson<any[]>(REVOKED_FILE, LOCAL_REVOKED_FILE, [])
        revoked = revoked.filter(
          (r: any) =>
            r.userId !== targetId &&
            r.employeeId !== targetId &&
            r.employeeId !== updatedRecord.employeeId &&
            (!updatedRecord.email || r.email?.toLowerCase() !== updatedRecord.email.toLowerCase()) &&
            (!updatedRecord.employeeId || r.username?.toLowerCase() !== updatedRecord.employeeId.toLowerCase())
        )
        writeJson(REVOKED_FILE, revoked)
      } catch (e) {
        console.warn('Failed to clear revoked sessions registry on activate:', e)
      }
    }

    // When deactivating, update users.json status and add to revoked sessions
    if (updatedRecord.status === 'INACTIVE') {
      try {
        const REVOKED_FILE = path.join(DATA_DIR, 'revoked_sessions.json')
        const LOCAL_REVOKED_FILE = path.join(process.cwd(), 'data', 'revoked_sessions.json')
        let revoked = readJson<any[]>(REVOKED_FILE, LOCAL_REVOKED_FILE, [])
        const revokeEntry = {
          userId: targetId,
          employeeId: updatedRecord.employeeId || targetId,
          email: updatedRecord.email || '',
          username: updatedRecord.employeeId || targetId,
          reason: 'Employee deactivated',
          revokedAt: new Date().toISOString()
        }
        // Avoid duplicates
        const alreadyRevoked = revoked.some(r => r.userId === targetId || r.employeeId === (updatedRecord.employeeId || targetId))
        if (!alreadyRevoked) revoked.push(revokeEntry)
        writeJson(REVOKED_FILE, revoked)
      } catch {}
    }

    return NextResponse.json({
      success: true,
      employee: updatedRecord,
      employees,
      message: 'Employee updated successfully in persistent storage'
    })
  } catch (err: any) {
    console.error('Error in PUT /api/hr/employees:', err)
    return NextResponse.json({ error: err.message || 'Failed to update employee' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return PUT(req)
}

// ─── DELETE ─────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    // Get current list (uses getMergedEmployees which respects the deleted registry)
    let employees = getMergedEmployees()
    const toDelete = employees.find((e: any) => e.id === id || e.employeeId === id)

    // Filter out the employee
    employees = employees.filter((e: any) => e.id !== id && e.employeeId !== id)

    // Write cleaned list to ALL 3 files immediately
    writeEmployees(employees)

    // Register in deleted_employees.json so it never comes back from backup
    if (toDelete) {
      const keysToDelete: string[] = []
      if (toDelete.id) keysToDelete.push(toDelete.id)
      if (toDelete.employeeId && toDelete.employeeId !== toDelete.id) keysToDelete.push(toDelete.employeeId)
      if (toDelete.email) keysToDelete.push(toDelete.email)
      saveDeletedEmployeeKey(keysToDelete)
    } else {
      // Employee was already missing from main files (was in backup only), still register the ID
      saveDeletedEmployeeKey([id])
    }

    // Remove from users.json as well
    if (toDelete) {
      try {
        const USERS_FILE = path.join(DATA_DIR, 'users.json')
        const LOCAL_USERS_FILE = path.join(process.cwd(), 'data', 'users.json')
        let users = readJson<any[]>(USERS_FILE, LOCAL_USERS_FILE, [])
        users = users.filter((u: any) =>
          u.id !== id &&
          u.id !== toDelete.id &&
          (!toDelete.email || u.email?.toLowerCase() !== toDelete.email.toLowerCase())
        )
        writeJson(USERS_FILE, users)
      } catch {}
    }

    // Also register in the global deleted_users.json (used by auth/users route)
    try {
      const DELETED_USERS_FILE = path.join(DATA_DIR, 'deleted_users.json')
      const LOCAL_DELETED_USERS_FILE = path.join(process.cwd(), 'data', 'deleted_users.json')
      for (const delUsersFile of [DELETED_USERS_FILE, LOCAL_DELETED_USERS_FILE]) {
        let delList: string[] = []
        try {
          if (fs.existsSync(delUsersFile)) {
            const raw = fs.readFileSync(delUsersFile, 'utf-8')
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) delList = parsed
          }
        } catch {}
        const toAdd = [id, toDelete?.id, toDelete?.employeeId, toDelete?.email].filter(Boolean) as string[]
        const merged = Array.from(new Set([...delList, ...toAdd.map(k => k.toLowerCase().trim())]))
        const dir = path.dirname(delUsersFile)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(delUsersFile, JSON.stringify(merged, null, 2), 'utf-8')
      }
    } catch {}

    return NextResponse.json({ success: true, message: 'Employee deleted successfully from all locations' })
  } catch (err: any) {
    console.error('Error in DELETE /api/hr/employees:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete employee' }, { status: 500 })
  }
}
