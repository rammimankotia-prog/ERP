import LeaveManagement from './LeaveManagement'

export const metadata = {
  title: 'Leave Management | Godwin ERP',
  description: 'Employee leave applications and approval workflows'
}

export default function LeavePage() {
  return (
    <div className="page-container" style={{ maxWidth: '1200px' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Leave Management</h1>
          <p>Apply for leave, manage approvals, and track leave balances.</p>
        </div>
      </div>
      <LeaveManagement />
    </div>
  )
}
