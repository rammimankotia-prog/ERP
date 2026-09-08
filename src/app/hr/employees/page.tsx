import Link from "next/link";
import { getEmployees, getBranches, getDepartments } from "../actions";

export default async function EmployeeListPage() {
  const employees = await getEmployees().catch(() => []);
  const branches = await getBranches().catch(() => []);
  const departments = await getDepartments().catch(() => []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Employee Directory</h1>
          <p>Manage your hotel staff, roles, and branch assignments.</p>
        </div>
        <Link href="/hr/employees/add" className="btn btn-primary">
          <span style={{ marginRight: '0.5rem' }}>+</span> Add Employee
        </Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <select className="form-input" style={{ flex: 1, minHeight: '42px' }}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="form-input" style={{ flex: 1, minHeight: '42px' }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="form-input" style={{ flex: 1, minHeight: '42px' }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On Leave</option>
        </select>
        <button className="btn btn-outline" style={{ minHeight: '42px', padding: '0 2rem' }}>
          Filter
        </button>
      </div>

      {/* Employee Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Employee</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>ID</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Branch</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Department & Role</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Contact</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '3rem' }}>👥</span>
                    <div>
                      <h3 style={{ color: 'var(--text-main)' }}>No employees found</h3>
                      <p>Get started by creating a new employee record.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ 
                        width: '36px', height: '36px', borderRadius: '50%', 
                        backgroundColor: 'var(--ring)', color: 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '0.8rem'
                      }}>
                        {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                      </div>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                        {emp.firstName} {emp.lastName}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>{emp.employeeId}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span className="badge badge-silver">{emp.branch?.name || "N/A"}</span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{emp.designation}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{emp.department?.name || "N/A"}</div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>{emp.contactNo}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span className="badge" style={{ 
                      backgroundColor: emp.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: emp.status === 'ACTIVE' ? 'var(--success)' : 'var(--error)'
                    }}>
                      {emp.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <Link href={`/hr/employees/${emp.id}`} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
                      Edit
                    </Link>
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
