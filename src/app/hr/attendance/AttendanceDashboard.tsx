'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

type TeamAttendanceLog = {
  employeeId: string
  employeeName: string
  department: string
  designation: string
  punchIn: string | null
  punchOut: string | null
  status: string
  isLate?: boolean
  lateMinutes?: number
  totalMinutes: number | null
  punchInMode: string | null
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT: '#10b981', // green
  LATE: '#f59e0b',    // yellow
  ABSENT: '#ef4444',  // red
  HALF_DAY: '#8b5cf6',// purple
  ON_LEAVE: '#3b82f6',// blue
  HOLIDAY: '#64748b', // gray
}

const MODE_ICON: Record<string, string> = {
  WEB: '🖥️',
  GEO: '📍',
  BIOMETRIC: '👆',
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatMinutes(mins: number | null) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function getTodayDateStr(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  } catch {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dateObj = new Date(y, m - 1, d)
    return dateObj.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

import OneTapPunchInterface, { EmployeeInfo } from '@/components/OneTapPunchInterface'

export default function AttendanceDashboard() {
  const [logs, setLogs] = useState<TeamAttendanceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState(() => getTodayDateStr())
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [activePunchEmployee, setActivePunchEmployee] = useState<EmployeeInfo | null>(null)

  const todayStr = useMemo(() => getTodayDateStr(), [])
  const isPastDate = date < todayStr
  const isFutureDate = date > todayStr
  const isToday = date === todayStr

  const fetchTeamAttendance = useCallback(async (selectedDate: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/attendance?date=${selectedDate}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      } else {
        setLogs([])
      }
    } catch (e) {
      console.error('Failed to fetch attendance', e)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeamAttendance(date)
  }, [date, fetchTeamAttendance])

  // Extract distinct departments
  const departments = useMemo(() => {
    const depts = new Set<string>()
    logs.forEach(l => {
      if (l.department) depts.add(l.department)
    })
    return Array.from(depts).sort()
  }, [logs])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (departmentFilter !== 'ALL' && log.department !== departmentFilter) return false
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PRESENT' && !['PRESENT', 'LATE', 'HALF_DAY'].includes(log.status)) return false
        else if (statusFilter !== 'PRESENT' && log.status !== statusFilter) return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches = (
          log.employeeName.toLowerCase().includes(q) ||
          log.employeeId.toLowerCase().includes(q) ||
          log.department.toLowerCase().includes(q) ||
          (log.designation && log.designation.toLowerCase().includes(q))
        )
        if (!matches) return false
      }
      return true
    })
  }, [logs, searchQuery, departmentFilter, statusFilter])

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return
    const headers = ['Sr No', 'Employee ID', 'Employee Name', 'Department', 'Designation', 'Status', 'Punch In', 'Punch Out', 'Total Hours', 'Punch Mode']
    const rows = filteredLogs.map((l, idx) => [
      idx + 1,
      `"${l.employeeId}"`,
      `"${l.employeeName.replace(/"/g, '""')}"`,
      `"${l.department.replace(/"/g, '""')}"`,
      `"${(l.designation || '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${formatTime(l.punchIn)}"`,
      `"${formatTime(l.punchOut)}"`,
      `"${formatMinutes(l.totalMinutes)}"`,
      `"${l.punchInMode || ''}"`,
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Attendance_Register_${date}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const openPunchModal = (log: TeamAttendanceLog) => {
    if (date < todayStr) {
      alert('🔒 Access Restricted: Check-in, punch-in, and punch-out are strictly not permitted for past dates.')
      return
    }
    if (date > todayStr) {
      alert('⏳ Access Restricted: Check-in is not permitted for future dates.')
      return
    }
    const parts = log.employeeName.split(' ')
    const firstName = parts[0] || log.employeeName
    const lastName = parts.slice(1).join(' ')
    setActivePunchEmployee({
      id: log.employeeId,
      employeeId: log.employeeId,
      firstName,
      lastName,
      department: log.department,
      designation: log.designation,
      checkedIn: !!log.punchIn && !log.punchOut,
      checkedOut: !!log.punchOut,
      punchInTime: log.punchIn,
      punchOutTime: log.punchOut,
    })
  }

  // Stats
  const totalEmployees = logs.length
  const halfDayCount = logs.filter(l => l.status === 'HALF_DAY').length
  const presentCount = logs.filter(l => ['PRESENT', 'LATE', 'HALF_DAY'].includes(l.status)).length
  const absentCount = logs.filter(l => l.status === 'ABSENT').length
  const lateCount = logs.filter(l => l.status === 'LATE').length
  const onLeaveCount = logs.filter(l => l.status === 'ON_LEAVE').length

  const cardStyle = {
    backgroundColor: 'var(--bg-card, #fff)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    overflow: 'hidden'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL HOTEL MUSTER ROLL / ATTENDANCE REGISTER LETTERHEAD */}
      {/* ========================================================================= */}
      <div className="print-only attendance-print-header" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '10px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18pt', fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px' }}>
              GRAND GODWIN HOTEL
            </h1>
            <div style={{ fontSize: '10.5pt', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
              DAILY ATTENDANCE REGISTER & MUSTER ROLL
            </div>
            <div style={{ fontSize: '8pt', color: '#64748b', marginTop: '2px' }}>
              Godwin ERP • Human Resources Management Division
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#1e293b' }}>
            <div><strong style={{ color: '#0f172a' }}>Date:</strong> {formatDisplayDate(date)}</div>
            <div><strong>Department:</strong> {departmentFilter === 'ALL' ? 'All Departments' : departmentFilter}</div>
            {statusFilter !== 'ALL' && <div><strong>Status:</strong> {statusFilter}</div>}
            <div style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '4px' }}>
              Printed: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
        </div>

        {/* Paper Print Summary Stats Box */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ border: '1px solid #94a3b8', padding: '3px 9px', borderRadius: '4px', fontSize: '8pt', backgroundColor: '#f8fafc' }}>
            <strong>Total Staff:</strong> {totalEmployees}
          </div>
          <div style={{ border: '1px solid #10b981', padding: '3px 9px', borderRadius: '4px', fontSize: '8pt', backgroundColor: '#f0fdf4', color: '#065f46' }}>
            <strong>Present:</strong> {presentCount}
          </div>
          <div style={{ border: '1px solid #f59e0b', padding: '3px 9px', borderRadius: '4px', fontSize: '8pt', backgroundColor: '#fffbeb', color: '#92400e' }}>
            <strong>Late In:</strong> {lateCount}
          </div>
          <div style={{ border: '1px solid #8b5cf6', padding: '3px 9px', borderRadius: '4px', fontSize: '8pt', backgroundColor: '#f5f3ff', color: '#5b21b6' }}>
            <strong>Half Day:</strong> {halfDayCount}
          </div>
          <div style={{ border: '1px solid #3b82f6', padding: '3px 9px', borderRadius: '4px', fontSize: '8pt', backgroundColor: '#eff6ff', color: '#1e40af' }}>
            <strong>On Leave:</strong> {onLeaveCount}
          </div>
          <div style={{ border: '1px solid #ef4444', padding: '3px 9px', borderRadius: '4px', fontSize: '8pt', backgroundColor: '#fef2f2', color: '#991b1b' }}>
            <strong>Absent:</strong> {absentCount}
          </div>
          {filteredLogs.length !== logs.length && (
            <div style={{ border: '1px solid #cbd5e1', padding: '3px 9px', borderRadius: '4px', fontSize: '8pt', backgroundColor: '#f1f5f9' }}>
              <strong>Listed:</strong> {filteredLogs.length} of {totalEmployees}
            </div>
          )}
        </div>
      </div>

      {/* Header Controls (Screen Only) */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* Left filters: Date, Department, Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date:</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  border: isPastDate ? '1.5px solid #ef4444' : '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {isPastDate && (
                <button
                  onClick={() => setDate(todayStr)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  title="Reset date picker to today"
                >
                  <span>📅</span>
                  <span>Today</span>
                </button>
              )}
            </div>

            {/* Department Filter */}
            {departments.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dept:</label>
                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present (All)</option>
                <option value="LATE">Late Only</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
          </div>

          {/* Right actions: Search, Print Button, Export CSV */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
            <input 
              type="text" 
              placeholder="Search employee or department..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                flex: '1 1 180px',
                maxWidth: '280px',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />

            {/* Print Attendance Button */}
            <button
              onClick={handlePrint}
              disabled={loading || logs.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.58rem 1.15rem',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                cursor: loading || logs.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              title={`Print Attendance List for ${date} (Formatted for A4 landscape print & PDF)`}
            >
              <span style={{ fontSize: '1rem' }}>🖨️</span>
              <span>Print Attendance List</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              disabled={loading || filteredLogs.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.58rem 0.9rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: '1px solid var(--border)',
                cursor: loading || filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              title="Download CSV spreadsheet of current list"
            >
              <span>📥</span>
              <span>CSV</span>
            </button>
          </div>

        </div>

        {/* Past Date Security Banner */}
        {isPastDate && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#ef4444',
              fontSize: '0.825rem',
              fontWeight: 600
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🔒</span>
            <div>
              <strong>Past Date Locked ({date}):</strong> Check-in, punch-in, and punch-out are strictly disabled for past dates. Employees and Security Guards cannot record or alter attendance for past dates. You can print this official attendance record.
            </div>
          </div>
        )}
      </div>

      {/* Stats Panel (Screen Only) */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Employees', value: totalEmployees, color: '#3b82f6' },
          { label: 'Present Today', value: presentCount, color: '#10b981' },
          { label: 'Half Day (≤5h)', value: halfDayCount, color: '#8b5cf6' },
          { label: 'Late In', value: lateCount, color: '#f59e0b' },
          { label: 'On Leave', value: onLeaveCount, color: '#06b6d4' },
          { label: 'Absent', value: absentCount, color: '#ef4444' },
        ].map(stat => (
          <div key={stat.label} style={{ ...cardStyle, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Data Table Container */}
      <div style={cardStyle} className="attendance-sheet-card">
        <div className="no-print" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.1rem' }}>
              Attendance Sheet ({formatDisplayDate(date)})
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {filteredLogs.length} of {totalEmployees} employees. Click any action button to punch in/out.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {loading && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fetching data...</span>}
            <button
              onClick={handlePrint}
              disabled={loading || logs.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: loading || logs.length === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Print attendance list"
            >
              <span>🖨️ Print</span>
            </button>
          </div>
        </div>

        <div className="table-scroll-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '880px' }}>
            <thead style={{ backgroundColor: 'var(--bg-main)' }}>
              <tr>
                <th className="print-only-cell" style={{ width: '35px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Employee</th>
                <th style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Department</th>
                <th style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Punch In</th>
                <th style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Punch Out</th>
                <th style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Hours</th>
                <th style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Mode</th>
                <th className="no-print" style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  {isPastDate ? 'Lock Status' : isFutureDate ? 'Future Status' : 'One-Tap Action'}
                </th>
                <th className="print-only-cell" style={{ width: '130px', textAlign: 'center' }}>Signature / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Fetching attendance...' : 'No records found matching current criteria.'}
                  </td>
                </tr>
              ) : filteredLogs.map((log, idx) => {
                const isCurrentlyIn = !!log.punchIn && !log.punchOut
                const isCompleted = !!log.punchIn && !!log.punchOut
                return (
                  <tr key={log.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                    {/* Index for Printout */}
                    <td className="print-only-cell" style={{ textAlign: 'center', fontWeight: 600, fontSize: '8pt', color: '#475569' }}>
                      {idx + 1}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{log.employeeName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.employeeId}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '0.85rem' }}>{log.department}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{log.designation}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '999px', 
                        fontSize: '0.75rem', 
                        fontWeight: 700,
                        backgroundColor: `${STATUS_COLOR[log.status] || '#64748b'}22`, 
                        color: STATUS_COLOR[log.status] || '#64748b' 
                      }}>
                        {log.status === 'LATE' ? '⚠️ LATE' : log.status}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', color: (log.isLate || log.status === 'LATE') ? '#f59e0b' : 'var(--success)', fontWeight: 600 }}>
                      {formatTime(log.punchIn)}
                      {(log.isLate || log.status === 'LATE') && log.lateMinutes ? (
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                          +{log.lateMinutes >= 60 ? `${Math.floor(log.lateMinutes / 60)}h ${log.lateMinutes % 60}m` : `${log.lateMinutes}m`} late
                        </span>
                      ) : null}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', color: log.punchOut ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {formatTime(log.punchOut)}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      {formatMinutes(log.totalMinutes)}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <span className="no-print" style={{ fontSize: '1rem' }} title={log.punchInMode || 'Unknown'}>
                        {log.punchInMode ? MODE_ICON[log.punchInMode] : '—'}
                      </span>
                      <span className="print-only" style={{ fontSize: '7.5pt', fontWeight: 600 }}>
                        {log.punchInMode || '—'}
                      </span>
                    </td>

                    {/* Interactive Action Column (Screen Only) */}
                    <td className="no-print" style={{ padding: '0.75rem 1.25rem' }}>
                      {isPastDate ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'not-allowed',
                            userSelect: 'none'
                          }}
                          title="Past Date Locked: Check-in, punch-in, and punch-out are strictly prohibited for past dates."
                        >
                          🔒 Past Date (Locked)
                        </span>
                      ) : isFutureDate ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(100, 116, 139, 0.1)',
                            border: '1px solid rgba(100, 116, 139, 0.25)',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            cursor: 'not-allowed',
                            userSelect: 'none'
                          }}
                          title="Future Date: Punch-in is not permitted for upcoming dates."
                        >
                          ⏳ Future Date
                        </span>
                      ) : (
                        <button
                          onClick={() => openPunchModal(log)}
                          style={{
                            padding: '0.45rem 0.9rem',
                            borderRadius: '8px',
                            border: isCurrentlyIn ? '1px solid #ef4444' : '1px solid #10b981',
                            backgroundColor: isCurrentlyIn ? 'rgba(239, 68, 68, 0.12)' : isCompleted ? 'rgba(100, 116, 139, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: isCurrentlyIn ? '#ef4444' : isCompleted ? 'var(--text-main)' : '#10b981',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {isCurrentlyIn ? '🔴 Check-Out' : isCompleted ? '⚡ Punch' : '🟢 Check-In'}
                        </button>
                      )}
                    </td>

                    {/* Signature / Remarks Cell (Print Only) */}
                    <td className="print-only-cell" style={{ height: '32px' }}>
                      {/* Blank for physical signature or handwritten remark */}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL SIGNATURES FOOTER */}
      {/* ========================================================================= */}
      <div className="print-only print-footer-signatures" style={{ marginTop: '36px', paddingTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', width: '100%' }}>
          <div style={{ width: '160px' }}>
            <div style={{ borderBottom: '1.5px solid #0f172a', height: '36px', marginBottom: '6px' }} />
            <div style={{ fontSize: '8.5pt', fontWeight: 800, color: '#0f172a' }}>Prepared By</div>
            <div style={{ fontSize: '7.5pt', color: '#64748b' }}>HR / Timekeeper</div>
          </div>
          <div style={{ width: '160px' }}>
            <div style={{ borderBottom: '1.5px solid #0f172a', height: '36px', marginBottom: '6px' }} />
            <div style={{ fontSize: '8.5pt', fontWeight: 800, color: '#0f172a' }}>Verified By</div>
            <div style={{ fontSize: '7.5pt', color: '#64748b' }}>HOD / Security Supervisor</div>
          </div>
          <div style={{ width: '160px' }}>
            <div style={{ borderBottom: '1.5px solid #0f172a', height: '36px', marginBottom: '6px' }} />
            <div style={{ fontSize: '8.5pt', fontWeight: 800, color: '#0f172a' }}>Approved By</div>
            <div style={{ fontSize: '7.5pt', color: '#64748b' }}>General Manager</div>
          </div>
        </div>
      </div>

      {/* One-Tap Punch Interface Modal */}
      {activePunchEmployee && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setActivePunchEmployee(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '94vh',
              overflowY: 'auto',
              borderRadius: '24px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <OneTapPunchInterface
              employee={activePunchEmployee}
              onBack={() => {
                setActivePunchEmployee(null)
                fetchTeamAttendance(date)
              }}
              onSuccess={() => {
                fetchTeamAttendance(date)
              }}
              autoResetSeconds={3}
            />
          </div>
        </div>
      )}

      {/* Print CSS Styles */}
      <style jsx global>{`
        @media screen {
          .print-only,
          .print-only-cell {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 10mm 10mm 10mm;
          }

          /* Force high contrast crisp paper formatting */
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
            font-size: 8.5pt !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide app sidebars, topbars, buttons, controls, search, and navigation */
          aside, nav, header, [class*="sidebar"], [class*="topnavbar"], .no-print, button, input, select, .header {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-only-cell {
            display: table-cell !important;
          }

          .page-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          .attendance-sheet-card {
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .table-scroll-container {
            overflow: visible !important;
            max-height: none !important;
            width: 100% !important;
          }

          table {
            width: 100% !important;
            min-width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8pt !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 800 !important;
            border: 1px solid #94a3b8 !important;
            padding: 6px 8px !important;
            font-size: 7.5pt !important;
            text-transform: uppercase !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          td {
            border: 1px solid #cbd5e1 !important;
            padding: 5px 8px !important;
            color: #0f172a !important;
            font-size: 8pt !important;
            background-color: transparent !important;
          }

          tr:nth-child(even) td {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-footer-signatures {
            display: flex !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

    </div>
  )
}
