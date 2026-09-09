'use client'

import React, { useState, useEffect, useMemo } from 'react'

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
  { id: 'e1', code: 'GG-1001', name: 'Raman Mankotia', designation: 'General Manager', branch: 'Hotel Grand Godwin', dept: 'Front Office' },
  { id: 'e2', code: 'GG-1002', name: 'Priya Sharma', designation: 'Front Desk Executive', branch: 'Hotel Grand Godwin', dept: 'Front Office' },
  { id: 'e3', code: 'GD-1001', name: 'Rajiv Kumar', designation: 'Housekeeping Supervisor', branch: 'Hotel Godwin Deluxe', dept: 'Housekeeping' },
  { id: 'e4', code: 'GD-1002', name: 'Sunita Verma', designation: 'Security Officer', branch: 'Hotel Godwin Deluxe', dept: 'Security' },
  { id: 'e5', code: 'GG-1003', name: 'Amit Singh', designation: 'Accounts Executive', branch: 'Hotel Grand Godwin', dept: 'Accounts' },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const INITIAL_WEEKLY_ROSTER: Record<string, Record<string, string>> = {
  'e1': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Morning Shift', Sat: 'OFF', Sun: 'OFF' },
  'e2': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Break Shift', Thu: 'Break Shift', Fri: 'Morning Shift', Sat: 'Morning Shift', Sun: 'OFF' },
  'e3': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Night Shift', Sat: 'Night Shift', Sun: 'OFF' },
  'e4': { Mon: 'Night Shift', Tue: 'Night Shift', Wed: 'Night Shift', Thu: 'OFF', Fri: 'Night Shift', Sat: 'Night Shift', Sun: 'Night Shift' },
  'e5': { Mon: 'Morning Shift', Tue: 'Morning Shift', Wed: 'Morning Shift', Thu: 'Morning Shift', Fri: 'Morning Shift', Sat: 'OFF', Sun: 'OFF' },
}

