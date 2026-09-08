import AttendanceDashboard from './AttendanceDashboard'

export const metadata = {
  title: 'Attendance | Godwin ERP',
  description: 'Employee attendance tracking for Godwin Hotels'
}

export default function AttendancePage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Attendance</h1>
          <p>Track daily punch-in/out across Web, GPS, and Biometric modes.</p>
        </div>
      </div>
      <AttendanceDashboard />
    </div>
  )
}
