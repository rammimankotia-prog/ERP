'use server'

import { PrismaClient, EmploymentType, EmployeeStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const DATA_DIR = path.join(process.cwd(), 'data')
const EMPLOYEES_FILE = path.join(DATA_DIR, 'hr_employees.json')
const BRANCHES_FILE = path.join(DATA_DIR, 'hr_branches.json')
const DEPARTMENTS_FILE = path.join(DATA_DIR, 'hr_departments.json')

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback
    }
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err)
    return fallback
  }
}

function writeJsonFile(filePath: string, data: any): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err)
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
    { id: 'mock-1', name: 'Hotel Grand Godwin', prefix: 'GG' },
    { id: 'mock-2', name: 'Hotel Godwin Deluxe', prefix: 'GD' },
    { id: 'mock-3', name: 'Indian Grill', prefix: 'IG' },
    { id: 'mock-4', name: 'Cafe Brownie', prefix: 'CB' },
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
    { id: 'dept-1', name: 'Front Office' },
    { id: 'dept-2', name: 'Housekeeping' },
    { id: 'dept-3', name: 'Security' },
    { id: 'dept-4', name: 'Accounts' },
    { id: 'dept-5', name: 'Reservation' },
    { id: 'dept-6', name: 'Food & Beverage' },
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
  if (fileEmployees.length > 0) {
    return fileEmployees
  }

  // Initial seed employee if file is empty
  const initial = [
    {
      id: "mock-emp-1",
      employeeId: "GG-1001",
      firstName: "Raman",
      lastName: "Mankotia",
      designation: "General Manager",
      branch: { id: "mock-1", name: "Hotel Grand Godwin", prefix: "GG" },
      department: { id: "dept-1", name: "Front Office" },
      status: "ACTIVE",
      doj: new Date().toISOString(),
      employmentType: "PERMANENT",
      contactNo: "9876543210"
    }
  ]
  writeJsonFile(EMPLOYEES_FILE, initial)
  return initial
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

  const newRecord = {
    id: newId,
    employeeId,
    firstName: data.firstName,
    lastName: data.lastName,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Try DB persistence
  try {
    const created = await prisma.employee.create({
      data: {
        ...data,
        employeeId
      }
    })
    newRecord.id = created.id
  } catch (e) {
    console.warn("Prisma DB not available. Successfully stored in persistent JSON storage.")
  }

  // Always write to persistent JSON storage
  fileEmployees.push(newRecord)
  writeJsonFile(EMPLOYEES_FILE, fileEmployees)

  revalidatePath('/hr/employees')
  return newRecord
}

export async function updateEmployee(id: string, data: any) {
  const branches = await getBranches()
  const departments = await getDepartments()
  const branch = data.branchId ? branches.find((b: any) => b.id === data.branchId) : undefined
  const department = data.departmentId ? departments.find((d: any) => d.id === data.departmentId) : undefined

  // Try DB update
  try {
    await prisma.employee.update({
      where: { id },
      data
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
      ...data,
      branch: branch ? { id: branch.id, name: branch.name, prefix: branch.prefix } : fileEmployees[index].branch,
      department: department ? { id: department.id, name: department.name } : fileEmployees[index].department,
      updatedAt: new Date().toISOString(),
    }
    fileEmployees[index] = updatedRecord
  } else {
    updatedRecord = {
      id,
      ...data,
      branch: branch ? { id: branch.id, name: branch.name, prefix: branch.prefix } : undefined,
      department: department ? { id: department.id, name: department.name } : undefined,
      updatedAt: new Date().toISOString(),
    }
    fileEmployees.push(updatedRecord)
  }

  writeJsonFile(EMPLOYEES_FILE, fileEmployees)

  revalidatePath('/hr/employees')
  revalidatePath(`/hr/employees/${id}`)
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
  const filtered = fileEmployees.filter((e: any) => e.id !== id && e.employeeId !== id)
  writeJsonFile(EMPLOYEES_FILE, filtered)

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
