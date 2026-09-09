'use client'

import { useState, useEffect } from 'react'

type Shift = {
  id: string
  name: string
  type: string
  startTime: string
  endTime: string
  firstSlot?: string
  secondSlot?: string
  breakTime?: string
  graceMinutes: number
  branchId: string
}

const SHIFT_TYPE_COLOR: Record<string, string> = {
  FIXED: '#10b981',
  ROTATING: '#f59e0b',
  NIGHT: '#8b5cf6',
  BREAK: '#0ea5e9',
  SPLIT: '#0ea5e9',
}

const MOCK_EMPLOYEES = [
  { id: 'e1', name: 'Raman Mankotia', designation: 'GM' },
  { id: 'e2', name: 'Priya Sharma', designation: 'Front Desk' },
  { id: 'e3', name: 'Rajiv Kumar', designation: 'Housekeeping' },
  { id: 'e4', name: 'Sunita Verma', designation: 'Security' },
  { id: 'e5', name: 'Amit Singh', designation: 'Accounts' },
]

const INITIAL_ROSTER: Record<string, Record<string, string>> = {
  'e1': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Morning Shift', Sat: 'OFF', Sun: 'OFF' },
  'e2': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Break Shift', Thu: 'Break Shift', Fri: 'Morning Shift', Sat: 'Morning Shift', Sun: 'OFF' },
  'e3': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Night Shift', Sat: 'Night Shift', Sun: 'OFF' },
  'e4': { Mon: 'Night Shift', Tue: 'Night Shift', Wed: 'Night Shift', Thu: 'OFF', Fri: 'Night Shift', Sat: 'Night Shift', Sun: 'Night Shift' },
  'e5': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Morning Shift', Sat: 'OFF', Sun: 'OFF' },
}

// Helper to get Monday of any date
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

