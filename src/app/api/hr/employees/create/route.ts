import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()
const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const LOCAL_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees.json')
const BRANCHES_FILE = path.join(DATA_DIR, 'hr_branches.json')
const LOCAL_BRANCHES_FILE = path.join(process.cwd(), 'data', 'hr_branches.json')
const DEPARTMENTS_FILE = path.join(DATA_DIR, 'hr_departments.json')
const LOCAL_DEPARTMENTS_FILE = path.join(process.cwd(), 'data', 'hr_departments.json')
const BACKUP_EMPLOYEES_FILE = path.join(process.cwd(), 'data', 'hr_employees_backup.json')

function readJsonFile<T>(file: string, fallbackFile: string = '', fallback: T = [] as unknown as T): T {
  const fileName = path.basename(file)
  const localDataDir = path.join(process.cwd(), 'data')
  const backupFile = path.join(localDataDir, fileName.replace('.json', '_backup.json'))

  if (fileName === 'hr_employees.json') {
    const map = new Map<string, any>()
    for (const f of [file, fallbackFile, backupFile]) {
      if (f && fs.existsSync(f)) {
        try {
          const content = fs.readFileSync(f, 'utf-8')
          const list = JSON.parse(content)
          if (Array.isArray(list)) {
            for (const item of list) {
              const k = item.id || item.employeeId
              if (k && !map.has(k)) map.set(k, item)
            }
          }
        } catch {}
      }
    }
    if (map.size > 0) return Array.from(map.values()) as unknown as T
  }

  for (const f of [file, fallbackFile, backupFile]) {
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

function writeJsonFile(file: string, data: any): void {
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

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    if (!data.firstName || !data.lastName || !data.email || !data.contactNo || !data.branchId || !data.departmentId || !data.designation) {
      return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 })
    }

    const branches = readJsonFile<any[]>(BRANCHES_FILE, LOCAL_BRANCHES_FILE, [
      { id: 'branch-gg', name: 'Hotel Grand Godwin', prefix: 'GG' },
      { id: 'branch-gd', name: 'Hotel Godwin Deluxe', prefix: 'GD' },
      { id: 'branch-ig', name: 'Indian Grill', prefix: 'IG' },
      { id: 'branch-cb', name: 'Cafe Brownie', prefix: 'CB' },
    ])

    const departments = readJsonFile<any[]>(DEPARTMENTS_FILE, LOCAL_DEPARTMENTS_FILE, [
      { id: 'dept-1', name: 'Management', branchId: 'branch-gg' },
      { id: 'dept-2', name: 'Front Office', branchId: 'branch-gg' },
      { id: 'dept-3', name: 'Housekeeping', branchId: 'branch-gg' },
      { id: 'dept-4', name: 'Security Guard', branchId: 'branch-gg' },
      { id: 'dept-5', name: 'Accounts', branchId: 'branch-gg' },
      { id: 'dept-6', name: 'Reservation', branchId: 'branch-gg' },
      { id: 'dept-7', name: 'Food & Beverage', branchId: 'branch-gg' },
    ])

    const branch = branches.find((b: any) => b.id === data.branchId)
    const department = departments.find((d: any) => d.id === data.departmentId)
    const branchPrefix = branch?.prefix || 'GG'

    const fileEmployees = readJsonFile<any[]>(EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, [])

    // Calculate next sequential ID for this branch prefix
    const matchingEmployees = fileEmployees.filter((e: any) =>
      e.employeeId && e.employeeId.startsWith(branchPrefix + '-')
    )

    let nextSequence = 1001
    if (matchingEmployees.length > 0) {
      const seqs = matchingEmployees.map((e: any) => {
        const parts = e.employeeId.split('-')
        const num = parseInt(parts[1], 10)
        return isNaN(num) ? 0 : num
      })
      nextSequence = Math.max(...seqs, 1000) + 1
    }
    const employeeId = `${branchPrefix}-${nextSequence}`
    const newId = `emp-${Date.now()}`

    // 1. Password resolution
    const generatedPassword = data.password && data.password.trim() !== '' && data.password !== 'Godwin@123'
      ? data.password.trim()
      : `Godwin#${Math.floor(1000 + Math.random() * 9000)}`

    // 2. Determine RBAC Role
    const lowerDesig = (data.designation || '').toLowerCase()
    const lowerDept = (department?.name || '').toLowerCase()
    let assignedRole = 'Employee'
    if (lowerDesig.includes('guard') || lowerDept.includes('security') || lowerDesig.includes('security')) {
      assignedRole = 'Security Guard'
    } else if (lowerDesig.includes('general manager') || lowerDesig.includes('root admin')) {
      assignedRole = 'Master Admin'
    } else if (lowerDesig.includes('manager') || lowerDesig.includes('supervisor')) {
      assignedRole = 'Manager'
    }

    const configuredOffDays = Array.isArray(data.offDays) && data.offDays.length > 0
      ? data.offDays
      : ['Sunday']

    const newRecord: any = {
      id: newId,
      employeeId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      password: generatedPassword,
      contactNo: data.contactNo.trim(),
      branchId: data.branchId,
      departmentId: data.departmentId,
      designation: data.designation.trim(),
      morningTime: data.morningTime || '09:00',
      eveningTime: data.eveningTime || '18:00',
      offDays: configuredOffDays,
      swapShiftEligible: data.swapShiftEligible === true,
      doj: data.doj || new Date().toISOString(),
      dob: data.dob || null,
      employmentType: data.employmentType || 'PERMANENT',
      status: data.status || 'ACTIVE',
      gender: data.gender || 'Male',
      emergencyContact: data.emergencyContact || '',
      address: data.address || '',
      branch: branch ? { id: branch.id, name: branch.name, prefix: branch.prefix } : undefined,
      department: department ? { id: department.id, name: department.name } : undefined,
      role: assignedRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 3. Try DB persistence if prisma is available
    try {
      const created = await (prisma.employee as any).create({
        data: {
          firstName: newRecord.firstName,
          lastName: newRecord.lastName,
          contactNo: newRecord.contactNo,
          branchId: newRecord.branchId,
          departmentId: newRecord.departmentId,
          designation: newRecord.designation,
          morningTime: newRecord.morningTime,
          eveningTime: newRecord.eveningTime,
          doj: new Date(newRecord.doj),
          dob: newRecord.dob ? new Date(newRecord.dob) : undefined,
          employmentType: newRecord.employmentType,
          status: newRecord.status,
          gender: newRecord.gender,
          emergencyContact: newRecord.emergencyContact,
          address: newRecord.address,
          employeeId
        }
      })
      if (created?.id) newRecord.id = created.id
    } catch (e) {
      // Offline / DB fallback
    }

    // 4. Save to JSON files
    fileEmployees.push(newRecord)
    writeJsonFile(EMPLOYEES_FILE, fileEmployees)

    // 4b. Ensure newly created employee is removed from deleted blacklist
    try {
      const { unmarkEmployeeDeleted } = await import('@/lib/employeeData')
      unmarkEmployeeDeleted([newRecord.id, employeeId, newRecord.email])
    } catch {}

    // 5. Sync login account in users.json
    try {
      const USERS_FILE = path.join(DATA_DIR, 'users.json')
      const LOCAL_USERS_FILE = path.join(process.cwd(), 'data', 'users.json')
      const users = readJsonFile<any[]>(USERS_FILE, LOCAL_USERS_FILE, [])
      const existingIndex = users.findIndex((u: any) =>
        (u.email && u.email.toLowerCase() === newRecord.email.toLowerCase()) ||
        u.id === newRecord.id ||
        (u.username && u.username.toLowerCase() === newRecord.employeeId.toLowerCase())
      )

      const userPayload = {
        id: newRecord.id,
        username: newRecord.email,
        name: `${newRecord.firstName} ${newRecord.lastName}`,
        email: newRecord.email,
        password: generatedPassword,
        role: assignedRole,
        status: 'Active',
        createdAt: new Date().toISOString().split('T')[0],
        permissions: assignedRole === 'Security Guard' ? { kiosk: true } : undefined
      }

      if (existingIndex >= 0) {
        users[existingIndex] = { ...users[existingIndex], ...userPayload }
      } else {
        users.push(userPayload)
      }
      writeJsonFile(USERS_FILE, users)
    } catch (e) {
      console.warn('Failed to sync user account in users.json:', e)
    }

    // 6. Email dispatch
    try {
      const { sendEmployeeCredentials } = await import('@/lib/email')
      await sendEmployeeCredentials({
        to: newRecord.email,
        name: `${newRecord.firstName} ${newRecord.lastName}`,
        employeeId,
        password: generatedPassword,
        role: assignedRole
      })
    } catch (e) {
      // Email non-fatal
    }

    return NextResponse.json({
      success: true,
      employee: newRecord,
      message: 'Employee created successfully'
    })

  } catch (err: any) {
    console.error('Error in POST /api/hr/employees/create:', err)
    return NextResponse.json({ error: err.message || 'Failed to create employee' }, { status: 500 })
  }
}
