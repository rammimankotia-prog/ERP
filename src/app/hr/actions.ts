'use server'

import { PrismaClient, EmploymentType, EmployeeStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// --- BRANCH ACTIONS ---
export async function getBranches() {
  return await prisma.branch.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true, departments: true } } }
  })
}

export async function createBranch(data: { name: string; address?: string; prefix: string }) {
  const branch = await prisma.branch.create({ data })
  revalidatePath('/hr/branches')
  return branch
}

// --- DEPARTMENT ACTIONS ---
export async function getDepartments() {
  return await prisma.department.findMany({
    include: { branch: true, _count: { select: { employees: true } } },
    orderBy: { name: 'asc' }
  })
}

export async function createDepartment(data: { name: string; branchId: string }) {
  const dept = await prisma.department.create({ data })
  revalidatePath('/hr/departments')
  return dept
}

// --- EMPLOYEE ACTIONS ---
export async function getEmployees() {
  return await prisma.employee.findMany({
    include: {
      branch: true,
      department: true,
      reportingTo: true,
    },
    orderBy: { firstName: 'asc' }
  })
}

export async function getEmployeeById(id: string) {
  return await prisma.employee.findUnique({
    where: { id },
    include: {
      branch: true,
      department: true,
      documents: true,
    }
  })
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
  photo?: string
  dob?: Date
  gender?: string
  emergencyContact?: string
  address?: string
}) {
  // 1. Get branch to find prefix
  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } })
  if (!branch) throw new Error('Branch not found')

  // 2. Generate new Employee ID (e.g., GG-1001)
  // Find the last employee in this branch
  const lastEmployee = await prisma.employee.findFirst({
    where: { branchId: data.branchId },
    orderBy: { createdAt: 'desc' }
  })

  let newSequence = 1001
  if (lastEmployee && lastEmployee.employeeId.startsWith(branch.prefix + '-')) {
    const lastSeq = parseInt(lastEmployee.employeeId.split('-')[1])
    if (!isNaN(lastSeq)) {
      newSequence = lastSeq + 1
    }
  }
  const employeeId = `${branch.prefix}-${newSequence}`

  const employee = await prisma.employee.create({
    data: {
      ...data,
      employeeId
    }
  })

  revalidatePath('/hr/employees')
  return employee
}
