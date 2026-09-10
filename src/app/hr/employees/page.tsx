import fs from 'fs'
import path from 'path'
import EmployeeDirectoryClient from "./EmployeeDirectoryClient";

export const metadata = {
  title: 'Employee Directory | Godwin ERP',
  description: 'Manage staff profiles, departmental assignments, and schedules across Hotel Grand Godwin & Hotel Godwin Deluxe'
}

export const dynamic = 'force-dynamic'

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), 'data')

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

export default function EmployeeListPage() {
  // Read from persistent data dir (PERSISTENT_DATA_DIR env var or local data/)
  const employees = readJsonFile<any[]>('hr_employees.json', [])
  const branches = readJsonFile<any[]>('hr_branches.json', [
    { id: 'mock-1', name: 'Hotel Grand Godwin', prefix: 'GG' },
    { id: 'mock-2', name: 'Hotel Godwin Deluxe', prefix: 'GD' },
    { id: 'mock-3', name: 'Indian Grill', prefix: 'IG' },
    { id: 'mock-4', name: 'Cafe Brownie', prefix: 'CB' }
  ])
  const departments = readJsonFile<any[]>('hr_departments.json', [
    { id: 'dept-1', name: 'Front Office' },
    { id: 'dept-2', name: 'Housekeeping' },
    { id: 'dept-3', name: 'Security Guard' },
    { id: 'dept-4', name: 'Accounts' },
    { id: 'dept-5', name: 'Reservation' },
    { id: 'dept-6', name: 'Food & Beverage' },
  ])

  return (
    <div className="page-container">
      <EmployeeDirectoryClient
        initialEmployees={employees}
        branches={branches}
        departments={departments}
      />
    </div>
  );
}


