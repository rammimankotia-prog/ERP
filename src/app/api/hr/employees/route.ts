import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const BRANCHES_FILE = path.join(DATA_DIR, 'hr_branches.json')
const DEPARTMENTS_FILE = path.join(DATA_DIR, 'hr_departments.json')

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch {}
  return fallback
}

function writeJson(file: string, data: any): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error(`Error writing ${file}:`, err)
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const departmentId = searchParams.get('departmentId')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  let employees = readJson<any[]>(EMPLOYEES_FILE, [])
  const branches = readJson<any[]>(BRANCHES_FILE, [])
  const departments = readJson<any[]>(DEPARTMENTS_FILE, [])

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

    const employees = readJson<any[]>(EMPLOYEES_FILE, [])
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
