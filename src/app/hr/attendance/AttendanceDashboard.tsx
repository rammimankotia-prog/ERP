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

import OneTapPunchInterface, { EmployeeInfo } from '@/components/OneTapPunchInterface'

export default function AttendanceDashboard() {
  const [logs, setLogs] = useState<TeamAttendanceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState(() => getTodayDateStr())
  const [searchQuery, setSearchQuery] = useState('')
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

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter(log =>
      log.employeeName.toLowerCase().includes(q) ||
      log.employeeId.toLowerCase().includes(q) ||
      log.department.toLowerCase().includes(q)
    )
  }, [logs, searchQuery])

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Date:</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                border: isPastDate ? '1.5px solid #ef4444' : '1px solid var(--border)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontWeight: 600,
                outline: 'none'
              }}
            />
            {isPastDate && (
              <button
                onClick={() => setDate(todayStr)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
                title="Reset date picker to today"
              >
                <span>📅</span>
                <span>Today ({todayStr})</span>
              </button>
            )}
          </div>
          <input 
            type="text" 
            placeholder="Search employee or department..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              flex: '1 1 220px',
              width: '100%',
              outline: 'none'
            }}
          />
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
              <strong>Past Date Locked ({date}):</strong> Check-in, punch-in, and punch-out are strictly disabled for past dates. Employees and Security Guards cannot record or alter attendance for past dates.
            </div>
          </div>
        )}
      </div>

      {/* Stats Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '1rem' }}>
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

      {/* Data Table */}
      <div style={cardStyle}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: 'var(--text-main)', margin: 0 }}>Attendance Sheet</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any employee's action button to open the One-Tap Punch-In / Punch-Out interface.
            </p>
          </div>
          {loading && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</span>}
        </div>
        <div className="table-scroll-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '880px' }}>
            <thead style={{ backgroundColor: 'var(--bg-main)' }}>
              <tr>
                {['Employee', 'Department', 'Status', 'Punch In', 'Punch Out', 'Total Hours', 'Mode', isPastDate ? 'Lock Status' : isFutureDate ? 'Future Status' : 'One-Tap Action'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{loading ? 'Fetching attendance...' : 'No records found.'}</td></tr>
              ) : filteredLogs.map(log => {
                const isCurrentlyIn = !!log.punchIn && !log.punchOut
                const isCompleted = !!log.punchIn && !!log.punchOut
                return (
                  <tr key={log.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{log.employeeName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.employeeId}</div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '0.85rem' }}>{log.department}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{log.designation}</div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
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
                    <td style={{ padding: '1rem 1.25rem', color: (log.isLate || log.status === 'LATE') ? '#f59e0b' : 'var(--success)', fontWeight: 600 }}>
                      {formatTime(log.punchIn)}
                      {(log.isLate || log.status === 'LATE') && log.lateMinutes ? (
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                          +{log.lateMinutes >= 60 ? `${Math.floor(log.lateMinutes / 60)}h ${log.lateMinutes % 60}m` : `${log.lateMinutes}m`} late
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: log.punchOut ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600 }}>{formatTime(log.punchOut)}</td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-main)', fontWeight: 600 }}>{formatMinutes(log.totalMinutes)}</td>
                    <td style={{ padding: '1rem 1.25rem' }}><span style={{ fontSize: '1rem' }} title={log.punchInMode || 'Unknown'}>{log.punchInMode ? MODE_ICON[log.punchInMode] : '—'}</span></td>
                    <td style={{ padding: '0.75rem 1.25rem' }}>
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* One-Tap Punch Interface Modal */}
      {activePunchEmployee && (
        <div
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

    </div>
  )
}
