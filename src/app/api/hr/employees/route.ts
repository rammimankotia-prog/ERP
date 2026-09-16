import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees.json')
const BACKUP_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees_backup.json')
const BRANCHES_FILE = path.join(DATA_DIR, 'hr_branches.json')
const LOCAL_BRANCHES_FILE = path.join(process.cwd(), 'data', 'hr_branches.json')
const DEPARTMENTS_FILE = path.join(DATA_DIR, 'hr_departments.json')
const LOCAL_DEPARTMENTS_FILE = path.join(process.cwd(), 'data', 'hr_departments.json')

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

function getMergedEmployees(): any[] {
  const mergedMap = new Map<string, any>()
  for (const f of [EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, BACKUP_EMPLOYEES_FILE]) {
    if (fs.existsSync(f)) {
      try {
        const raw = fs.readFileSync(f, 'utf-8')
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          for (const item of list) {
            const key = item.id || item.employeeId
            if (key && !mergedMap.has(key)) {
              mergedMap.set(key, item)
            }
          }
        }
      } catch {}
    }
  }
  return Array.from(mergedMap.values())
}

function writeJson(file: string, data: any): void {
  const localDataDir = path.join(process.cwd(), 'data')
  const fileName = path.basename(file)
  const localFile = path.join(localDataDir, fileName)
  const backupFile = path.join(localDataDir, fileName.replace('.json', '_backup.json'))
  for (const target of [file, localFile, backupFile]) {
    try {
      const dir = path.dirname(target)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error(`Error writing ${target}:`, err)
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const departmentId = searchParams.get('departmentId')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  let employees = getMergedEmployees()
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

    writeJson(EMPLOYEES_FILE, employees)

    // Sync with users.json
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

    // When status is ACTIVE, remove any previous revocation blocks
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

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    let employees = getMergedEmployees()
    const toDelete = employees.find((e: any) => e.id === id || e.employeeId === id)
    employees = employees.filter((e: any) => e.id !== id && e.employeeId !== id)
    writeJson(EMPLOYEES_FILE, employees)

    // Remove from users.json as well
    if (toDelete) {
      try {
        const USERS_FILE = path.join(DATA_DIR, 'users.json')
        const LOCAL_USERS_FILE = path.join(process.cwd(), 'data', 'users.json')
        let users = readJson<any[]>(USERS_FILE, LOCAL_USERS_FILE, [])
        users = users.filter((u: any) => u.id !== id && (!toDelete.email || u.email?.toLowerCase() !== toDelete.email.toLowerCase()))
        writeJson(USERS_FILE, users)
      } catch {}
    }

    return NextResponse.json({ success: true, message: 'Employee deleted successfully' })
  } catch (err: any) {
    console.error('Error in DELETE /api/hr/employees:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete employee' }, { status: 500 })
  }
}
