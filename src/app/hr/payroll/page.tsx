import PayrollSummary from './PayrollSummary'

export const metadata = {
  title: 'Payroll | Godwin ERP',
  description: 'Monthly payroll and overtime summary'
}

export default function PayrollPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Payroll Summary</h1>
          <p>Monthly attendance-based payroll metrics, overtime, and deductions.</p>
        </div>
      </div>
      <PayrollSummary />
    </div>
  )
}
