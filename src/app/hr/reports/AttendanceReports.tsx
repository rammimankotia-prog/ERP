'use client'

import { useState, useCallback } from 'react'

type Log = {
  id: string
  employeeId: string
  date: string
  punchIn: string | null
  punchOut: string | null
  status: string
  totalMinutes: number | null
  overtimeMinutes: number
  punchInMode: string
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT: '#10b981', LATE: '#f59e0b', ABSENT: '#ef4444',
  HALF_DAY: '#8b5cf6', ON_LEAVE: '#3b82f6', HOLIDAY: '#64748b',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtMins(m: number | null) {
  if (!m) return '—'
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function downloadCSV(logs: Log[], from: string, to: string) {
  const headers = ['Date', 'Employee ID', 'Punch In', 'Punch Out', 'Mode', 'Total Hours', 'Overtime', 'Status']
  const rows = logs.map(l => [l.date, l.employeeId, fmt(l.punchIn), fmt(l.punchOut), l.punchInMode, fmtMins(l.totalMinutes), fmtMins(l.overtimeMinutes), l.status])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `attendance-report-${from}-to-${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AttendanceReports() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    from: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    status: '',
  })

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: filters.from, to: filters.to })
      if (filters.status) params.append('status', filters.status)
      const res = await fetch(`/api/hr/attendance?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  const filteredLogs = filters.status ? logs.filter(l => l.status === filters.status) : logs

  const stats = {
    total: filteredLogs.length,
    present: filteredLogs.filter(l => ['PRESENT', 'LATE'].includes(l.status)).length,
    absent: filteredLogs.filter(l => l.status === 'ABSENT').length,
    late: filteredLogs.filter(l => l.status === 'LATE').length,
    onLeave: filteredLogs.filter(l => l.status === 'ON_LEAVE').length,
    totalMins: filteredLogs.reduce((acc, l) => acc + (l.totalMinutes || 0), 0),
    otMins: filteredLogs.reduce((acc, l) => acc + (l.overtimeMinutes || 0), 0),
    absenteeismRate: filteredLogs.length ? Math.round((filteredLogs.filter(l => l.status === 'ABSENT').length / filteredLogs.length) * 100) : 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Filter Panel */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '160px' }}>
          <label>From Date</label>
          <input type="date" className="form-input" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '160px' }}>
          <label>To Date</label>
          <input type="date" className="form-input" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '160px' }}>
          <label>Status Filter</label>
          <select className="form-input" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
          {loading ? '⏳' : '🔍'} Generate Report
        </button>
        <button className="btn btn-outline" onClick={() => downloadCSV(filteredLogs, filters.from, filters.to)} disabled={filteredLogs.length === 0}>
          ⬇️ CSV
        </button>
        <button className="btn btn-outline" onClick={() => window.print()}>
          🖨️ Print
        </button>
      </div>

      {/* Analytics Cards */}
      {filteredLogs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Total Records', value: stats.total, color: 'var(--primary)', icon: '📋' },
            { label: 'Present', value: stats.present, color: 'var(--success)', icon: '✅' },
            { label: 'Absent', value: stats.absent, color: 'var(--error)', icon: '❌' },
            { label: 'Late', value: stats.late, color: 'var(--warning)', icon: '⚠️' },
            { label: 'On Leave', value: stats.onLeave, color: 'var(--info)', icon: '🏖️' },
            { label: 'Total Hours', value: fmtMins(stats.totalMins), color: 'var(--primary)', icon: '⏱' },
            { label: 'Overtime', value: fmtMins(stats.otMins), color: 'var(--accent)', icon: '🎯' },
            { label: 'Absenteeism', value: `${stats.absenteeismRate}%`, color: stats.absenteeismRate > 10 ? 'var(--error)' : 'var(--success)', icon: '📊' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.25rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, marginTop: '0.3rem' }}>{s.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Report Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ color: 'var(--text-main)' }}>
            Attendance Report {filters.from && filters.to ? `— ${filters.from} to ${filters.to}` : ''}
          </h2>
          {filteredLogs.length === 0 && !loading && <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>Generate a report using the filters above.</p>}
        </div>
        {filteredLogs.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: 'var(--bg-main)' }}>
                <tr>
                  {['Date', 'Employee ID', 'Punch In', 'Punch Out', 'Mode', 'Total Hours', 'Overtime', 'Status'].map(h => (
                    <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.775rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.8rem 1rem', fontWeight: 500, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                      {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.8rem 1rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>{log.employeeId}</td>
                    <td style={{ padding: '0.8rem 1rem', color: 'var(--success)', fontWeight: 600 }}>{fmt(log.punchIn)}</td>
                    <td style={{ padding: '0.8rem 1rem', color: log.punchOut ? 'var(--error)' : 'var(--text-muted)', fontWeight: 600 }}>{fmt(log.punchOut)}</td>
                    <td style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{log.punchInMode}</td>
                    <td style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>{fmtMins(log.totalMinutes)}</td>
                    <td style={{ padding: '0.8rem 1rem', color: (log.overtimeMinutes || 0) > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>{fmtMins(log.overtimeMinutes)}</td>
                    <td style={{ padding: '0.8rem 1rem' }}>
                      <span className="badge" style={{ backgroundColor: `${STATUS_COLOR[log.status]}22`, color: STATUS_COLOR[log.status] }}>{log.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
