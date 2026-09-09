import ShiftsManager from './ShiftsManager'

export const metadata = {
  title: 'Shift & Roster Manager | Godwin ERP',
  description: 'Manage staff schedules with interactive weekly and monthly rosters across Hotel Grand Godwin & Hotel Godwin Deluxe'
}

export default function ShiftsPage() {
  return (
    <div style={{ padding: '1.25rem 1.5rem', width: '100%', minHeight: '100%' }}>
      <ShiftsManager />
    </div>
  )
}
