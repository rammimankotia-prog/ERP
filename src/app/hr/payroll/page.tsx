import PayrollSummary from './PayrollSummary'

export const metadata = {
  title: 'Payroll Summary | Godwin ERP',
  description: 'Monthly attendance-based payroll metrics, overtime, and deductions.'
}

export default function PayrollPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      <div className="header" style={{ marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '1.75rem', fontWeight: 800 }}>
            Payroll Summary & Disbursements
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Monthly attendance-based payroll metrics, overtime pay (1.5x), loss of pay (LOP) deductions, and salary slips across Hotel Grand Godwin & Hotel Godwin Deluxe.
          </p>
        </div>
      </div>
      <PayrollSummary />
    </div>
  )
}

