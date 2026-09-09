import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')
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
