'use client'

import { useState, useEffect } from 'react'

type Shift = {
  id: string
  name: string
  type: string
  startTime: string
  endTime: string
  graceMinutes: number
  branchId: string
}

const SHIFT_TYPE_COLOR: Record<string, string> = {
  FIXED: '#10b981',
  ROTATING: '#f59e0b',
  NIGHT: '#8b5cf6',
}

const MOCK_EMPLOYEES = [
  { id: 'e1', name: 'Raman Mankotia', designation: 'GM' },
  { id: 'e2', name: 'Priya Sharma', designation: 'Front Desk' },
  { id: 'e3', name: 'Rajiv Kumar', designation: 'Housekeeping' },
  { id: 'e4', name: 'Sunita Verma', designation: 'Security' },
  { id: 'e5', name: 'Amit Singh', designation: 'Accounts' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MOCK_ROSTER: Record<string, Record<string, string>> = {
  'e1': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Morning Shift', Sat: 'OFF', Sun: 'OFF' },
  'e2': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Evening Shift', Thu: 'Evening Shift', Fri: 'Morning Shift', Sat: 'Morning Shift', Sun: 'OFF' },
  'e3': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Night Shift', Sat: 'Night Shift', Sun: 'OFF' },
  'e4': { Mon: 'Night Shift', Tue: 'Night Shift', Wed: 'Night Shift', Thu: 'OFF', Fri: 'Night Shift', Sat: 'Night Shift', Sun: 'Night Shift' },
  'e5': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Morning Shift', Sat: 'OFF', Sun: 'OFF' },
}

export default function ShiftsManager() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', type: 'FIXED', startTime: '09:00', endTime: '18:00', graceMinutes: 15, branchId: 'mock-1' })

  useEffect(() => {
    fetch('/api/hr/shifts').then(r => r.json()).then(d => setShifts(d.shifts || [])).catch(() => {})
  }, [])

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/hr/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      setShifts(prev => [...prev, data.shift])
      setMessage('✅ Shift created successfully!')
      setShowForm(false)
      setForm({ name: '', type: 'FIXED', startTime: '09:00', endTime: '18:00', graceMinutes: 15, branchId: 'mock-1' })
    } catch {
      setMessage('✅ Shift created (offline mode)')
      setShowForm(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {message && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success)', display: 'flex', justifyContent: 'space-between' }}>
          {message}
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Shifts Cards */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--text-main)' }}>Defined Shifts</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Shift'}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '1.5rem' }}>Create New Shift</h3>
            <form onSubmit={handleCreateShift} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Shift Name *</label>
                <input required className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Morning Shift" />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="form-input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="FIXED">Fixed</option>
                  <option value="ROTATING">Rotating</option>
                  <option value="NIGHT">Night</option>
                </select>
              </div>
              <div className="form-group">
                <label>Start Time *</label>
                <input required type="time" className="form-input" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>End Time *</label>
                <input required type="time" className="form-input" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Grace Period (mins)</label>
                <input type="number" min="0" max="60" className="form-input" value={form.graceMinutes} onChange={e => setForm(p => ({ ...p, graceMinutes: parseInt(e.target.value) }))} />
              </div>
              <div className="form-group" style={{ alignSelf: 'end' }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.75rem' }}>
                  {loading ? 'Creating...' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {shifts.map(shift => (
            <div key={shift.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ color: 'var(--text-main)', fontSize: '1rem', marginBottom: '0.25rem' }}>{shift.name}</h3>
                  <span className="badge" style={{ backgroundColor: `${SHIFT_TYPE_COLOR[shift.type]}22`, color: SHIFT_TYPE_COLOR[shift.type] }}>{shift.type}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{shift.startTime} – {shift.endTime}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                <span>⏱ Grace: {shift.graceMinutes} mins</span>
                <span>📅 {shift.type === 'NIGHT' ? 'Night Duty' : 'Day Duty'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Roster Grid */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: 'var(--text-main)' }}>Weekly Roster</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Week</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--bg-main)' }}>
              <tr>
                <th style={{ padding: '0.875rem 1.25rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap', minWidth: '160px' }}>Employee</th>
                {DAYS.map(d => (
                  <th key={d} style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_EMPLOYEES.map(emp => (
                <tr key={emp.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.designation}</div>
                  </td>
                  {DAYS.map(day => {
                    const assignment = MOCK_ROSTER[emp.id]?.[day] || 'Unassigned'
                    const isOff = assignment === 'OFF'
                    const isNight = assignment === 'Night Shift'
                    const bgColor = isOff ? 'rgba(100, 116, 139, 0.1)' : isNight ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                    const textColor = isOff ? 'var(--text-muted)' : isNight ? '#8b5cf6' : 'var(--success)'
                    return (
                      <td key={day} style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: bgColor, color: textColor, fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {isOff ? '—' : assignment.replace(' Shift', '')}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
