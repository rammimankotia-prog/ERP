import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees.json')

function readJson<T>(file: string, fallbackFile: string, fallback: T): T {
  for (const f of [file, fallbackFile]) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf-8')
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as unknown as T
        if (!Array.isArray(parsed) && parsed) return parsed as unknown as T
      }
    } catch {}
  }
  return fallback
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const identifier = (body.identifier || body.email || body.employeeId || '').trim().toLowerCase()
    const password = (body.password || '').trim()

    if (!identifier) {
      return NextResponse.json({ error: 'Employee ID or Email is required' }, { status: 400 })
    }

    const employees = readJson<any[]>(EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, [])
    
    // Find employee by email, employee ID (e.g. GG-1002 or 1002), or ID
    const employee = employees.find(e => {
      const eMail = (e.email || '').trim().toLowerCase()
      const eId = (e.employeeId || '').trim().toLowerCase()
      const rawId = (e.id || '').trim().toLowerCase()
      const matchesId = eMail === identifier || eId === identifier || rawId === identifier || (eId.includes('-') && eId.split('-')[1] === identifier)
      return matchesId
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found. Please check your Staff ID or Email.' }, { status: 404 })
    }

    if (employee.status && employee.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is inactive. Please contact HR.' }, { status: 403 })
    }

    // If password check is required (not a direct punch identification)
    if (password) {
      const empPass = (employee.password || 'Godwin@123').trim()
      if (empPass !== password && employee.password !== password) {
        return NextResponse.json({ error: 'Invalid password. Please verify your staff password.' }, { status: 401 })
      }
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
