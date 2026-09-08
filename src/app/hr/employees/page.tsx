import { getEmployees, getBranches, getDepartments } from "../actions";
import EmployeeDirectoryClient from "./EmployeeDirectoryClient";

export const dynamic = 'force-dynamic'

export default async function EmployeeListPage() {
  const [employees, branches, departments] = await Promise.all([
    getEmployees().catch(() => []),
    getBranches().catch(() => []),
    getDepartments().catch(() => []),
  ]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <EmployeeDirectoryClient
        initialEmployees={employees}
        branches={branches}
        departments={departments}
      />
    </div>
  );
}