// Generate realistic monthly roster pattern
function generateInitialMonthlyRoster(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const res: Record<string, Record<number, string>> = {}

  MOCK_EMPLOYEES.forEach(emp => {
    res[emp.id] = {}
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      const dayOfWeek = d.getDay() // 0 = Sun, 6 = Sat

      if (emp.id === 'e1') {
        // Raman Mankotia: GM (Mon-Sat Morning, Sun OFF)
        res[emp.id][day] = dayOfWeek === 0 ? 'OFF' : 'Morning Shift'
      } else if (emp.id === 'e2') {
        // Priya Sharma: Front Desk (Wed & Thu Break Shift, Sun OFF, rest Morning)
        if (dayOfWeek === 0) res[emp.id][day] = 'OFF'
        else if (dayOfWeek === 3 || dayOfWeek === 4) res[emp.id][day] = 'Break Shift'
        else res[emp.id][day] = 'Morning Shift'
      } else if (emp.id === 'e3') {
        // Rajiv Kumar: Housekeeping (Fri-Sat Night, Sun OFF, rest Morning)
        if (dayOfWeek === 0) res[emp.id][day] = 'OFF'
        else if (dayOfWeek === 5 || dayOfWeek === 6) res[emp.id][day] = 'Night Shift'
        else res[emp.id][day] = 'Morning Shift'
      } else if (emp.id === 'e4') {
        // Sunita Verma: Security (Night Shift, Thu OFF, works Sunday)
        res[emp.id][day] = dayOfWeek === 4 ? 'OFF' : 'Night Shift'
      } else if (emp.id === 'e5') {
        // Amit Singh: Accounts (Mon-Fri Morning, Sat-Sun OFF)
        res[emp.id][day] = (dayOfWeek === 0 || dayOfWeek === 6) ? 'OFF' : 'Morning Shift'
      } else {
        res[emp.id][day] = dayOfWeek === 0 ? 'OFF' : 'Morning Shift'
      }
    }
  })

  return res
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
  const [roster, setRoster] = useState<Record<string, Record<string, string>>>(INITIAL_WEEKLY_ROSTER)
  const [showForm, setShowForm] = useState(false)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Live Local Time
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDateStr, setCurrentDateStr] = useState<string>('')

  // Roster View Mode: 'MONTHLY' | 'WEEKLY'
  const [rosterViewMode, setRosterViewMode] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY')
  const [isRosterFullscreen, setIsRosterFullscreen] = useState(false)

  // Monthly Roster State
  const [selectedMonth, setSelectedMonth] = useState<number>(8) // September (0-indexed)
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [monthlyRoster, setMonthlyRoster] = useState<Record<string, Record<number, string>>>(() =>
    generateInitialMonthlyRoster(2026, 8)
  )
  const [branchFilter, setBranchFilter] = useState<string>('ALL')

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
      if (parts.length === 2) {
        mStart = parts[0]
        mEnd = parts[1]
      }
    }
    if (shift.secondSlot) {
      const parts = shift.secondSlot.split('–').map(s => s.trim())
      if (parts.length === 2) {
        eStart = parts[0]
        eEnd = parts[1]
      }
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
              ? { ...s, ...payload }
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
              ? { ...s, ...payload }
              : s
          )
        )
      } else {
        setShifts(prev => [
          ...prev,
          { id: 'shift-' + Date.now(), ...payload },
        ])
      }
      setMessage('✅ Saved (offline mode)')
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  // Weekly shift toggle
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

  // Monthly shift toggle
  const cycleMonthlyRosterShift = (empId: string, dayNum: number) => {
    const shiftOptions = ['Morning Shift', 'Break Shift', 'Night Shift', 'OFF']
    const current = monthlyRoster[empId]?.[dayNum] || 'Morning Shift'
    const nextIdx = (shiftOptions.indexOf(current) + 1) % shiftOptions.length
    const nextShift = shiftOptions[nextIdx]

    setMonthlyRoster(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [dayNum]: nextShift,
      }
    }))
  }

  // Month navigation handlers
  const handleMonthChange = (newMonth: number, newYear: number) => {
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    setMonthlyRoster(generateInitialMonthlyRoster(newYear, newMonth))
  }

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      handleMonthChange(11, selectedYear - 1)
    } else {
      handleMonthChange(selectedMonth - 1, selectedYear)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      handleMonthChange(0, selectedYear + 1)
    } else {
      handleMonthChange(selectedMonth + 1, selectedYear)
    }
  }

  const handleCurrentMonth = () => {
    const now = new Date()
    handleMonthChange(now.getMonth(), now.getFullYear())
  }

  // Auto-populate monthly shifts pattern
  const handleAutoPopulateMonth = () => {
    setMonthlyRoster(generateInitialMonthlyRoster(selectedYear, selectedMonth))
    setMessage(`✨ Auto-populated standard hotel duty patterns for ${MONTH_NAMES[selectedMonth]} ${selectedYear}.`)
  }

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate()
  }, [selectedYear, selectedMonth])

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [daysInMonth])

  const filteredEmployees = useMemo(() => {
    if (branchFilter === 'ALL') return MOCK_EMPLOYEES
    return MOCK_EMPLOYEES.filter(e => e.branch.includes(branchFilter))
  }, [branchFilter])

  // Monthly CSV Export
  const handleDownloadMonthlyCSV = () => {
    const dayHeaders = daysArray.map(d => `"${d} ${MONTH_NAMES[selectedMonth].slice(0, 3)}"`)
    const headers = [
      '"Employee ID"',
      '"Employee Name"',
      '"Designation"',
      '"Branch"',
      ...dayHeaders,
      '"Morning (M)"',
      '"Break (B)"',
      '"Night (N)"',
      '"Weekly Off (OFF)"',
      '"Total Work Days"'
    ]

    const rows = filteredEmployees.map(emp => {
      const empRoster = monthlyRoster[emp.id] || {}
      const dayValues = daysArray.map(d => `"${empRoster[d] || 'OFF'}"`)

      let mCount = 0
      let bCount = 0
      let nCount = 0
      let offCount = 0

      daysArray.forEach(d => {
        const s = empRoster[d]
        if (s === 'Morning Shift') mCount++
        else if (s === 'Break Shift') bCount++
        else if (s === 'Night Shift') nCount++
        else offCount++
      })

      const workDays = mCount + bCount + nCount

      return [
        `"${emp.code}"`,
        `"${emp.name}"`,
        `"${emp.designation}"`,
        `"${emp.branch}"`,
        ...dayValues,
        mCount,
        bCount,
        nCount,
        offCount,
        workDays
      ]
    })

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `monthly-roster-${MONTH_NAMES[selectedMonth]}-${selectedYear}.csv`
    link.click()
    URL.revokeObjectURL(url)
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

  // Generate 7 days for current week view
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
    <div
      style={
        isRosterFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 99999,
              backgroundColor: 'var(--bg-main)',
              padding: '1.25rem 2rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }
          : {
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
              width: '100%'
            }
      }
    >
      {message && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--success)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.875rem'
          }}
        >
          <span>{message}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.2rem' }}>
            ×
          </button>
        </div>
      )}

      {/* Shifts Definition Header Cards (Hidden in Fullscreen Roster Mode for Focus) */}
      {!isRosterFullscreen && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.4rem' }}>Defined Shifts</h2>
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
                          name: newType === 'BREAK' ? 'Break Shift' : p.name,
                        }))
                      }}
                    >
                      <option value="FIXED">Fixed (Standard 8-9 Hours)</option>
                      <option value="BREAK">Split / Break Shift (Morning + Evening)</option>
                      <option value="NIGHT">Night Duty (Overnight)</option>
                      <option value="ROTATING">Rotating</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Hotel Branch</label>
                    <select
                      className="form-input"
                      value={form.branchId}
                      onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
                    >
                      <option value="mock-1">Hotel Grand Godwin (Pahar Ganj)</option>
                      <option value="mock-2">Hotel Godwin Deluxe (Pahar Ganj)</option>
                      <option value="mock-3">Indian Grill Rooftop</option>
                      <option value="mock-4">Cafe Brownie Lobby</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Grace Period (Minutes)</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      className="form-input"
                      value={form.graceMinutes}
                      onChange={e => setForm(p => ({ ...p, graceMinutes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                {form.type === 'BREAK' ? (
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: 'rgba(14, 165, 233, 0.05)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(14, 165, 233, 0.2)',
                    }}
                  >
                    <h4 style={{ color: '#38bdf8', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                      ☕ Break Shift Dual Slot Configuration
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div className="form-group">
                        <label>🌅 Morning Slot Start</label>
                        <input
                          type="time"
                          className="form-input"
                          value={form.morningStart}
                          onChange={e => setForm(p => ({ ...p, morningStart: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>🌅 Morning Slot End</label>
                        <input
                          type="time"
                          className="form-input"
                          value={form.morningEnd}
                          onChange={e => setForm(p => ({ ...p, morningEnd: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>🌆 Evening Slot Start</label>
                        <input
                          type="time"
                          className="form-input"
                          value={form.eveningStart}
                          onChange={e => setForm(p => ({ ...p, eveningStart: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>🌆 Evening Slot End</label>
                        <input
                          type="time"
                          className="form-input"
                          value={form.eveningEnd}
                          onChange={e => setForm(p => ({ ...p, eveningEnd: e.target.value }))}
                        />
                      </div>
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
      )}

      {/* Main Roster Card: Supporting Monthly & Weekly Options */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* Top Control Bar with View Switcher */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>📅</span>
                <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                  Staff Duty Roster
                </h2>
              </div>

              {/* View Switcher: Monthly vs Weekly */}
              <div
                style={{
                  display: 'inline-flex',
                  backgroundColor: 'var(--bg-main)',
                  padding: '3px',
                  borderRadius: '9px',
                  border: '1px solid var(--border)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setRosterViewMode('MONTHLY')}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '7px',
                    border: 'none',
                    background: rosterViewMode === 'MONTHLY' ? 'var(--primary)' : 'transparent',
                    color: rosterViewMode === 'MONTHLY' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  📆 Monthly Roster
                </button>
                <button
                  type="button"
                  onClick={() => setRosterViewMode('WEEKLY')}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '7px',
                    border: 'none',
                    background: rosterViewMode === 'WEEKLY' ? 'var(--primary)' : 'transparent',
                    color: rosterViewMode === 'WEEKLY' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  📅 Weekly Roster
                </button>
              </div>
            </div>

            {/* Shift Badges Legend */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 700 }}>M</span> Morning (09-18)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(14, 165, 233, 0.2)', color: '#0ea5e9', fontWeight: 700 }}>B</span> Break Shift
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6', fontWeight: 700 }}>N</span> Night Duty
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'rgba(245, 158, 11, 0.7)' }}></span> Sat (Weekend)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#f43f5e', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'rgba(244, 63, 94, 0.7)' }}></span> Sun (Weekly Off)
              </span>
            </div>
          </div>

          {/* Right Action Controls: Live Time, Fullscreen, CSV, Print */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Live Clock */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: 'var(--success)',
                fontWeight: 600,
              }}
              title={`Local Date: ${currentDateStr}`}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }} />
              <span>🕒 <b>{currentTime || '--:--'}</b></span>
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsRosterFullscreen(!isRosterFullscreen)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              title={isRosterFullscreen ? 'Exit Fullscreen' : 'Open Fullscreen Window'}
            >
              {isRosterFullscreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen Window'}
            </button>

            {/* Export CSV */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDownloadMonthlyCSV}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              title="Download full monthly roster as CSV"
            >
              📥 Export CSV
            </button>

            {/* Print */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => window.print()}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              title="Print Monthly Roster"
            >
              🖨️ Print
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* OPTION 1: MONTHLY ROSTER VIEW */}
        {/* ========================================================================= */}
        {rosterViewMode === 'MONTHLY' && (
          <div>
            {/* Month Navigation & Filtering Sub-bar */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                backgroundColor: 'var(--bg-main)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>Month:</span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handlePrevMonth}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  ◀ Prev
                </button>

                <select
                  className="form-input"
                  style={{ width: '135px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                  value={selectedMonth}
                  onChange={e => handleMonthChange(Number(e.target.value), selectedYear)}
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>

                <select
                  className="form-input"
                  style={{ width: '95px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                  value={selectedYear}
                  onChange={e => handleMonthChange(selectedMonth, Number(e.target.value))}
                >
                  {[2026, 2025, 2024].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleNextMonth}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  Next ▶
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCurrentMonth}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                >
                  This Month
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Branch:</label>
                  <select
                    className="form-input"
                    style={{ width: '190px', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                  >
                    <option value="ALL">🏨 All Branches</option>
                    <option value="Grand Godwin">Hotel Grand Godwin</option>
                    <option value="Godwin Deluxe">Hotel Godwin Deluxe</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleAutoPopulateMonth}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                  title="Auto-fill standard duty pattern across all days of the month"
                >
                  ✨ Auto-Fill Pattern
                </button>
              </div>
            </div>

            {/* Monthly Calendar Matrix Table */}
            <div style={{ overflowX: 'auto', maxHeight: isRosterFullscreen ? 'calc(100vh - 180px)' : '750px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', position: 'sticky', top: 0, zIndex: 10 }}>
                    {/* Sticky Employee Header */}
                    <th
                      style={{
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        minWidth: '200px',
                        position: 'sticky',
                        left: 0,
                        backgroundColor: 'var(--bg-card)',
                        zIndex: 11,
                        borderRight: '2px solid var(--border)',
                        borderBottom: '2px solid var(--border)',
                      }}
                    >
                      Employee ({filteredEmployees.length})
                    </th>

                    {/* Day Columns 1 to 30/31 */}
                    {daysArray.map(dayNum => {
                      const d = new Date(selectedYear, selectedMonth, dayNum)
                      const dayOfWeekNum = d.getDay()
                      const dayOfWeekName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekNum]
                      const isSun = dayOfWeekNum === 0
                      const isSat = dayOfWeekNum === 6
                      const isToday =
                        d.getDate() === todayDay && d.getMonth() === todayMonth && d.getFullYear() === todayYear

                      const headerBg = isToday
                        ? 'rgba(14, 165, 233, 0.18)'
                        : isSat
                        ? 'rgba(245, 158, 11, 0.12)'
                        : isSun
                        ? 'rgba(244, 63, 94, 0.12)'
                        : undefined

                      const headerTextColor = isToday
                        ? '#38bdf8'
                        : isSat
                        ? '#f59e0b'
                        : isSun
                        ? '#f43f5e'
                        : 'var(--text-muted)'

                      return (
                        <th
                          key={dayNum}
                          style={{
                            padding: '0.5rem 0.35rem',
                            textAlign: 'center',
                            minWidth: '38px',
                            backgroundColor: headerBg,
                            color: headerTextColor,
                            borderBottom: isToday ? '2px solid #0ea5e9' : '2px solid var(--border)',
                            borderLeft: isSat ? '1px dashed rgba(245, 158, 11, 0.3)' : isSun ? '1px dashed rgba(244, 63, 94, 0.3)' : '1px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{dayNum.toString().padStart(2, '0')}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{dayOfWeekName}</span>
                            {isToday && (
                              <span style={{ fontSize: '0.55rem', backgroundColor: '#0ea5e9', color: '#fff', padding: '1px 3px', borderRadius: '3px', fontWeight: 800 }}>
                                NOW
                              </span>
                            )}
                          </div>
                        </th>
                      )
                    })}

                    {/* Summary Columns */}
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#10b981', minWidth: '45px', borderBottom: '2px solid var(--border)', borderLeft: '2px solid var(--border)' }} title="Morning Shifts">☀️ M</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#0ea5e9', minWidth: '45px', borderBottom: '2px solid var(--border)' }} title="Break Shifts">☕ B</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#8b5cf6', minWidth: '45px', borderBottom: '2px solid var(--border)' }} title="Night Shifts">🌙 N</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#f43f5e', minWidth: '45px', borderBottom: '2px solid var(--border)' }} title="Weekly Off Days">🏖️ OFF</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: 'var(--text-main)', minWidth: '65px', borderBottom: '2px solid var(--border)', fontWeight: 700 }} title="Total Duty Days">Work Days</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const empRoster = monthlyRoster[emp.id] || {}

                    let morningCount = 0
                    let breakCount = 0
                    let nightCount = 0
                    let offCount = 0

                    daysArray.forEach(d => {
                      const s = empRoster[d]
                      if (s === 'Morning Shift') morningCount++
                      else if (s === 'Break Shift') breakCount++
                      else if (s === 'Night Shift') nightCount++
                      else offCount++
                    })

                    const totalWorkDays = morningCount + breakCount + nightCount

                    return (
                      <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        {/* Sticky Employee Info Cell */}
                        <td
                          style={{
                            padding: '0.65rem 1rem',
                            position: 'sticky',
                            left: 0,
                            backgroundColor: 'var(--bg-card)',
                            zIndex: 2,
                            borderRight: '2px solid var(--border)',
                          }}
                        >
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{emp.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{emp.code}</span> • {emp.designation}
                          </div>
                        </td>

                        {/* Days Shift Cells */}
                        {daysArray.map(dayNum => {
                          const assignment = empRoster[dayNum] || 'Morning Shift'
                          const d = new Date(selectedYear, selectedMonth, dayNum)
                          const dayOfWeekNum = d.getDay()
                          const isSun = dayOfWeekNum === 0
                          const isSat = dayOfWeekNum === 6
                          const isToday =
                            d.getDate() === todayDay && d.getMonth() === todayMonth && d.getFullYear() === todayYear

                          // Badge styling
                          let badgeBg = 'rgba(16, 185, 129, 0.18)'
                          let badgeColor = '#10b981'
                          let badgeText = 'M'
                          let title = 'Morning Shift (09:00 - 18:00)'

                          if (assignment === 'Break Shift') {
                            badgeBg = 'rgba(14, 165, 233, 0.18)'
                            badgeColor = '#0ea5e9'
                            badgeText = 'B'
                            title = 'Break Shift (10:00 - 14:00 & 18:00 - 22:00)'
                          } else if (assignment === 'Night Shift') {
                            badgeBg = 'rgba(139, 92, 246, 0.18)'
                            badgeColor = '#8b5cf6'
                            badgeText = 'N'
                            title = 'Night Duty (22:00 - 07:00)'
                          } else if (assignment === 'OFF') {
                            badgeBg = isSun ? 'rgba(244, 63, 94, 0.18)' : isSat ? 'rgba(245, 158, 11, 0.18)' : 'rgba(100, 116, 139, 0.12)'
                            badgeColor = isSun ? '#f43f5e' : isSat ? '#f59e0b' : '#94a3b8'
                            badgeText = 'OFF'
                            title = 'Weekly Off'
                          }

                          return (
                            <td
                              key={dayNum}
                              style={{
                                padding: '0.4rem 0.25rem',
                                textAlign: 'center',
                                backgroundColor: isToday ? 'rgba(14, 165, 233, 0.05)' : isSat ? 'rgba(245, 158, 11, 0.03)' : isSun ? 'rgba(244, 63, 94, 0.03)' : undefined,
                                borderLeft: isSat ? '1px dashed rgba(245, 158, 11, 0.15)' : isSun ? '1px dashed rgba(244, 63, 94, 0.15)' : '1px solid var(--border)',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => cycleMonthlyRosterShift(emp.id, dayNum)}
                                style={{
                                  width: '32px',
                                  height: '28px',
                                  borderRadius: '5px',
                                  backgroundColor: badgeBg,
                                  color: badgeColor,
                                  border: `1px solid ${badgeColor}40`,
                                  fontSize: badgeText === 'OFF' ? '0.65rem' : '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                  padding: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title={`${emp.name} — ${dayNum} ${MONTH_NAMES[selectedMonth]}: ${title} (Click to change)`}
                              >
                                {badgeText}
                              </button>
                            </td>
                          )
                        })}

                        {/* Summary Columns per Employee */}
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#10b981', borderLeft: '2px solid var(--border)' }}>
                          {morningCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#0ea5e9' }}>
                          {breakCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#8b5cf6' }}>
                          {nightCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#f43f5e' }}>
                          {offCount}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                          {totalWorkDays}d
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Monthly Legend & Instructions */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                borderTop: '1px solid var(--border)',
                backgroundColor: 'var(--bg-main)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                fontSize: '0.775rem',
                color: 'var(--text-muted)'
              }}
            >
              <div>
                💡 <b>Quick Edit:</b> Click any cell to cycle shifts: <b>M (Morning)</b> ➔ <b>B (Break)</b> ➔ <b>N (Night)</b> ➔ <b>OFF (Weekly Off)</b>.
              </div>
              <div>
                Showing <b>{daysInMonth} Days</b> in {MONTH_NAMES[selectedMonth]} {selectedYear}. All duties synchronize with biometric logs.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OPTION 2: WEEKLY ROSTER VIEW */}
        {/* ========================================================================= */}
        {rosterViewMode === 'WEEKLY' && (
          <div>
            {/* Weekly Navigation Bar */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                backgroundColor: 'var(--bg-main)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>Week:</span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handlePrevWeek}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  ◀ Prev Week
                </button>

                <span
                  style={{
                    padding: '0.3rem 0.75rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '6px',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    position: 'relative'
                  }}
                >
                  {formatWeekRange(selectedMonday)}
                  <input
                    type="date"
                    onChange={handleDateChange}
                    style={{ position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    title="Click to pick week date"
                  />
                </span>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleNextWeek}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  Next Week ▶
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleToday}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                >
                  Current Week
                </button>
              </div>

              <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                Click cell to toggle between Morning, Break, Night & OFF.
              </span>
            </div>

            {/* Weekly Table */}
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
                        minWidth: '180px',
                      }}
                    >
                      Employee
                    </th>
                    {weekDays.map(d => {
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
                            borderBottom: d.isToday ? '2px solid #0ea5e9' : d.isSat ? '2px solid #f59e0b' : d.isSun ? '2px solid #f43f5e' : '1px solid var(--border)',
                            borderLeft: d.isSat ? '1px dashed rgba(245, 158, 11, 0.3)' : d.isSun ? '1px dashed rgba(244, 63, 94, 0.3)' : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{d.label}</span>
                            <span style={{ fontSize: '0.72rem', opacity: d.isToday || d.isSat || d.isSun ? 1 : 0.7 }}>
                              {d.dateNum} {d.monthName}
                            </span>
                            {d.isToday && (
                              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '999px', backgroundColor: '#0ea5e9', color: '#fff', fontWeight: 700 }}>
                                TODAY
                              </span>
                            )}
                            {!d.isToday && d.isSat && (
                              <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '999px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                                SAT
                              </span>
                            )}
                            {!d.isToday && d.isSun && (
                              <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '999px', backgroundColor: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', fontWeight: 700, border: '1px solid rgba(244, 63, 94, 0.4)' }}>
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
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{emp.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{emp.code}</span> • {emp.designation}
                        </div>
                      </td>
                      {weekDays.map(d => {
                        const assignment = roster[emp.id]?.[d.dayKey] || 'Unassigned'
                        const isOff = assignment === 'OFF'
                        const isNight = assignment === 'Night Shift'
                        const isBreak = assignment === 'Break Shift'

                        let bgColor = 'rgba(16, 185, 129, 0.12)'
                        let textColor = 'var(--success)'
                        let borderColor = 'transparent'

                        if (isOff) {
                          if (d.isSun) {
                            bgColor = 'rgba(244, 63, 94, 0.15)'
                            textColor = '#f43f5e'
                            borderColor = 'rgba(244, 63, 94, 0.3)'
                          } else if (d.isSat) {
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
                              backgroundColor: d.isToday ? 'rgba(14, 165, 233, 0.03)' : d.isSat ? 'rgba(245, 158, 11, 0.03)' : d.isSun ? 'rgba(244, 63, 94, 0.03)' : undefined,
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
        )}
      </div>

      {/* Printable Sheet Styles for Staff Bulletin Board */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          nav, header, .btn, select, button, input {
            display: none !important;
          }
          .card {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            page-break-inside: avoid;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #94a3b8 !important;
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  )
}
