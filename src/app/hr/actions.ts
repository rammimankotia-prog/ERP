'use server'

import { PrismaClient, EmploymentType, EmployeeStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Use PERSISTENT_DATA_DIR env var if set (for production persistence outside repo),
// otherwise fall back to the local data/ folder (works in development).
const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const BRANCHES_FILE = path.join(DATA_DIR, 'hr_branches.json')
const DEPARTMENTS_FILE = path.join(DATA_DIR, 'hr_departments.json')

// Ensure data directory and seed files exist at startup
;(function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    // Copy seed files from local data/ if they don't exist in PERSISTENT_DATA_DIR
    const localDataDir = path.join(process.cwd(), 'data')
    for (const fname of ['hr_employees.json', 'hr_branches.json', 'hr_departments.json']) {
      const dest = path.join(DATA_DIR, fname)
      const src = path.join(localDataDir, fname)
      if (!fs.existsSync(dest) && fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
      }
    }
  } catch (e) {
    console.warn('Warning: Could not initialize data directory:', e)
  }
})()

function readJsonFile<T>(filePath: string, fallback: T): T {
  const localDataDir = path.join(process.cwd(), 'data')
  const fileName = path.basename(filePath)
  const localFile = path.join(localDataDir, fileName)
  for (const f of [filePath, localFile]) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed !== undefined && parsed !== null) return parsed as T
      }
    } catch (err) {}
  }
  return fallback
}

function writeJsonFile(filePath: string, data: any): void {
  const localDataDir = path.join(process.cwd(), 'data')
  const fileName = path.basename(filePath)
  const localFile = path.join(localDataDir, fileName)
  for (const target of [filePath, localFile]) {
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

// --- BRANCH ACTIONS ---
export async function getBranches() {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true, departments: true } } }
    })
    if (branches && branches.length > 0) return branches
  } catch (e) {
    // DB not connected, fallback to JSON
  }

  const branches = readJsonFile(BRANCHES_FILE, [
    { id: 'branch-gg', name: 'Hotel Grand Godwin', prefix: 'GG', address: '8502/41, Arakashan Road, Ram Nagar, Paharganj, New Delhi' },
    { id: 'branch-gd', name: 'Hotel Godwin Deluxe', prefix: 'GD', address: '8501/42, Arakashan Road, Ram Nagar, Paharganj, New Delhi' },
    { id: 'branch-ig', name: 'Indian Grill', prefix: 'IG', address: 'Hotel Grand Godwin Rooftop, New Delhi' },
    { id: 'branch-cb', name: 'Cafe Brownie', prefix: 'CB', address: 'Hotel Godwin Deluxe Lobby, New Delhi' },
  ])
  return branches
}

export async function createBranch(data: { name: string; address?: string; prefix: string }) {
  let branch: any = null
  try {
    branch = await prisma.branch.create({ data })
  } catch (e) {
    branch = { id: `branch-${Date.now()}`, ...data }
  }

  const branches = readJsonFile<any[]>(BRANCHES_FILE, [])
  branches.push(branch)
  writeJsonFile(BRANCHES_FILE, branches)

  revalidatePath('/hr/branches')
  return branch
}

// --- DEPARTMENT ACTIONS ---
export async function getDepartments() {
  try {
    const depts = await prisma.department.findMany({
      include: { branch: true, _count: { select: { employees: true } } },
      orderBy: { name: 'asc' }
    })
    if (depts && depts.length > 0) return depts
  } catch (e) {
    // DB not connected, fallback to JSON
  }

  const depts = readJsonFile<any[]>(DEPARTMENTS_FILE, [
    { id: 'dept-1', name: 'Management', branchId: 'branch-gg' },
    { id: 'dept-2', name: 'Front Office', branchId: 'branch-gg' },
    { id: 'dept-3', name: 'Housekeeping', branchId: 'branch-gg' },
    { id: 'dept-4', name: 'Security Guard', branchId: 'branch-gg' },
    { id: 'dept-5', name: 'Accounts', branchId: 'branch-gg' },
    { id: 'dept-6', name: 'Reservation', branchId: 'branch-gg' },
    { id: 'dept-7', name: 'Food & Beverage', branchId: 'branch-gg' },
    { id: 'dept-8', name: 'Management', branchId: 'branch-gd' },
    { id: 'dept-9', name: 'Front Office', branchId: 'branch-gd' },
    { id: 'dept-10', name: 'Security Guard', branchId: 'branch-gd' },
  ])
  return depts
}

export async function createDepartment(data: { name: string; branchId: string }) {
  let dept: any = null
  try {
    dept = await prisma.department.create({ data })
  } catch (e) {
    dept = { id: `dept-${Date.now()}`, ...data }
  }

  const depts = readJsonFile<any[]>(DEPARTMENTS_FILE, [])
  depts.push(dept)
  writeJsonFile(DEPARTMENTS_FILE, depts)

  revalidatePath('/hr/departments')
  return dept
}

