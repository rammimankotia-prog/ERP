import ShiftsManager from './ShiftsManager'

export const metadata = {
  title: 'Shift Manager | Godwin ERP',
  description: 'Manage employee shifts and rostering'
}

export default function ShiftsPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Shift Manager</h1>
          <p>Define shifts, assign employees, and manage weekly rosters.</p>
        </div>
      </div>
      <ShiftsManager />
    </div>
  )
}
