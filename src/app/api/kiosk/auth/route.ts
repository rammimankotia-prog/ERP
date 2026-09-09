import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch {}
  return fallback
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const employees = readJson<any[]>(EMPLOYEES_FILE, [])
    
    // Find employee
    const employee = employees.find(
      e => e.email?.toLowerCase() === email.toLowerCase() && e.password === password
    )

    if (!employee) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (employee.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is not active. Please contact HR.' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        department: employee.department?.name || employee.departmentId || 'Unassigned',
        designation: employee.designation || 'Staff',
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
