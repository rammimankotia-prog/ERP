/**
 * POST /api/admin/cleanup-employees
 * Permanently removes employees from Prisma DB and all JSON files.
 * Protected: only Master Admin can call this.
 * Body: { ids: ["GG-1002", "TEST-001"], secret: "GODWIN_CLEANUP_2026" }
 */
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()
const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')
const CLEANUP_SECRET = 'GODWIN_CLEANUP_2026'

function readJson(file: string): any[] {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch {}
  return []
}
function writeJson(file: string, data: any) {
  try {
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch {}
}
function addToBlacklist(keys: string[], file: string) {
  let list = readJson(file)
  if (!Array.isArray(list)) list = []
  const merged = Array.from(new Set([...list, ...keys.map(k => k.toLowerCase().trim())]))
  writeJson(file, merged)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeIds, secret } = body

    if (secret !== CLEANUP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: 'employeeIds array required' }, { status: 400 })
    }

    const results: any[] = []

    for (const empId of employeeIds) {
      const result: any = { employeeId: empId, prisma: 'not_found', json: 0, users: 0 }

      // 1. Delete from Prisma
      try {
        const emp = await prisma.employee.findUnique({ where: { employeeId: empId } })
        if (emp) {
          try { await prisma.shiftAssignment.deleteMany({ where: { employeeId: emp.id } }) } catch {}
          try { await prisma.leaveBalance.deleteMany({ where: { employeeId: emp.id } }) } catch {}
          try { await prisma.leaveRequest.deleteMany({ where: { employeeId: emp.id } }) } catch {}
          try { await prisma.overtimeRecord.deleteMany({ where: { employeeId: emp.id } }) } catch {}
          try { await prisma.attendanceLog.deleteMany({ where: { employeeId: emp.id } }) } catch {}
          try { await prisma.employeeDocument.deleteMany({ where: { employeeId: emp.id } }) } catch {}
          await prisma.employee.delete({ where: { id: emp.id } })
          result.prisma = 'deleted'
          result.prismaId = emp.id
        }
      } catch (e: any) {
        result.prisma = `error: ${e.message}`
      }

      // 2. Delete from JSON files
      const empFiles = [
        path.join(DATA_DIR, 'hr_employees.json'),
        path.join(LOCAL_DATA_DIR, 'hr_employees.json'),
        path.join(LOCAL_DATA_DIR, 'hr_employees_backup.json'),
      ]
      for (const f of empFiles) {
        let data = readJson(f)
        const before = data.length
        data = data.filter((e: any) =>
          (e.id || '').toLowerCase() !== empId.toLowerCase() &&
          (e.employeeId || '').toLowerCase() !== empId.toLowerCase()
        )
        result.json += before - data.length
        writeJson(f, data)
      }

      // 3. Delete from users.json
      const userFiles = [
        path.join(DATA_DIR, 'users.json'),
        path.join(LOCAL_DATA_DIR, 'users.json'),
      ]
      for (const f of userFiles) {
        let users = readJson(f)
        const before = users.length
        users = users.filter((u: any) =>
          (u.id || '').toLowerCase() !== empId.toLowerCase() &&
          (u.employeeId || '').toLowerCase() !== empId.toLowerCase()
        )
        result.users += before - users.length
        writeJson(f, users)
      }

      // 4. Add to blacklists
      addToBlacklist([empId], path.join(LOCAL_DATA_DIR, 'deleted_employees.json'))
      addToBlacklist([empId], path.join(DATA_DIR, 'deleted_employees.json'))
      addToBlacklist([empId], path.join(LOCAL_DATA_DIR, 'deleted_users.json'))
      addToBlacklist([empId], path.join(DATA_DIR, 'deleted_users.json'))

      results.push(result)
    }

    // Show remaining employees
    let remaining: any[] = []
    try {
      const dbEmps = await prisma.employee.findMany({ orderBy: { firstName: 'asc' } })
      remaining = dbEmps.map(e => ({ id: e.id, employeeId: e.employeeId, name: `${e.firstName} ${e.lastName}`, status: e.status }))
    } catch {}

    return NextResponse.json({
      success: true,
      processed: results,
      remainingInDb: remaining,
      message: `Processed ${results.length} employee(s)`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET: list all current DB employees (for verification)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== CLEANUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  try {
    const emps = await prisma.employee.findMany({
      include: { branch: true, department: true },
      orderBy: { firstName: 'asc' }
    })
    return NextResponse.json({
      count: emps.length,
      employees: emps.map(e => ({
        id: e.id,
        employeeId: e.employeeId,
        name: `${e.firstName} ${e.lastName}`,
        branch: e.branch?.name,
        dept: e.department?.name,
        status: e.status
      }))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
