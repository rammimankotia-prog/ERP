import AttendanceReports from './AttendanceReports'

export const metadata = {
  title: 'Attendance & Exception Reports | Godwin ERP',
  description: 'Employee-wise weekly, monthly, and custom date range attendance reports tracking Late Arrive, Early Out, and Unpaid Leave'
}

export default function ReportsPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <AttendanceReports />
    </div>
  )
}
