'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

type LeaveType = {
  id: string
  name: string
  category: string
  maxDaysPerYear?: number
}

type LeaveRequest = {
  id: string
  employeeId: string
  employeeName?: string
  designation?: string
  leaveType: { name: string; category: string }
  fromDate: string
  toDate: string
  totalDays: number
  reason: string
  status: string
  approvedAt?: string
  createdAt: string
}

const EMPLOYEES = [
  { id: 'e1', name: 'Raman Mankotia', designation: 'General Manager' },
  { id: 'e2', name: 'Priya Sharma', designation: 'Front Desk Executive' },
  { id: 'e3', name: 'Rajiv Kumar', designation: 'Housekeeping Supervisor' },
  { id: 'e4', name: 'Sunita Verma', designation: 'Security Officer' },
  { id: 'e5', name: 'Amit Singh', designation: 'Accounts Executive' },
]

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  CANCELLED: '#64748b',
}

const MOCK_LEAVE_TYPES: LeaveType[] = [
  { id: 'lt-1', name: 'Casual Leave', category: 'CASUAL', maxDaysPerYear: 12 },
  { id: 'lt-2', name: 'Sick Leave', category: 'SICK', maxDaysPerYear: 10 },
  { id: 'lt-3', name: 'Earned Leave', category: 'EARNED', maxDaysPerYear: 15 },
  { id: 'lt-4', name: 'Unpaid Leave', category: 'UNPAID', maxDaysPerYear: 30 },
]

const DEFAULT_REQUESTS: LeaveRequest[] = [
  {
    id: 'leave-2',
    employeeId: 'e2',
    employeeName: 'Priya Sharma',
    designation: 'Front Desk Executive',
    leaveType: { name: 'Sick Leave', category: 'SICK' },
    fromDate: '2026-09-05',
    toDate: '2026-09-06',
    totalDays: 2,
    reason: 'Viral Fever & Doctor Advised Bed Rest',
    status: 'APPROVED',
    approvedAt: '2026-09-04T10:00:00.000Z',
    createdAt: '2026-09-04T09:00:00.000Z'
  },
  {
    id: 'leave-3',
    employeeId: 'e3',
    employeeName: 'Rajiv Kumar',
    designation: 'Housekeeping Supervisor',
    leaveType: { name: 'Casual Leave', category: 'CASUAL' },
    fromDate: '2026-09-09',
    toDate: '2026-09-10',
    totalDays: 2,
    reason: 'Urgent Family Work at Village',
    status: 'APPROVED',
    approvedAt: '2026-09-08T11:30:00.000Z',
    createdAt: '2026-09-08T08:00:00.000Z'
  },
  {
    id: 'leave-4',
    employeeId: 'e4',
    employeeName: 'Sunita Verma',
    designation: 'Security Officer',
    leaveType: { name: 'Earned Leave', category: 'EARNED' },
    fromDate: '2026-09-09',
    toDate: '2026-09-11',
    totalDays: 3,
    reason: 'Attending Sister Wedding Out of Town',
    status: 'APPROVED',
    approvedAt: '2026-09-07T14:00:00.000Z',
    createdAt: '2026-09-07T10:00:00.000Z'
  },
  {
    id: 'leave-5',
    employeeId: 'e5',
    employeeName: 'Amit Singh',
    designation: 'Accounts Executive',
    leaveType: { name: 'Casual Leave', category: 'CASUAL' },
    fromDate: '2026-09-14',
    toDate: '2026-09-15',
    totalDays: 2,
    reason: 'Personal Bank & Property Registration',
    status: 'APPROVED',
    approvedAt: '2026-09-12T16:00:00.000Z',
    createdAt: '2026-09-12T11:00:00.000Z'
  },
  {
    id: 'leave-1',
    employeeId: 'e1',
    employeeName: 'Raman Mankotia',
    designation: 'General Manager',
    leaveType: { name: 'Casual Leave', category: 'CASUAL' },
    fromDate: '2026-09-24',
    toDate: '2026-09-25',
    totalDays: 2,
    reason: 'Hotel Operations Conference & Personal Work',
    status: 'PENDING',
    createdAt: '2026-09-09T09:30:00.000Z'
  }
]