// Format week range: e.g. "07 Sep – 13 Sep 2026"
function formatWeekRange(startMonday: Date): string {
  const endSunday = new Date(startMonday)
  endSunday.setDate(startMonday.getDate() + 6)

  const startDay = startMonday.getDate().toString().padStart(2, '0')
  const startMonth = startMonday.toLocaleDateString('en-GB', { month: 'short' })
  const endDay = endSunday.getDate().toString().padStart(2, '0')
  const endMonth = endSunday.toLocaleDateString('en-GB', { month: 'short' })
  const year = endSunday.getFullYear()

  if (startMonth === endMonth) {
    return `${startDay} – ${endDay} ${startMonth} ${year}`
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${year}`
}

export default function ShiftsManager() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [roster, setRoster] = useState<Record<string, Record<string, string>>>(INITIAL_ROSTER)
  const [showForm, setShowForm] = useState(false)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Live Local Time
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDateStr, setCurrentDateStr] = useState<string>('')

  // Calendar / Week State
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => getMonday(new Date()))

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
      setCurrentDateStr(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      )
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Form states
  const [form, setForm] = useState({
    name: 'Break Shift',
    type: 'BREAK',
    startTime: '10:00',
    endTime: '22:00',
    morningStart: '10:00',
    morningEnd: '14:00',
    eveningStart: '18:00',
    eveningEnd: '22:00',
    graceMinutes: 15,
    branchId: 'mock-1',
  })

  useEffect(() => {
    fetch('/api/hr/shifts')
      .then(r => r.json())
      .then(d => {
        if (d.shifts && d.shifts.length > 0) {
          setShifts(d.shifts)
        } else {
          setShifts([
            { id: 'shift-1', name: 'Morning Shift', type: 'FIXED', startTime: '09:00', endTime: '18:00', graceMinutes: 15, branchId: 'mock-1' },
            { id: 'shift-2', name: 'Break Shift', type: 'BREAK', startTime: '10:00', endTime: '22:00', firstSlot: '10:00 – 14:00', secondSlot: '18:00 – 22:00', breakTime: '14:00 – 18:00', graceMinutes: 15, branchId: 'mock-1' },
            { id: 'shift-3', name: 'Night Shift', type: 'NIGHT', startTime: '22:00', endTime: '07:00', graceMinutes: 20, branchId: 'mock-1' },
          ])
        }
      })
      .catch(() => {
        setShifts([
          { id: 'shift-1', name: 'Morning Shift', type: 'FIXED', startTime: '09:00', endTime: '18:00', graceMinutes: 15, branchId: 'mock-1' },
          { id: 'shift-2', name: 'Break Shift', type: 'BREAK', startTime: '10:00', endTime: '22:00', firstSlot: '10:00 – 14:00', secondSlot: '18:00 – 22:00', breakTime: '14:00 – 18:00', graceMinutes: 15, branchId: 'mock-1' },
          { id: 'shift-3', name: 'Night Shift', type: 'NIGHT', startTime: '22:00', endTime: '07:00', graceMinutes: 20, branchId: 'mock-1' },
        ])
      })
  }, [])

  const resetForm = () => {
    setForm({
      name: '',
      type: 'FIXED',
      startTime: '09:00',
      endTime: '18:00',
      morningStart: '10:00',
      morningEnd: '14:00',
      eveningStart: '18:00',
      eveningEnd: '22:00',
      graceMinutes: 15,
      branchId: 'mock-1',
    })
    setEditingShiftId(null)
    setShowForm(false)
  }

  const handleOpenCreateBreakShift = () => {
    setForm({
      name: 'Break Shift',
      type: 'BREAK',
      startTime: '10:00',
      endTime: '22:00',
      morningStart: '10:00',
      morningEnd: '14:00',
      eveningStart: '18:00',
      eveningEnd: '22:00',
      graceMinutes: 15,
      branchId: 'mock-1',
    })
    setEditingShiftId(null)
    setShowForm(true)
  }

  const handleEditShift = (shift: Shift) => {
    let mStart = '10:00'
    let mEnd = '14:00'
    let eStart = '18:00'
    let eEnd = '22:00'

    if (shift.firstSlot) {
      const parts = shift.firstSlot.split('–').map(s => s.trim())
      if (parts[0]) mStart = parts[0]
      if (parts[1]) mEnd = parts[1]
    }
    if (shift.secondSlot) {
      const parts = shift.secondSlot.split('–').map(s => s.trim())
      if (parts[0]) eStart = parts[0]
      if (parts[1]) eEnd = parts[1]
    }

    setForm({
      name: shift.name,
      type: shift.type,
      startTime: shift.startTime,
      endTime: shift.endTime,
      morningStart: mStart,
      morningEnd: mEnd,
      eveningStart: eStart,
      eveningEnd: eEnd,
      graceMinutes: shift.graceMinutes,
      branchId: shift.branchId || 'mock-1',
    })
    setEditingShiftId(shift.id)
    setShowForm(true)
  }

  const handleDeleteShift = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      setShifts(prev => prev.filter(s => s.id !== id))
      setMessage(`🗑️ Shift "${name}" removed.`)
    }
  }

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const isBreak = form.type === 'BREAK' || form.type === 'SPLIT'
    const payload = {
      name: form.name,
      type: form.type,
      startTime: isBreak ? form.morningStart : form.startTime,
      endTime: isBreak ? form.eveningEnd : form.endTime,
      firstSlot: isBreak ? `${form.morningStart} – ${form.morningEnd}` : undefined,
      secondSlot: isBreak ? `${form.eveningStart} – ${form.eveningEnd}` : undefined,
      breakTime: isBreak ? `${form.morningEnd} – ${form.eveningStart}` : undefined,
      graceMinutes: form.graceMinutes,
      branchId: form.branchId,
    }

    try {
      if (editingShiftId) {
        setShifts(prev =>
          prev.map(s =>
            s.id === editingShiftId
              ? {
                  ...s,
                  ...payload,
                }
              : s
          )
        )
        setMessage('✅ Shift updated successfully!')
        resetForm()
      } else {
        const res = await fetch('/api/hr/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        const newShift: Shift = data.shift || {
          id: 'shift-' + Date.now(),
          ...payload,
        }
        setShifts(prev => [...prev, newShift])
        setMessage('✅ Shift created successfully!')
        resetForm()
      }
    } catch {
      if (editingShiftId) {
        setShifts(prev =>
          prev.map(s =>
            s.id === editingShiftId
              ? {
                  ...s,
                  ...payload,
                }
              : s
          )
        )
      } else {
        setShifts(prev => [
          ...prev,
          {
            id: 'shift-' + Date.now(),
            ...payload,
          },
        ])
      }
      setMessage('✅ Saved (offline mode)')
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  const cycleRosterShift = (empId: string, day: string) => {
    const shiftOptions = ['Morning Shift', 'Break Shift', 'Night Shift', 'OFF']
    const current = roster[empId]?.[day] || 'Morning Shift'
    const nextIdx = (shiftOptions.indexOf(current) + 1) % shiftOptions.length
    const nextShift = shiftOptions[nextIdx]

    setRoster(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [day]: nextShift,
      },
    }))
  }

  // Week calculation helpers
  const handlePrevWeek = () => {
    setSelectedMonday(prev => {
      const n = new Date(prev)
      n.setDate(n.getDate() - 7)
      return n
    })
  }

  const handleNextWeek = () => {
    setSelectedMonday(prev => {
      const n = new Date(prev)
      n.setDate(n.getDate() + 7)
      return n
    })
  }

  const handleToday = () => {
    setSelectedMonday(getMonday(new Date()))
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const parts = e.target.value.split('-')
      if (parts.length === 3) {
        const picked = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        setSelectedMonday(getMonday(picked))
      }
    }
  }

  // Generate 7 days for the current week view
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()
  const todayDay = today.getDate()
  const todayMonth = today.getMonth()
  const todayYear = today.getFullYear()

  const weekDays = dayNames.map((dayName, idx) => {
    const d = new Date(selectedMonday)
    d.setDate(selectedMonday.getDate() + idx)
    const isToday =
      d.getDate() === todayDay && d.getMonth() === todayMonth && d.getFullYear() === todayYear
    const isSat = dayName === 'Sat'
    const isSun = dayName === 'Sun'

    return {
      dayKey: dayName,
      label: dayName,
      dateNum: d.getDate().toString().padStart(2, '0'),
      monthName: d.toLocaleDateString('en-GB', { month: 'short' }),
      isToday,
      isSat,
      isSun,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {message && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--success)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{message}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.2rem' }}>
            ×
          </button>
        </div>
      )}

      {/* Shifts Cards Header & List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ color: 'var(--text-main)', margin: 0 }}>Defined Shifts</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hotel staff schedules with Fixed, Split / Break, and Night duties</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleOpenCreateBreakShift}
              style={{
                borderColor: '#0ea5e9',
                color: '#38bdf8',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>☕ + Break Shift</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (showForm) {
                  resetForm()
                } else {
                  resetForm()
                  setShowForm(true)
                }
              }}
            >
              {showForm ? 'Cancel' : '+ New Shift'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--primary)', animation: 'fadeIn 0.2s ease-in-out' }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editingShiftId ? '✏️ Edit Shift' : '✨ Create New Shift'}
            </h3>
            <form onSubmit={handleSaveShift} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Shift Name *</label>
                  <input
                    required
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Break Shift, Morning Shift"
                  />
                </div>
                <div className="form-group">
                  <label>Shift Type *</label>
                  <select
                    className="form-input"
                    value={form.type}
                    onChange={e => {
                      const newType = e.target.value
                      setForm(p => ({
                        ...p,
                        type: newType,
                        name: newType === 'BREAK' && (!p.name || p.name === 'Morning Shift' || p.name === 'Evening Shift') ? 'Break Shift' : p.name,
                      }))
                    }}
                  >
                    <option value="BREAK">Break / Split Shift (Morning + Evening)</option>
                    <option value="FIXED">Fixed Regular Shift</option>
                    <option value="ROTATING">Rotating Shift</option>
                    <option value="NIGHT">Night Shift</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    className="form-input"
                    value={form.graceMinutes}
                    onChange={e => setForm(p => ({ ...p, graceMinutes: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Conditional Timing Inputs based on Type */}
              {form.type === 'BREAK' || form.type === 'SPLIT' ? (
                <div
                  style={{
                    backgroundColor: 'rgba(14, 165, 233, 0.06)',
                    border: '1px solid rgba(14, 165, 233, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.95rem' }}>
                      ⏱ Break Shift Schedule (Split Hours)
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Morning Duty + Afternoon Break + Evening Duty
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {/* Morning Slot */}
                    <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.5rem' }}>
                        🌅 Morning Slot (Part 1)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In-Time</label>
                          <input
                            required
                            type="time"
                            className="form-input"
                            value={form.morningStart}
                            onChange={e => setForm(p => ({ ...p, morningStart: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Out-Time</label>
                          <input
                            required
                            type="time"
                            className="form-input"
                            value={form.morningEnd}
                            onChange={e => setForm(p => ({ ...p, morningEnd: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Evening Slot */}
                    <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.5rem' }}>
                        🌆 Evening Slot (Part 2)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In-Time</label>
                          <input
                            required
                            type="time"
                            className="form-input"
                            value={form.eveningStart}
                            onChange={e => setForm(p => ({ ...p, eveningStart: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Out-Time</label>
                          <input
                            required
                            type="time"
                            className="form-input"
                            value={form.eveningEnd}
                            onChange={e => setForm(p => ({ ...p, eveningEnd: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <span>☕ <b>Afternoon Break:</b> {form.morningEnd} – {form.eveningStart}</span>
                    <span>🕒 <b>Duty Schedule:</b> Morning ({form.morningStart} – {form.morningEnd}) & Evening ({form.eveningStart} – {form.eveningEnd})</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Shift Start Time *</label>
                    <input
                      required
                      type="time"
                      className="form-input"
                      value={form.startTime}
                      onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Shift End Time *</label>
                    <input
                      required
                      type="time"
                      className="form-input"
                      value={form.endTime}
                      onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '140px' }}>
                  {loading ? 'Saving...' : editingShiftId ? 'Update Shift' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {shifts.map(shift => {
            const isBreak = shift.type === 'BREAK' || shift.type === 'SPLIT'
            const badgeColor = SHIFT_TYPE_COLOR[shift.type] || '#10b981'

            return (
              <div
                key={shift.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  border: isBreak ? '1px solid rgba(14, 165, 233, 0.4)' : undefined,
                  boxShadow: isBreak ? '0 4px 20px rgba(14, 165, 233, 0.1)' : undefined,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top indicator bar for Break shift */}
                {isBreak && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                    }}
                  />
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
                        {shift.name}
                      </h3>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: `${badgeColor}22`,
                          color: badgeColor,
                          fontWeight: 600,
                          fontSize: '0.72rem',
                          border: `1px solid ${badgeColor}44`,
                        }}
                      >
                        {isBreak ? 'BREAK / SPLIT' : shift.type}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        onClick={() => handleEditShift(shift)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          padding: '0.2rem 0.5rem',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                        title="Edit Shift"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteShift(shift.id, shift.name)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          padding: '0.2rem 0.5rem',
                          color: 'var(--danger, #ef4444)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                        title="Delete Shift"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Timing representation */}
                  {isBreak ? (
                    <div
                      style={{
                        padding: '0.75rem',
                        backgroundColor: 'rgba(14, 165, 233, 0.05)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(14, 165, 233, 0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          🌅 <b>Morning:</b>
                        </span>
                        <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem' }}>
                          {shift.firstSlot || '10:00 – 14:00'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          🌆 <b>Evening:</b>
                        </span>
                        <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.95rem' }}>
                          {shift.secondSlot || '18:00 – 22:00'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.25rem', letterSpacing: '0.5px' }}>
                        {shift.startTime} – {shift.endTime}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer details */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '0.65rem',
                  }}
                >
                  <span>⏱ Grace: {shift.graceMinutes} mins</span>
                  <span>
                    {isBreak
                      ? `☕ Break: ${shift.breakTime || '14:00 – 18:00'}`
                      : shift.type === 'NIGHT'
                      ? '🌙 Night Duty'
                      : '☀️ Day Duty'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly Roster Grid Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <h2 style={{ color: 'var(--text-main)', margin: 0 }}>Weekly Roster</h2>
              {/* Shift Legend & Weekend Indicators */}
              <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', fontSize: '0.72rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span> Morning
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0ea5e9' }}></span> Break
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></span> Night
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.35rem', color: '#f59e0b', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'rgba(245, 158, 11, 0.6)' }}></span> Sat (Weekend)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#f43f5e', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'rgba(244, 63, 94, 0.6)' }}></span> Sun (Weekly Off)
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any shift cell to toggle duty between Morning, Break, Night, and OFF
            </span>
          </div>

          {/* Calendar & Local Time Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Live Local Time Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.85rem',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                color: 'var(--success)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.3px',
              }}
              title={`Local Date: ${currentDateStr}`}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)',
                  display: 'inline-block',
                  boxShadow: '0 0 8px var(--success)',
                }}
              />
              <span>🕒 Local Time: <b>{currentTime || '--:--:--'}</b></span>
            </div>

            {/* Interactive Calendar Week Selector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.2rem 0.35rem',
                gap: '0.25rem',
              }}
            >
              <button
                type="button"
                onClick={handlePrevWeek}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.3rem 0.55rem',
                  borderRadius: '4px',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                }}
                title="Previous Week"
              >
                ‹
              </button>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  }}
                  title="Click to open Calendar picker"
                >
                  <span style={{ fontSize: '0.9rem' }}>📅</span>
                  <span>{formatWeekRange(selectedMonday)}</span>
                  <input
                    type="date"
                    onChange={handleDateChange}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      left: 0,
                      top: 0,
                      cursor: 'pointer',
                    }}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleNextWeek}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.3rem 0.55rem',
                  borderRadius: '4px',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                }}
                title="Next Week"
              >
                ›
              </button>

              <button
                type="button"
                onClick={handleToday}
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '4px',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  marginLeft: '0.2rem',
                }}
                title="Jump to Current Week"
              >
                Current Week
              </button>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--bg-main)' }}>
              <tr>
                <th
                  style={{
                    padding: '0.875rem 1.25rem',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    minWidth: '170px',
                  }}
                >
                  Employee
                </th>
                {weekDays.map(d => {
                  // Separate highlight styling for Saturday and Sunday
                  const headerBg = d.isToday
                    ? 'rgba(14, 165, 233, 0.12)'
                    : d.isSat
                    ? 'rgba(245, 158, 11, 0.1)'
                    : d.isSun
                    ? 'rgba(244, 63, 94, 0.1)'
                    : undefined

                  const headerTextColor = d.isToday
                    ? '#38bdf8'
                    : d.isSat
                    ? '#f59e0b'
                    : d.isSun
                    ? '#f43f5e'
                    : 'var(--text-muted)'

                  const headerBorderBottom = d.isToday
                    ? '2px solid #0ea5e9'
                    : d.isSat
                    ? '2px solid #f59e0b'
                    : d.isSun
                    ? '2px solid #f43f5e'
                    : '1px solid var(--border)'

                  return (
                    <th
                      key={d.dayKey}
                      style={{
                        padding: '0.75rem 0.85rem',
                        textAlign: 'center',
                        fontWeight: 600,
                        color: headerTextColor,
                        fontSize: '0.8rem',
                        backgroundColor: headerBg,
                        borderBottom: headerBorderBottom,
                        borderLeft: d.isSat ? '1px dashed rgba(245, 158, 11, 0.3)' : d.isSun ? '1px dashed rgba(244, 63, 94, 0.3)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{d.label}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', opacity: d.isToday || d.isSat || d.isSun ? 1 : 0.7 }}>
                          {d.dateNum} {d.monthName}
                        </span>
                        {d.isToday && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              backgroundColor: '#0ea5e9',
                              color: '#fff',
                              fontWeight: 700,
                              marginTop: '0.15rem',
                              letterSpacing: '0.4px',
                            }}
                          >
                            TODAY
                          </span>
                        )}
                        {!d.isToday && d.isSat && (
                          <span
                            style={{
                              fontSize: '0.6rem',
                              padding: '1px 5px',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                              color: '#f59e0b',
                              fontWeight: 700,
                              marginTop: '0.15rem',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                            }}
                          >
                            SAT
                          </span>
                        )}
                        {!d.isToday && d.isSun && (
                          <span
                            style={{
                              fontSize: '0.6rem',
                              padding: '1px 5px',
                              borderRadius: '999px',
                              backgroundColor: 'rgba(244, 63, 94, 0.2)',
                              color: '#f43f5e',
                              fontWeight: 700,
                              marginTop: '0.15rem',
                              border: '1px solid rgba(244, 63, 94, 0.4)',
                            }}
                          >
                            SUN OFF
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {MOCK_EMPLOYEES.map(emp => (
                <tr key={emp.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.designation}</div>
                  </td>
                  {weekDays.map(d => {
                    const assignment = roster[emp.id]?.[d.dayKey] || 'Unassigned'
                    const isOff = assignment === 'OFF'
                    const isNight = assignment === 'Night Shift'
                    const isBreak = assignment === 'Break Shift'

                    // Column background for Today, Sat, Sun
                    const cellColBg = d.isToday
                      ? 'rgba(14, 165, 233, 0.03)'
                      : d.isSat
                      ? 'rgba(245, 158, 11, 0.03)'
                      : d.isSun
                      ? 'rgba(244, 63, 94, 0.03)'
                      : undefined

                    // Button badges styling
                    let bgColor = 'rgba(16, 185, 129, 0.12)'
                    let textColor = 'var(--success)'
                    let borderColor = 'transparent'

                    if (isOff) {
                      if (d.isSun) {
                        // Sunday off: highlighted in soft rose red
                        bgColor = 'rgba(244, 63, 94, 0.15)'
                        textColor = '#f43f5e'
                        borderColor = 'rgba(244, 63, 94, 0.3)'
                      } else if (d.isSat) {
                        // Saturday off: highlighted in soft amber
                        bgColor = 'rgba(245, 158, 11, 0.15)'
                        textColor = '#f59e0b'
                        borderColor = 'rgba(245, 158, 11, 0.3)'
                      } else {
                        bgColor = 'rgba(100, 116, 139, 0.1)'
                        textColor = 'var(--text-muted)'
                      }
                    } else if (isNight) {
                      bgColor = 'rgba(139, 92, 246, 0.15)'
                      textColor = '#8b5cf6'
                      borderColor = 'rgba(139, 92, 246, 0.3)'
                    } else if (isBreak) {
                      bgColor = 'rgba(14, 165, 233, 0.15)'
                      textColor = '#0ea5e9'
                      borderColor = 'rgba(14, 165, 233, 0.35)'
                    }

                    return (
                      <td
                        key={d.dayKey}
                        style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          backgroundColor: cellColBg,
                          borderLeft: d.isSat ? '1px dashed rgba(245, 158, 11, 0.15)' : d.isSun ? '1px dashed rgba(244, 63, 94, 0.15)' : undefined,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => cycleRosterShift(emp.id, d.dayKey)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: bgColor,
                            color: textColor,
                            border: `1px solid ${borderColor}`,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease-in-out',
                          }}
                          title={`Click to toggle shift (${d.dayKey}: ${assignment})`}
                        >
                          {isOff ? (d.isSun ? 'OFF' : d.isSat ? 'OFF' : '—') : assignment.replace(' Shift', '')}
                        </button>
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
