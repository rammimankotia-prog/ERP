import ShiftsManager from './ShiftsManager'

export const metadata = {
  title: 'Shift & Roster Manager | Godwin ERP',
  description: 'Manage staff schedules with interactive weekly and monthly rosters across Hotel Grand Godwin & Hotel Godwin Deluxe'
}

export default function ShiftsPage() {
  return (
    <div className="page-container" style={{ minHeight: '100%' }}>
      <ShiftsManager />
    </div>
  )
}
