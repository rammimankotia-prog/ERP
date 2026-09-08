'use client'

import { useState, useEffect, useCallback } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type PayrollRecord = {
  employeeId: string
  employeeName: string
  designation: string
  presentDays: number
  absentDays: number
  lateDays: number
  halfDays: number
  leaveDays: number
  totalMinutes: number
  overtimeMinutes: number
  grossOT: number
  deductions: number
}

function formatMinutes(mins: number) {
  if (!mins) return '0h'
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function downloadCSV(data: PayrollRecord[], month: string, year: number) {
  const headers = ['Employee ID', 'Name', 'Designation', 'Present Days', 'Absent Days', 'Late Days', 'Half Days', 'Leave Days', 'Total Hours', 'Overtime Hours', 'OT Days (1.5x)', 'Deduction Days']
  const rows = data.map(r => [
    r.employeeId, r.employeeName, r.designation,
    r.presentDays, r.absentDays, r.lateDays, r.halfDays, r.leaveDays,
    formatMinutes(r.totalMinutes), formatMinutes(r.overtimeMinutes),
    r.grossOT, r.deductions
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payroll-${month}-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function PayrollSummary() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPayroll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/payroll/summary?month=${month}&year=${year}`)
      const data = await res.json()
      setRecords(data.summary || [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    fetchPayroll()
  }, [fetchPayroll])

  const totals = records.reduce((acc, r) => ({
    present: acc.present + r.presentDays,
    absent: acc.absent + r.absentDays,
    late: acc.late + r.lateDays,
    totalMins: acc.totalMins + r.totalMinutes,
    otMins: acc.otMins + r.overtimeMinutes,
  }), { present: 0, absent: 0, late: 0, totalMins: 0, otMins: 0 })

  const monthName = MONTHS[month - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Controls */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Month</label>
          <select className="form-input" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Year</label>
          <select className="form-input" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={fetchPayroll} disabled={loading}>
          {loading ? '⏳ Loading...' : '🔄 Generate'}
        </button>
        <button className="btn btn-outline" onClick={() => downloadCSV(records, monthName, year)} disabled={records.length === 0}>
          ⬇️ Export CSV
        </button>
        <button className="btn btn-outline" onClick={() => window.print()}>
          🖨️ Print / PDF
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Present', value: totals.present, color: 'var(--success)', icon: '✅' },
          { label: 'Total Absent', value: totals.absent, color: 'var(--error)', icon: '❌' },
          { label: 'Late Arrivals', value: totals.late, color: 'var(--warning)', icon: '⚠️' },
          { label: 'Total Hours', value: formatMinutes(totals.totalMins), color: 'var(--primary)', icon: '⏱' },
          { label: 'Overtime Hours', value: formatMinutes(totals.otMins), color: 'var(--accent)', icon: '🎯' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Payroll Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }} id="printable-payroll">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Payroll Summary</h2>
            <p style={{ fontSize: '0.85rem' }}>{monthName} {year} — {records.length} employees</p>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--bg-main)' }}>
              <tr>
                {['Employee', 'Designation', 'Present', 'Absent', 'Late', 'Half-Day', 'On Leave', 'Total Hours', 'OT Hours', 'OT (1.5x)', 'Deduction'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.775rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Loading payroll data...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No payroll data for this period</td></tr>
              ) : records.map(r => (
                <tr key={r.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>{r.employeeName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.employeeId}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.designation}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--success)' }}>{r.presentDays}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: r.absentDays > 0 ? 'var(--error)' : 'var(--text-muted)' }}>{r.absentDays}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: r.lateDays > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{r.lateDays}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>{r.halfDays}</td>
                  <td style={{ padding: '0.875rem 1rem', color: 'var(--info)' }}>{r.leaveDays}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>{formatMinutes(r.totalMinutes)}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: r.overtimeMinutes > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{formatMinutes(r.overtimeMinutes)}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: r.grossOT > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{r.grossOT > 0 ? `+${r.grossOT}d` : '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: r.deductions > 0 ? 'var(--error)' : 'var(--text-muted)' }}>{r.deductions > 0 ? `-${r.deductions}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
            {records.length > 0 && (
              <tfoot style={{ backgroundColor: 'var(--bg-main)', borderTop: '2px solid var(--border)' }}>
                <tr>
                  <td colSpan={2} style={{ padding: '0.875rem 1rem', fontWeight: 800, color: 'var(--text-main)' }}>TOTALS ({records.length} employees)</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: 'var(--success)' }}>{totals.present}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: totals.absent > 0 ? 'var(--error)' : 'var(--text-muted)' }}>{totals.absent}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: totals.late > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{totals.late}</td>
                  <td colSpan={2} />
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: 'var(--primary)' }}>{formatMinutes(totals.totalMins)}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: 'var(--accent)' }}>{formatMinutes(totals.otMins)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
