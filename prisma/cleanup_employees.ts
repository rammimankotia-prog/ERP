/**
 * GODWIN ERP — Employee Cleanup Script
 * Removes GG-1002 (Raman Singh) from Prisma DB and all JSON files permanently.
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const DATA_DIR = path.join(process.cwd(), 'data')

const DELETED_EMP_FILE = path.join(DATA_DIR, 'deleted_employees.json')
const DELETED_USERS_FILE = path.join(DATA_DIR, 'deleted_users.json')
const EMP_FILE = path.join(DATA_DIR, 'hr_employees.json')
const EMP_BACKUP = path.join(DATA_DIR, 'hr_employees_backup.json')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

// Employees to permanently delete (by employeeId)
const TO_DELETE = [
  { employeeId: 'GG-1002', email: 'ramansingh@godwinhotels.com', name: 'Raman Singh' },
]

function readJson(file: string): any[] {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {}
  return []
}

function writeJson(file: string, data: any) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8') }
  catch (e) { console.error('  Failed to write', file, e) }
}

function addToBlacklist(keys: string[], file: string) {
  let list = readJson(file)
  if (!Array.isArray(list)) list = []
  const merged = Array.from(new Set([...list, ...keys.map(k => k.toLowerCase().trim())]))
  writeJson(file, merged)
}

async function main() {
  console.log('=== GODWIN ERP Employee Cleanup ===\n')

  // ── Show current Prisma employees ──────────────────────────────────
  console.log('📊 Prisma DB employees (before):')
  try {
    const all = await prisma.employee.findMany({ orderBy: { firstName: 'asc' } })
    all.forEach(e => console.log(`  [${e.employeeId}] ${e.firstName} ${e.lastName} | ${e.status}`))
  } catch (e: any) {
    console.log('  DB error:', e.message)
  }

  // ── Delete from Prisma DB ───────────────────────────────────────────
  for (const target of TO_DELETE) {
    console.log(`\n🗑  Processing: ${target.name} (${target.employeeId})`)

    try {
      const emp = await prisma.employee.findUnique({ where: { employeeId: target.employeeId } })
      if (emp) {
        // Delete all related records first (cascade)
        try { await prisma.shiftAssignment.deleteMany({ where: { employeeId: emp.id } }) } catch {}
        try { await prisma.leaveBalance.deleteMany({ where: { employeeId: emp.id } }) } catch {}
        try { await prisma.leaveRequest.deleteMany({ where: { employeeId: emp.id } }) } catch {}
        try { await prisma.overtimeRecord.deleteMany({ where: { employeeId: emp.id } }) } catch {}
        try { await prisma.attendanceLog.deleteMany({ where: { employeeId: emp.id } }) } catch {}
        try { await prisma.employeeDocument.deleteMany({ where: { employeeId: emp.id } }) } catch {}
        // Delete the employee
        await prisma.employee.delete({ where: { id: emp.id } })
        console.log(`  ✅ Deleted from Prisma DB (id: ${emp.id})`)
      } else {
        console.log(`  ⚠️  Not found in Prisma DB`)
      }
    } catch (e: any) {
      console.log(`  ❌ Prisma error: ${e.message}`)
    }

    // ── Clean JSON files ──────────────────────────────────────────────
    for (const file of [EMP_FILE, EMP_BACKUP]) {
      let data = readJson(file)
      const before = data.length
      data = data.filter((e: any) => {
        return (e.id || '').toLowerCase() !== target.employeeId.toLowerCase() &&
               (e.employeeId || '').toLowerCase() !== target.employeeId.toLowerCase() &&
               (e.email || '').toLowerCase() !== target.email.toLowerCase()
      })
      writeJson(file, data)
      console.log(`  📄 ${path.basename(file)}: removed ${before - data.length}`)
    }

    // ── Clean users.json ──────────────────────────────────────────────
    let users = readJson(USERS_FILE)
    const beforeU = users.length
    users = users.filter((u: any) => {
      return (u.id || '').toLowerCase() !== target.employeeId.toLowerCase() &&
             (u.employeeId || '').toLowerCase() !== target.employeeId.toLowerCase() &&
             (u.email || '').toLowerCase() !== target.email.toLowerCase()
    })
    writeJson(USERS_FILE, users)
    console.log(`  👥 users.json: removed ${beforeU - users.length}`)

    // ── Register in blacklists ────────────────────────────────────────
    const keys = [target.employeeId, target.email]
    addToBlacklist(keys, DELETED_EMP_FILE)
    addToBlacklist(keys, DELETED_USERS_FILE)
    console.log(`  🚫 Blacklisted: ${keys.join(', ')}`)
  }

  // ── Final state ──────────────────────────────────────────────────────
  console.log('\n\n=== FINAL STATE ===')
  console.log('\n📊 Prisma DB employees (after):')
  try {
    const remaining = await prisma.employee.findMany({
      include: { branch: true, department: true },
      orderBy: { firstName: 'asc' }
    })
    if (remaining.length === 0) {
      console.log('  (none in Prisma DB)')
    } else {
      remaining.forEach(e => {
        console.log(`  [${e.employeeId}] ${e.firstName} ${e.lastName} | Dept: ${e.department?.name}`)
      })
    }
  } catch {}

  console.log('\n🚫 deleted_employees.json:', readJson(DELETED_EMP_FILE))
  console.log('\n✅ Done!')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect() })
