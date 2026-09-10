import Link from 'next/link'
import AttendanceDashboard from './AttendanceDashboard'

export const metadata = {
  title: 'Attendance | Godwin ERP',
  description: 'Employee attendance tracking for Godwin Hotels'
}

export default function AttendancePage() {
  return (
    <div className="page-container" style={{ maxWidth: '1200px' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Attendance</h1>
          <p>Track daily punch-in/out across Web, GPS, and Biometric modes.</p>
        </div>
        <Link
          href="/kiosk"
          target="_blank"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <span>Open Punch Terminal (Kiosk)</span>
        </Link>
      </div>
      <AttendanceDashboard />
    </div>
  )
}