// --- EMPLOYEE ACTIONS ---
export async function getEmployees() {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        branch: true,
        department: true,
        reportingTo: true,
      },
      orderBy: { firstName: 'asc' }
    })
    if (employees && employees.length > 0) return employees
  } catch (e) {
    // DB connection failed or offline, fallback to persistent JSON
  }

  const fileEmployees = readJsonFile<any[]>(EMPLOYEES_FILE, [])
  return fileEmployees
}

export async function getEmployeeById(id: string) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        branch: true,
        department: true,
        documents: true,
      }
    })
    if (employee) return employee
  } catch (e) {
    // fallback
  }

  const fileEmployees = readJsonFile<any[]>(EMPLOYEES_FILE, [])
  const found = fileEmployees.find((e: any) => e.id === id || e.employeeId === id)
  return found || null
}

export async function createEmployee(data: {
  firstName: string
  lastName: string
  email: string
  password?: string
  contactNo: string
  branchId: string
  departmentId: string
  designation: string
  doj: Date
  employmentType: EmploymentType
  status?: EmployeeStatus
  morningTime?: string
  eveningTime?: string
  photo?: string
  dob?: Date
  gender?: string
  emergencyContact?: string
  address?: string
}) {
  const branches = await getBranches()
  const departments = await getDepartments()
  const branch = branches.find((b: any) => b.id === data.branchId)
  const department = departments.find((d: any) => d.id === data.departmentId)
  const branchPrefix = branch?.prefix || 'GG'

  const fileEmployees = readJsonFile<any[]>(EMPLOYEES_FILE, [])

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

  // 1. Auto-generate secure password if not provided
  const generatedPassword = data.password && data.password.trim() !== '' && data.password !== 'Godwin@123'
    ? data.password.trim()
    : `Godwin#${Math.floor(1000 + Math.random() * 9000)}`

  // 2. Determine RBAC Role based on designation and department
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

  const newRecord = {
    id: newId,
    employeeId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    password: generatedPassword,
    contactNo: data.contactNo,
    branchId: data.branchId,
    departmentId: data.departmentId,
    designation: data.designation,
    morningTime: data.morningTime || '09:00',
    eveningTime: data.eveningTime || '18:00',
    doj: data.doj instanceof Date ? data.doj.toISOString() : data.doj,
    dob: data.dob instanceof Date ? data.dob.toISOString() : data.dob,
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

  // 3. Try DB persistence
  try {
    const { password: _p, ...prismaData } = data
    const created = await prisma.employee.create({
      data: {
        ...prismaData,
        employeeId
      }
    })
    newRecord.id = created.id
  } catch (e) {
    // Persistent JSON storage fallback
  }

  // 4. Write to persistent JSON storage
  fileEmployees.push(newRecord)
  writeJsonFile(EMPLOYEES_FILE, fileEmployees)

  // 5. Automatically create login account in users.json for portal authentication
  const USERS_FILE = path.join(DATA_DIR, 'users.json')
  const LOCAL_USERS_FILE = path.join(process.cwd(), 'data', 'users.json')
  try {
    const users = readJsonFile<any[]>(USERS_FILE, readJsonFile<any[]>(LOCAL_USERS_FILE, []))
    const existingIndex = users.findIndex(u => (u.email && u.email.toLowerCase() === data.email.toLowerCase()) || u.id === newRecord.id)
    const userPayload = {
      id: newRecord.id,
      username: data.email,
      name: `${data.firstName} ${data.lastName}`,
      email: data.email,
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
    if (USERS_FILE !== LOCAL_USERS_FILE) {
      writeJsonFile(LOCAL_USERS_FILE, users)
    }
  } catch (e) {
    console.warn('Failed to sync user account in users.json:', e)
  }

  // 6. Automatically dispatch credentials email
  try {
    const { sendEmployeeCredentials } = await import('@/lib/email')
    await sendEmployeeCredentials({
      to: data.email,
      name: `${data.firstName} ${data.lastName}`,
      employeeId,
      password: generatedPassword,
      role: assignedRole
    })
  } catch (e) {
    console.warn('Email dispatch warning:', e)
  }

  revalidatePath('/hr/employees')
  return {
    ...newRecord,
    generatedPassword,
    assignedRole
  }
}

export async function updateEmployee(id: string, data: any) {
  const branches = await getBranches()
  const departments = await getDepartments()
  const branch = data.branchId ? branches.find((b: any) => b.id === data.branchId) : undefined
  const department = data.departmentId ? departments.find((d: any) => d.id === data.departmentId) : undefined

  // Clean data: prevent undefined from overwriting existing valid values
  const cleanData: any = {}
  for (const k of Object.keys(data)) {
    if (data[k] !== undefined && data[k] !== null) {
      if (data[k] instanceof Date) {
        cleanData[k] = data[k].toISOString()
      } else {
        cleanData[k] = data[k]
      }
    }
  }

  // Try DB update
  try {
    await prisma.employee.update({
      where: { id },
      data: cleanData
    })
  } catch (e) {
    console.warn("Prisma DB not available. Successfully updated in persistent JSON storage.")
  }

  // Always update persistent JSON storage
  const fileEmployees = readJsonFile<any[]>(EMPLOYEES_FILE, [])
  const index = fileEmployees.findIndex((e: any) => e.id === id || e.employeeId === id)

  let updatedRecord: any = null

  if (index !== -1) {
    updatedRecord = {
      ...fileEmployees[index],
      ...cleanData,
      branch: branch ? { id: branch.id, name: branch.name, prefix: branch.prefix } : fileEmployees[index].branch,
      department: department ? { id: department.id, name: department.name } : fileEmployees[index].department,
      updatedAt: new Date().toISOString(),
    }
    fileEmployees[index] = updatedRecord
  } else {
    updatedRecord = {
      id,
      ...cleanData,
      branch: branch ? { id: branch.id, name: branch.name, prefix: branch.prefix } : undefined,
      department: department ? { id: department.id, name: department.name } : undefined,
      updatedAt: new Date().toISOString(),
    }
    fileEmployees.push(updatedRecord)
  }

  writeJsonFile(EMPLOYEES_FILE, fileEmployees)

  // Sync with users.json
  try {
    const USERS_FILE = path.join(DATA_DIR, 'users.json')
    const users = readJsonFile<any[]>(USERS_FILE, [])
    const uIdx = users.findIndex((u: any) => u.id === id || (updatedRecord.email && u.email?.toLowerCase() === updatedRecord.email.toLowerCase()))
    if (uIdx !== -1) {
      users[uIdx] = {
        ...users[uIdx],
        name: `${updatedRecord.firstName} ${updatedRecord.lastName}`.trim(),
        email: updatedRecord.email || users[uIdx].email,
        username: updatedRecord.email || users[uIdx].username,
        status: updatedRecord.status === 'ACTIVE' ? 'Active' : 'Inactive',
      }
      writeJsonFile(USERS_FILE, users)
    }
  } catch (e) {
    console.warn('Failed to sync updated user in users.json:', e)
  }

  revalidatePath('/hr/employees')
  revalidatePath(`/hr/employees/${id}`)
  revalidatePath('/users')
  return updatedRecord
}

export async function deleteEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.employeeDocument?.deleteMany({ where: { employeeId: id } }).catch(() => {})
    await (prisma as any).shiftAssignment?.deleteMany({ where: { employeeId: id } }).catch(() => {})
    await prisma.employee?.delete({ where: { id } }).catch(() => {})
  } catch (e) {
    // fallback
  }

  // Always delete from persistent JSON storage
  const fileEmployees = readJsonFile<any[]>(EMPLOYEES_FILE, [])
  const targetEmp = fileEmployees.find((e: any) => e.id === id || e.employeeId === id)
  const filtered = fileEmployees.filter((e: any) => e.id !== id && e.employeeId !== id)
  writeJsonFile(EMPLOYEES_FILE, filtered)

  // Relational Integrity: Remove associated user account from users.json
  try {
    const USERS_FILE = path.join(DATA_DIR, 'users.json')
    const users = readJsonFile<any[]>(USERS_FILE, [])
    const cleanUsers = users.filter(u => u.id !== id && (!targetEmp || u.email !== targetEmp.email))
    writeJsonFile(USERS_FILE, cleanUsers)
  } catch {}

  // Relational Integrity: Remove punch attendance logs for this employee
  try {
    const ATT_FILE = path.join(DATA_DIR, 'hr_attendance.json')
    const atts = readJsonFile<any[]>(ATT_FILE, [])
    const cleanAtts = atts.filter(a => a.employeeId !== id && (!targetEmp || a.employeeId !== targetEmp.employeeId))
    writeJsonFile(ATT_FILE, cleanAtts)
  } catch {}

  // Relational Integrity: Remove leave requests for this employee
  try {
    const LEAVE_FILE = path.join(DATA_DIR, 'hr_leaves.json')
    const leaves = readJsonFile<any[]>(LEAVE_FILE, [])
    const cleanLeaves = leaves.filter(l => l.employeeId !== id && (!targetEmp || (l.employeeId !== targetEmp.employeeId && l.employeeCode !== targetEmp.employeeId)))
    writeJsonFile(LEAVE_FILE, cleanLeaves)
  } catch {}

  revalidatePath('/hr/employees')
  return { success: true }
}

export async function toggleEmployeeStatus(
  id: string,
  newStatus?: EmployeeStatus
): Promise<{ success: boolean; status?: EmployeeStatus; error?: string }> {
  const fileEmployees = readJsonFile<any[]>(EMPLOYEES_FILE, [])
  const emp = fileEmployees.find((e: any) => e.id === id || e.employeeId === id)
  const targetStatus = newStatus || (emp?.status === 'ACTIVE' ? 'RESIGNED' : 'ACTIVE')

  try {
    await prisma.employee?.update({
      where: { id },
      data: { status: targetStatus }
    })
  } catch (e) {
    // fallback
  }

  if (emp) {
    emp.status = targetStatus
    emp.updatedAt = new Date().toISOString()
    writeJsonFile(EMPLOYEES_FILE, fileEmployees)
  }

  revalidatePath('/hr/employees')
  revalidatePath(`/hr/employees/${id}`)
  return { success: true, status: targetStatus }
}
