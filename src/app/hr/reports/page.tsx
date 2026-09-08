import AttendanceReports from './AttendanceReports'

export const metadata = {
  title: 'Attendance Reports | Godwin ERP',
  description: 'Exportable attendance and exception reports'
}

export default function ReportsPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Attendance Reports</h1>
          <p>Generate date-range reports with absenteeism rates, exception logs, and CSV/PDF export.</p>
        </div>
      </div>
      <AttendanceReports />
    </div>
  )
}
