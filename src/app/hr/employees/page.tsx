import Link from "next/link";
import { getEmployees, getBranches, getDepartments } from "../actions";

export default async function EmployeeListPage() {
  const employees = await getEmployees().catch(() => []);
  const branches = await getBranches().catch(() => []);
  const departments = await getDepartments().catch(() => []);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Directory</h1>
          <p className="text-muted-foreground mt-1 text-sm text-gray-500">
            Manage your hotel staff, roles, and branch assignments.
          </p>
        </div>
        <Link 
          href="/hr/employees/add" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
        >
          + Add Employee
        </Link>
      </div>

      {/* Filters (Prototype) */}
      <div className="flex gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border">
        <select className="border rounded px-3 py-2 text-sm flex-1">
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="border rounded px-3 py-2 text-sm flex-1">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="border rounded px-3 py-2 text-sm flex-1">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On Leave</option>
        </select>
        <button className="bg-gray-100 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200 transition">
          Filter
        </button>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">Employee</th>
              <th className="px-6 py-3 font-semibold text-gray-600">ID</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Branch</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Department & Role</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Contact</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-6 py-3 font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-1">No employees found</p>
                    <p className="text-sm">Get started by creating a new employee record.</p>
                  </div>
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                        {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-600">{emp.employeeId}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-700">
                      {emp.branch?.name || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">{emp.designation}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{emp.department?.name || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{emp.contactNo}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      emp.status === 'ON_LEAVE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <Link href={`/hr/employees/${emp.id}`} className="text-blue-600 hover:text-blue-900 mr-4">Edit</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
