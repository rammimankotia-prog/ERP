import { getEmployees, getBranches, getDepartments } from '../actions'
import EmployeeDirectoryClient from "./EmployeeDirectoryClient";

export const metadata = {
  title: 'Employee Directory | Godwin ERP',
  description: 'Manage staff profiles, departmental assignments, and schedules across Hotel Grand Godwin & Hotel Godwin Deluxe'
}

export const dynamic = 'force-dynamic'

export default async function EmployeeListPage() {
  const employees = await getEmployees() || []
  const branches = await getBranches() || []
  const departments = await getDepartments() || []

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


