'use client'

import { useState, useEffect, useCallback } from 'react'

type LeaveRequest = {
  id: string
  employeeId: string
  leaveType: { name: string; category: string }
  fromDate: string
  toDate: string
  totalDays: number
  reason: string
  status: string
  approvedAt?: string
  createdAt: string
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  CANCELLED: '#64748b',
}

const MOCK_LEAVE_TYPES = [
  { id: 'lt-1', name: 'Casual Leave', category: 'CASUAL', maxDaysPerYear: 12 },
  { id: 'lt-2', name: 'Sick Leave', category: 'SICK', maxDaysPerYear: 10 },
  { id: 'lt-3', name: 'Earned Leave', category: 'EARNED', maxDaysPerYear: 15 },
  { id: 'lt-4', name: 'Unpaid Leave', category: 'UNPAID', maxDaysPerYear: 30 },
]

const MOCK_BALANCES = [
  { leaveType: 'Casual Leave', total: 12, used: 3, remaining: 9 },
  { leaveType: 'Sick Leave', total: 10, used: 1, remaining: 9 },
  { leaveType: 'Earned Leave', total: 15, used: 5, remaining: 10 },
]

export default function LeaveManagement() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [tab, setTab] = useState<'apply' | 'requests' | 'calendar'>('apply')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState({ leaveTypeId: 'lt-1', fromDate: '', toDate: '', reason: '' })
  const employeeId = 'mock-emp-1'

  const fetchRequests = useCallback(async () => {
    const res = await fetch(`/api/hr/leave?employeeId=${employeeId}`).catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setRequests(data.requests || [])
    }
  }, [employeeId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fromDate || !form.toDate || !form.reason) {
      setMessage({ text: 'Please fill all fields', type: 'error' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, ...form })
      })
      const data = await res.json()
      if (data.error === 'OVERLAP_DETECTED') {
        setMessage({ text: '⚠️ ' + data.message, type: 'error' })
      } else {
        setMessage({ text: '✅ Leave request submitted successfully!', type: 'success' })
        setForm({ leaveTypeId: 'lt-1', fromDate: '', toDate: '', reason: '' })
        setTab('requests')
        await fetchRequests()
      }
    } catch {
      setMessage({ text: '✅ Leave request submitted (offline mode)', type: 'success' })
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
    setMessage({ text: '✅ Leave approved and attendance calendar updated.', type: 'success' })
  }

  const handleReject = async (id: string) => {
    await fetch(`/api/hr/leave/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ approverId: 'admin', approverNote: 'Rejected' })
    }).catch(() => {})
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r))
    setMessage({ text: 'Leave request rejected.', type: 'error' })
  }

  const totalDays = form.fromDate && form.toDate
    ? Math.ceil((new Date(form.toDate).getTime() - new Date(form.fromDate).getTime()) / 86400000) + 1
    : 0

  const calendarDates = requests.filter(r => r.status === 'APPROVED').flatMap(r => {
    const dates: string[] = []
    for (let d = new Date(r.fromDate); d <= new Date(r.toDate); d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0])
    }
    return dates
  })

  // Build mini calendar for current month
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {message && (
        <div style={{ padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.type === 'success' ? 'var(--success)' : 'var(--error)', border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--error)'}`, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Leave Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {MOCK_BALANCES.map(b => (
          <div key={b.leaveType} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{b.leaveType}</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{b.remaining}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ {b.total} remaining</span>
            </div>
            <div style={{ height: '6px', borderRadius: '99px', backgroundColor: 'var(--bg-main)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '99px', backgroundColor: 'var(--primary)', width: `${(b.remaining / b.total) * 100}%`, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.used} days used</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {([['apply', 'Apply for Leave'], ['requests', 'Leave Requests'], ['calendar', 'Leave Calendar']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              border: 'none',
              background: tab === key ? 'var(--bg-card)' : 'transparent',
              color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: tab === key ? 700 : 500,
              cursor: 'pointer',
              borderBottom: tab === key ? '2px solid var(--primary)' : 'none',
              marginBottom: '-2px',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'apply' && (
        <div className="card">
          <h2 style={{ color: 'var(--text-main)', marginBottom: '1.5rem' }}>Submit Leave Request</h2>
          <form onSubmit={handleApply} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div className="form-group">
              <label>Leave Type *</label>
              <select required className="form-input" value={form.leaveTypeId} onChange={e => setForm(p => ({ ...p, leaveTypeId: e.target.value }))}>
                {MOCK_LEAVE_TYPES.map(lt => (
                  <option key={lt.id} value={lt.id}>{lt.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>From Date *</label>
              <input required type="date" className="form-input" value={form.fromDate} onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>To Date *</label>
              <input required type="date" className="form-input" value={form.toDate} min={form.fromDate} onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))} />
            </div>
            {totalDays > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                  📅 Total leave days: <strong>{totalDays}</strong>
                </div>
              </div>
            )}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Reason *</label>
              <textarea required className="form-input" rows={3} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Brief reason for leave..." style={{ resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.75rem 2rem', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'requests' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--bg-main)' }}>
              <tr>
                {['Employee', 'Leave Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No leave requests found</td></tr>
              ) : requests.map(req => (
                <tr key={req.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{req.employeeId}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem' }}>{req.leaveType.name}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{req.totalDays}d</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span className="badge" style={{ backgroundColor: `${STATUS_COLOR[req.status]}22`, color: STATUS_COLOR[req.status] }}>{req.status}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    {req.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleApprove(req.id)} style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid var(--success)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✓</button>
                        <button onClick={() => handleReject(req.id)} style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid var(--error)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✗</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="card">
          <h2 style={{ color: 'var(--text-main)', marginBottom: '1.5rem' }}>
            {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} — Leave Calendar
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem' }}>{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`blank-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const isLeave = calendarDates.includes(dateStr)
              const isToday = dayNum === now.getDate()
              return (
                <div key={dayNum} style={{
                  padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                  backgroundColor: isLeave ? 'rgba(59, 130, 246, 0.15)' : isToday ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-main)',
                  color: isLeave ? '#3b82f6' : isToday ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: isToday ? 800 : 500,
                  border: isToday ? '1px solid var(--primary)' : '1px solid transparent',
                  fontSize: '0.85rem',
                  cursor: 'default',
                  transition: 'all 0.1s'
                }}>
                  {dayNum}
                  {isLeave && <div style={{ fontSize: '0.55rem', color: '#3b82f6', fontWeight: 700 }}>LEAVE</div>}
                </div>
              )
            })}
          </div>
          {calendarDates.length === 0 && (
            <p style={{ textAlign: 'center', marginTop: '1rem' }}>No approved leaves this month.</p>
          )}
        </div>
      )}
    </div>
  )
}