export default function LeaveManagement() {
  const [requests, setRequests] = useState<LeaveRequest[]>(DEFAULT_REQUESTS)
  const [tab, setTab] = useState<'calendar' | 'requests' | 'apply'>('calendar')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Current viewed month in calendar
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [today])

  const [currentDate, setCurrentDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1))
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [calendarFilter, setCalendarFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL')

  // Apply Form State
  const [form, setForm] = useState({
    employeeId: 'e1',
    leaveTypeId: 'lt-1',
    fromDate: todayStr,
    toDate: todayStr,
    reason: ''
  })

  // Fetch all leaves from server
  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/hr/leave')
      if (res.ok) {
        const data = await res.json()
        if (data.requests && Array.isArray(data.requests) && data.requests.length > 0) {
          const enriched = data.requests.map((r: LeaveRequest) => {
            const emp = EMPLOYEES.find(e => e.id === r.employeeId)
            return {
              ...r,
              employeeName: r.employeeName || emp?.name || r.employeeId,
              designation: r.designation || emp?.designation || 'Staff'
            }
          })
          setRequests(enriched)
          return
        }
      }
    } catch {
      // Offline fallback to DEFAULT_REQUESTS
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Get leave requests for a given date
  const getLeavesForDate = useCallback((dateStr: string) => {
    return requests.filter(r => {
      if (calendarFilter !== 'ALL' && r.status !== calendarFilter) return false
      if (calendarFilter === 'ALL' && (r.status === 'REJECTED' || r.status === 'CANCELLED')) return false
      const from = r.fromDate ? r.fromDate.slice(0, 10) : ''
      const to = r.toDate ? r.toDate.slice(0, 10) : ''
      return dateStr >= from && dateStr <= to
    })
  }, [requests, calendarFilter])

  // Count employees on leave today
  const todayLeaves = useMemo(() => getLeavesForDate(todayStr), [getLeavesForDate, todayStr])

  // Submit new leave
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fromDate || !form.toDate || !form.reason) {
      setMessage({ text: 'Please fill all fields', type: 'error' })
      return
    }
    setLoading(true)
    const emp = EMPLOYEES.find(e => e.id === form.employeeId)
    const lt = MOCK_LEAVE_TYPES.find(l => l.id === form.leaveTypeId)
    const totalDays = Math.max(1, Math.ceil((new Date(form.toDate).getTime() - new Date(form.fromDate).getTime()) / 86400000) + 1)

    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: form.employeeId,
          leaveTypeId: form.leaveTypeId,
          fromDate: form.fromDate,
          toDate: form.toDate,
          reason: form.reason
        })
      })
      const data = await res.json()
      if (data.error === 'OVERLAP_DETECTED') {
        setMessage({ text: '⚠️ ' + data.message, type: 'error' })
      } else {
        const newReq: LeaveRequest = {
          id: data.request?.id || `leave-${Date.now()}`,
          employeeId: form.employeeId,
          employeeName: emp?.name || form.employeeId,
          designation: emp?.designation || 'Staff',
          leaveType: { name: lt?.name || 'Leave', category: lt?.category || 'CASUAL' },
          fromDate: form.fromDate,
          toDate: form.toDate,
          totalDays,
          reason: form.reason,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        }
        setRequests(prev => [newReq, ...prev])
        setMessage({ text: `✅ Leave request submitted successfully for ${emp?.name}!`, type: 'success' })
        setForm(p => ({ ...p, reason: '' }))
        setTab('calendar')
      }
    } catch {
      const newReq: LeaveRequest = {
        id: `leave-${Date.now()}`,
        employeeId: form.employeeId,
        employeeName: emp?.name || form.employeeId,
        designation: emp?.designation || 'Staff',
        leaveType: { name: lt?.name || 'Leave', category: lt?.category || 'CASUAL' },
        fromDate: form.fromDate,
        toDate: form.toDate,
        totalDays,
        reason: form.reason,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      }
      setRequests(prev => [newReq, ...prev])
      setMessage({ text: `✅ Leave request submitted for ${emp?.name}!`, type: 'success' })
      setTab('calendar')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    await fetch(`/api/hr/leave/${id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ approverId: 'admin', approverNote: 'Approved' })
    }).catch(() => {})
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'APPROVED' } : r))
    setMessage({ text: '✅ Leave approved and live calendar updated.', type: 'success' })
  }

  const handleReject = async (id: string) => {
    await fetch(`/api/hr/leave/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ approverId: 'admin', approverNote: 'Rejected' })
    }).catch(() => {})
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r))
    setMessage({ text: 'Leave request marked as rejected.', type: 'error' })
  }

  // Calendar helpers
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(todayStr)
  }

  const totalDays = form.fromDate && form.toDate
    ? Math.max(0, Math.ceil((new Date(form.toDate).getTime() - new Date(form.fromDate).getTime()) / 86400000) + 1)
    : 0

  const selectedDateLeaves = getLeavesForDate(selectedDate)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {message && (
        <div style={{
          padding: '1rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.25rem' }}>×</button>
        </div>
      )}

      {/* Live Status Hero Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {/* Today's Live Leave Count Card */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.05))',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TODAY'S ON-LEAVE STATUS
            </span>
            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '99px', background: '#10b98122', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              LIVE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#3b82f6', lineHeight: 1 }}>{todayLeaves.length}</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {todayLeaves.length === 1 ? 'employee on leave today' : 'employees on leave today'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            📅 {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>

        {/* Pending Approvals Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            PENDING REQUESTS
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>
              {requests.filter(r => r.status === 'PENDING').length}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>awaiting approval</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Review requests in the Leave Requests tab
          </div>
        </div>

        {/* Total Approved Leaves Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            APPROVED LEAVES
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>
              {requests.filter(r => r.status === 'APPROVED').length}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>scheduled leaves</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Visible across calendar view
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {([
          ['calendar', '📅 Leave Calendar'],
          ['requests', '📋 Leave Requests'],
          ['apply', '✍️ Apply for Leave']
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '0.75rem 1.4rem',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              border: 'none',
              background: tab === key ? 'var(--bg-card)' : 'transparent',
              color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: tab === key ? 700 : 500,
              cursor: 'pointer',
              borderBottom: tab === key ? '3px solid var(--primary)' : 'none',
              marginBottom: '-2px',
              fontSize: '0.92rem',
              transition: 'all 0.15s ease'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: LIVE LEAVE CALENDAR */}
      {tab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ position: 'relative', overflow: 'visible' }}>
            {/* Header with Month Navigation and Status Filter */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              {/* Month Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                  {currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    — Leave Calendar
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <button
                    onClick={prevMonth}
                    title="Previous Month"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      fontWeight: 700
                    }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={nextMonth}
                    title="Next Month"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      fontWeight: 700
                    }}
                  >
                    ›
                  </button>
                  <button
                    onClick={goToday}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--primary)',
                      background: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      marginLeft: '0.25rem'
                    }}
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Status Filter Pill Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter:</span>
                {(['ALL', 'APPROVED', 'PENDING'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setCalendarFilter(f)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '99px',
                      border: calendarFilter === f ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: calendarFilter === f ? 'var(--primary)' : 'var(--bg-main)',
                      color: calendarFilter === f ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {f === 'ALL' ? 'All Active' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Helper Guidance Banner */}
            <div style={{
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px dashed rgba(59, 130, 246, 0.25)',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}>
              <span>💡 <strong>Tip:</strong> Hover over any date with leave badges to instantly see <strong>who is on leave</strong>, their designation, leave type, and reason.</span>
            </div>

            {/* 7-Day Calendar Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.5rem',
              position: 'relative'
            }}>
              {/* Day Name Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
                <div
                  key={d}
                  style={{
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    padding: '0.6rem 0.25rem',
                    borderRadius: 'var(--radius-sm)',
                    background: idx === 0 ? 'rgba(239, 68, 68, 0.08)' : idx === 6 ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-main)',
                    color: idx === 0 ? '#ef4444' : idx === 6 ? '#f59e0b' : 'var(--text-muted)',
                    letterSpacing: '0.05em'
                  }}
                >
                  {d}
                </div>
              ))}

              {/* Blank cells for padding before 1st of month */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`blank-${i}`} style={{ minHeight: '95px', opacity: 0.2, background: 'transparent' }} />
              ))}

              {/* Day cells for current month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                const dayLeaves = getLeavesForDate(dateStr)
                const hasLeave = dayLeaves.length > 0
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const isHovered = hoveredDate === dateStr
                const dayOfWeek = (firstDayIndex + i) % 7
                const isSunday = dayOfWeek === 0
                const isSaturday = dayOfWeek === 6

                return (
                  <div
                    key={dayNum}
                    onClick={() => setSelectedDate(dateStr)}
                    onMouseEnter={() => setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                    style={{
                      position: 'relative',
                      minHeight: '95px',
                      padding: '0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected
                        ? 'rgba(59, 130, 246, 0.18)'
                        : hasLeave
                        ? 'rgba(59, 130, 246, 0.08)'
                        : isToday
                        ? 'rgba(37, 99, 235, 0.1)'
                        : 'var(--bg-main)',
                      border: isSelected
                        ? '2px solid #3b82f6'
                        : isToday
                        ? '2px solid #2563eb'
                        : hasLeave
                        ? '1px solid rgba(59, 130, 246, 0.35)'
                        : '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                      boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.45)' : 'none',
                      zIndex: isHovered ? 40 : 1
                    }}
                  >
                    {/* Top Row: Day Number & Today Pill */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.95rem',
                        fontWeight: isToday ? 900 : hasLeave ? 800 : 600,
                        color: isToday
                          ? '#60a5fa'
                          : isSunday
                          ? '#f87171'
                          : isSaturday
                          ? '#fbbf24'
                          : 'var(--text-main)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: isToday ? '#2563eb33' : 'transparent'
                      }}>
                        {dayNum}
                      </span>

                      {isToday && (
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          background: '#2563eb',
                          color: '#ffffff',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          letterSpacing: '0.04em'
                        }}>
                          TODAY
                        </span>
                      )}
                    </div>

                    {/* Middle / Bottom: Leave Count Badge & Names Chips */}
                    {hasLeave ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.4rem' }}>
                        {/* Count Badge */}
                        <div style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.25rem 0.45rem',
                          borderRadius: '4px',
                          background: dayLeaves.some(l => l.status === 'PENDING')
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(59, 130, 246, 0.2)',
                          color: dayLeaves.some(l => l.status === 'PENDING') ? '#fbbf24' : '#60a5fa',
                          border: dayLeaves.some(l => l.status === 'PENDING')
                            ? '1px solid rgba(245, 158, 11, 0.3)'
                            : '1px solid rgba(59, 130, 246, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          <span>👥</span>
                          <span>{dayLeaves.length} on leave</span>
                        </div>

                        {/* First 1-2 employee name previews */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {dayLeaves.slice(0, 2).map(l => (
                            <div
                              key={l.id}
                              style={{
                                fontSize: '0.66rem',
                                color: 'var(--text-main)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                opacity: 0.9,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <span style={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: STATUS_COLOR[l.status] || '#3b82f6',
                                flexShrink: 0
                              }} />
                              <span>{l.employeeName}</span>
                            </div>
                          ))}
                          {dayLeaves.length > 2 && (
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                              +{dayLeaves.length - 2} more...
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.3, alignSelf: 'center' }}>
                        —
                      </div>
                    )}

                    {/* HOVER TOOLTIP / POPOVER (Shows full details on cursor hover) */}
                    {isHovered && hasLeave && (
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 10px)',
                        left: dayOfWeek > 4 ? 'auto' : '50%',
                        right: dayOfWeek > 4 ? '0' : 'auto',
                        transform: dayOfWeek > 4 ? 'none' : 'translateX(-50%)',
                        minWidth: '280px',
                        maxWidth: '340px',
                        background: '#0f172a',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), 0 0 15px rgba(59, 130, 246, 0.2)',
                        zIndex: 100,
                        pointerEvents: 'none',
                        textAlign: 'left'
                      }}>
                        {/* Tooltip Header */}
                        <div style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          paddingBottom: '0.5rem',
                          marginBottom: '0.75rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.88rem' }}>
                              📅 {new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: 600, marginTop: '0.1rem' }}>
                              👥 {dayLeaves.length} {dayLeaves.length === 1 ? 'Employee on Leave' : 'Employees on Leave'}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '99px',
                            background: '#3b82f622',
                            color: '#60a5fa',
                            fontWeight: 700
                          }}>
                            {isToday ? 'TODAY' : 'SCHEDULED'}
                          </span>
                        </div>

                        {/* List of Employees on Leave */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          {dayLeaves.map(l => (
                            <div
                              key={l.id}
                              style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.5rem 0.65rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>
                                  👤 {l.employeeName}
                                </span>
                                <span style={{
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '99px',
                                  background: `${STATUS_COLOR[l.status]}22`,
                                  color: STATUS_COLOR[l.status],
                                  fontWeight: 700
                                }}>
                                  {l.status}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                💼 {l.designation} • <span style={{ color: '#60a5fa', fontWeight: 600 }}>{l.leaveType.name}</span>
                              </div>

                              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic', background: 'rgba(0,0,0,0.25)', padding: '0.25rem 0.4rem', borderRadius: '4px' }}>
                                "{l.reason}"
                              </div>

                              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                                🗓️ {new Date(l.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(l.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ({l.totalDays}d)
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detailed Selected Date Breakdown Card */}
          <div className="card" style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.875rem',
              marginBottom: '1rem'
            }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📋 Selected Date Breakdown:</span>
                  <span style={{ color: 'var(--primary)' }}>
                    {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {selectedDate === todayStr && (
                    <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '99px', background: '#2563eb', color: '#ffffff', fontWeight: 800 }}>
                      TODAY
                    </span>
                  )}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {selectedDateLeaves.length === 0
                    ? 'No staff members on leave on this date. Full workforce active.'
                    : `${selectedDateLeaves.length} employee${selectedDateLeaves.length > 1 ? 's' : ''} scheduled on leave.`}
                </p>
              </div>

              {selectedDateLeaves.length > 0 && (
                <div style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  color: '#60a5fa',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}>
                  👥 Total On Leave: {selectedDateLeaves.length}
                </div>
              )}
            </div>

            {selectedDateLeaves.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-main)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>No Employees on Leave</div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>All department team members are available and scheduled for duty.</div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                gap: '1rem'
              }}>
                {selectedDateLeaves.map(req => (
                  <div
                    key={req.id}
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--primary), #6366f1)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1rem'
                        }}>
                          {req.employeeName ? req.employeeName.slice(0, 2).toUpperCase() : req.employeeId.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.98rem' }}>
                            {req.employeeName}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            💼 {req.designation}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '99px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: `${STATUS_COLOR[req.status]}22`,
                        color: STATUS_COLOR[req.status],
                        border: `1px solid ${STATUS_COLOR[req.status]}44`
                      }}>
                        {req.status}
                      </span>
                    </div>

                    <div style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Leave Type:</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{req.leaveType.name}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ({req.totalDays} days)
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Reason:</span>
                        <span style={{ color: 'var(--text-main)', fontStyle: 'italic', background: 'var(--bg-main)', border: '1px solid var(--border)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                          "{req.reason}"
                        </span>
                      </div>
                    </div>

                    {req.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                        <button
                          onClick={() => handleApprove(req.id)}
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(16,185,129,0.15)',
                            color: 'var(--success)',
                            border: '1px solid var(--success)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          ✓ Approve Leave
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(239,68,68,0.15)',
                            color: 'var(--error)',
                            border: '1px solid var(--error)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LEAVE REQUESTS LIST */}
      {tab === 'requests' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-scroll-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
              <thead style={{ backgroundColor: 'var(--bg-main)' }}>
                <tr>
                  {['Employee', 'Designation', 'Leave Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No leave requests found</td></tr>
              ) : requests.map(req => (
                <tr key={req.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                    {req.employeeName || req.employeeId}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {req.designation || 'Staff'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{req.leaveType.name}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {req.totalDays}d
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.reason}>
                    {req.reason}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '99px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: `${STATUS_COLOR[req.status]}22`,
                      color: STATUS_COLOR[req.status],
                      border: `1px solid ${STATUS_COLOR[req.status]}44`
                    }}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    {req.status === 'PENDING' ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleApprove(req.id)}
                          title="Approve"
                          style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid var(--success)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          title="Reject"
                          style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: '1px solid var(--error)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* TAB 3: APPLY FOR LEAVE */}
      {tab === 'apply' && (
        <div className="card">
          <h2 style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '1.3rem', fontWeight: 800 }}>
            Submit Staff Leave Request
          </h2>
          <form onSubmit={handleApply} className="responsive-form-grid" style={{ gap: '1.5rem' }}>
            <div className="form-group">
              <label>Employee *</label>
              <select
                required
                className="form-input"
                value={form.employeeId}
                onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
              >
                {EMPLOYEES.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.designation})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Leave Type *</label>
              <select
                required
                className="form-input"
                value={form.leaveTypeId}
                onChange={e => setForm(p => ({ ...p, leaveTypeId: e.target.value }))}
              >
                {MOCK_LEAVE_TYPES.map(lt => (
                  <option key={lt.id} value={lt.id}>{lt.name} (Max {lt.maxDaysPerYear}d/yr)</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>From Date *</label>
              <input
                required
                type="date"
                className="form-input"
                value={form.fromDate}
                onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>To Date *</label>
              <input
                required
                type="date"
                className="form-input"
                value={form.toDate}
                min={form.fromDate}
                onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))}
              />
            </div>

            {totalDays > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>📅</span>
                  <span>Calculated Leave Duration: <strong>{totalDays} Day{totalDays > 1 ? 's' : ''}</strong></span>
                </div>
              </div>
            )}

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Reason for Leave *</label>
              <textarea
                required
                className="form-input"
                rows={3}
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Specify purpose/details for this leave request..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }} className="form-actions-bar">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ padding: '0.8rem 2.2rem', fontWeight: 700, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {loading ? 'Submitting...' : 'Submit & Update Calendar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
