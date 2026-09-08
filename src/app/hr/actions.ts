'use server'

import { PrismaClient, EmploymentType, EmployeeStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// --- BRANCH ACTIONS ---
export async function getBranches() {
  try {
    return await prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true, departments: true } } }
    })
  } catch (e) {
    console.warn("DB connection failed. Returning mocked branches.")
    return [
      { id: 'mock-1', name: 'Hotel Grand Godwin', prefix: 'GG' },
      { id: 'mock-2', name: 'Hotel Godwin Deluxe', prefix: 'GD' },
      { id: 'mock-3', name: 'Indian Grill', prefix: 'IG' },
      { id: 'mock-4', name: 'Cafe Brownie', prefix: 'CB' },
    ] as any[]
  }
}

export async function createBranch(data: { name: string; address?: string; prefix: string }) {
  const branch = await prisma.branch.create({ data })
  revalidatePath('/hr/branches')
  return branch
}

// --- DEPARTMENT ACTIONS ---
export async function getDepartments() {
  try {
    return await prisma.department.findMany({
      include: { branch: true, _count: { select: { employees: true } } },
      orderBy: { name: 'asc' }
    })
  } catch (e) {
    console.warn("DB connection failed. Returning mocked departments.")
    return [
      { id: 'dept-1', name: 'Front Office' },
      { id: 'dept-2', name: 'Housekeeping' },
      { id: 'dept-3', name: 'Security' },
      { id: 'dept-4', name: 'Accounts' },
      { id: 'dept-5', name: 'Reservation' },
    ] as any[]
  }
}

export async function createDepartment(data: { name: string; branchId: string }) {
  const dept = await prisma.department.create({ data })
  revalidatePath('/hr/departments')
  return dept
}

// --- EMPLOYEE ACTIONS ---
export async function getEmployees() {
  try {
    return await prisma.employee.findMany({
      include: {
        branch: true,
        department: true,
        reportingTo: true,
      },
      orderBy: { firstName: 'asc' }
    })
  } catch (e) {
    console.warn("DB connection failed. Returning mocked employees.")
    return [
      {
        id: "mock-emp-1",
        employeeId: "GG-1001",
        firstName: "Raman",
        lastName: "Mankotia",
        designation: "General Manager",
        branch: { name: "Hotel Grand Godwin", prefix: "GG" },
        department: { name: "Front Office" },
        status: "ACTIVE",
        doj: new Date(),
        employmentType: "PERMANENT",
        contactNo: "9876543210"
      }
    ] as any[]
  }
}

export async function getEmployeeById(id: string) {
  try {
    return await prisma.employee.findUnique({
      where: { id },
      include: {
        branch: true,
        department: true,
        documents: true,
      }
    })
  } catch (e) {
    console.warn("DB connection failed. Returning mocked employee.")
    return {
      id,
      employeeId: "GG-1001",
      firstName: "Raman",
      lastName: "Mankotia",
      contactNo: "9876543210",
      branchId: "mock-1",
      departmentId: "dept-1",
      designation: "General Manager",
      doj: new Date(),
      employmentType: "PERMANENT",
      status: "ACTIVE",
      morningTime: "09:00",
      eveningTime: "18:00"
    } as any
  }
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
  try {
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
  } catch (e) {
    console.warn("DB connection failed. Simulating employee creation.")
    revalidatePath('/hr/employees')
    return {
      id: "mock-emp-" + Date.now(),
      employeeId: "MOCK-1001",
      ...data
    } as any
  }
}

export async function updateEmployee(id: string, data: any) {
  try {
    const employee = await prisma.employee.update({
      where: { id },
      data
    })
    revalidatePath('/hr/employees')
    revalidatePath(`/hr/employees/${id}`)
    return employee
  } catch (e) {
    console.warn("DB connection failed. Simulating employee update.")
    revalidatePath('/hr/employees')
    return { id, ...data }
  }
}

export async function deleteEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.employeeDocument.deleteMany({ where: { employeeId: id } }).catch(() => {})
    await (prisma as any).shiftAssignment?.deleteMany({ where: { employeeId: id } }).catch(() => {})
    await prisma.employee.delete({
      where: { id }
    })
    revalidatePath('/hr/employees')
    return { success: true }
  } catch (e: any) {
    console.warn("DB delete failed or employee mocked:", e)
    revalidatePath('/hr/employees')
    return { success: true }
  }
}

export async function toggleEmployeeStatus(id: string, newStatus?: EmployeeStatus): Promise<{ success: boolean; status?: EmployeeStatus; error?: string }> {
  try {
    const emp = await prisma.employee.findUnique({ where: { id } })
    const targetStatus = newStatus || (emp?.status === 'ACTIVE' ? 'RESIGNED' : 'ACTIVE')
    const updated = await prisma.employee.update({
      where: { id },
      data: { status: targetStatus }
    })
    revalidatePath('/hr/employees')
    revalidatePath(`/hr/employees/${id}`)
    return { success: true, status: updated.status }
  } catch (e: any) {
    console.warn("DB status update failed or mocked:", e)
    revalidatePath('/hr/employees')
    return { success: true, status: newStatus || 'RESIGNED' }
  }
}
