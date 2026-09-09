import fs from 'fs'
import path from 'path'
import EmployeeDirectoryClient from "./EmployeeDirectoryClient";

export const metadata = {
  title: 'Employee Directory | Godwin ERP',
  description: 'Manage staff profiles, departmental assignments, and schedules across Hotel Grand Godwin & Hotel Godwin Deluxe'
}

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')

function readJsonFile<T>(filename: string, fallback: T): T {
  try {
    const fullPath = path.join(DATA_DIR, filename)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8')
      return JSON.parse(content) as T
    }
  } catch (e) {
    console.error(`Error reading ${filename}:`, e)
  }
  return fallback
}

const DEFAULT_EMPLOYEES = [
  {
    id: "mock-emp-1",
    employeeId: "GG-1001",
    firstName: "Raman",
    lastName: "Mankotia",
    designation: "General Manager",
    contactNo: "9811122233",
    branchId: "mock-1",
    branch: { id: "mock-1", name: "Hotel Grand Godwin", prefix: "GG" },
    departmentId: "dept-1",
    department: { id: "dept-1", name: "Front Office" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    doj: "2024-01-15T00:00:00.000Z",
    morningTime: "08:30",
    eveningTime: "18:00",
    gender: "Male"
  },
  {
    id: "mock-emp-2",
    employeeId: "GG-1002",
    firstName: "Priya",
    lastName: "Sharma",
    designation: "Front Desk Executive",
    contactNo: "9812345678",
    branchId: "mock-1",
    branch: { id: "mock-1", name: "Hotel Grand Godwin", prefix: "GG" },
    departmentId: "dept-1",
    department: { id: "dept-1", name: "Front Office" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    doj: "2024-03-01T00:00:00.000Z",
    morningTime: "07:00",
    eveningTime: "15:30",
    gender: "Female"
  },
  {
    id: "mock-emp-3",
    employeeId: "GD-1001",
    firstName: "Rajiv",
    lastName: "Kumar",
    designation: "Housekeeping Supervisor",
    contactNo: "9823456789",
    branchId: "mock-2",
    branch: { id: "mock-2", name: "Hotel Godwin Deluxe", prefix: "GD" },
    departmentId: "dept-2",
    department: { id: "dept-2", name: "Housekeeping" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    doj: "2024-02-10T00:00:00.000Z",
    morningTime: "08:00",
    eveningTime: "17:00",
    gender: "Male"
  },
  {
    id: "mock-emp-4",
    employeeId: "GD-1002",
    firstName: "Sunita",
    lastName: "Verma",
    designation: "Security Officer",
    contactNo: "9834567890",
    branchId: "mock-2",
    branch: { id: "mock-2", name: "Hotel Godwin Deluxe", prefix: "GD" },
    departmentId: "dept-3",
    department: { id: "dept-3", name: "Security" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    doj: "2024-04-15T00:00:00.000Z",
    morningTime: "22:00",
    eveningTime: "06:00",
    gender: "Female"
  },
  {
    id: "mock-emp-5",
    employeeId: "GG-1003",
    firstName: "Amit",
    lastName: "Singh",
    designation: "Accounts Executive",
    contactNo: "9845678901",
    branchId: "mock-1",
    branch: { id: "mock-1", name: "Hotel Grand Godwin", prefix: "GG" },
    departmentId: "dept-4",
    department: { id: "dept-4", name: "Accounts" },
    status: "ACTIVE",
    employmentType: "PERMANENT",
    doj: "2024-05-01T00:00:00.000Z",
    morningTime: "10:00",
    eveningTime: "19:00",
    gender: "Male"
  }
]

export default function EmployeeListPage() {
  const employees = readJsonFile<any[]>('hr_employees.json', DEFAULT_EMPLOYEES)
  const branches = readJsonFile<any[]>('hr_branches.json', [
    { id: 'mock-1', name: 'Hotel Grand Godwin', prefix: 'GG' },
    { id: 'mock-2', name: 'Hotel Godwin Deluxe', prefix: 'GD' }
  ])
  const departments = readJsonFile<any[]>('hr_departments.json', [
    { id: 'dept-1', name: 'Front Office' },
    { id: 'dept-2', name: 'Housekeeping' },
    { id: 'dept-3', name: 'Security' },
    { id: 'dept-4', name: 'Accounts' }
  ])

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <EmployeeDirectoryClient
        initialEmployees={employees && employees.length > 0 ? employees : DEFAULT_EMPLOYEES}
        branches={branches}
        departments={departments}
      />
    </div>
  );
}

