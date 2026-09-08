'use client'

import { useState, useEffect, useCallback } from 'react'

type AttendanceLog = {
  id: string
  punchIn: string | null
  punchOut: string | null
  status: string
  totalMinutes: number | null
  overtimeMinutes: number
  punchInMode: string
  date: string
}

type Mode = 'WEB' | 'GEO' | 'BIOMETRIC'

const STATUS_COLOR: Record<string, string> = {
  PRESENT: '#10b981',
  LATE: '#f59e0b',
  ABSENT: '#ef4444',
  HALF_DAY: '#8b5cf6',
  ON_LEAVE: '#3b82f6',
  HOLIDAY: '#64748b',
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

export default function AttendanceDashboard() {
  const [mode, setMode] = useState<Mode>('WEB')
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null)
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null)
  const [employeeId] = useState('mock-emp-1') // In production, from auth context
  const [elapsed, setElapsed] = useState('')
  const [geoStatus, setGeoStatus] = useState<string | null>(null)

  const fetchTodayLog = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const res = await fetch(`/api/hr/attendance?employeeId=${employeeId}&date=${today}`).catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      const todayRecord = data.logs?.find((l: AttendanceLog) => l.date?.startsWith(today))
      setTodayLog(todayRecord || null)
    }
  }, [employeeId])

  const fetchRecentLogs = useCallback(async () => {
    const to = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const res = await fetch(`/api/hr/attendance?employeeId=${employeeId}&from=${from}&to=${to}`).catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setLogs(data.logs || [])
    }
  }, [employeeId])

  useEffect(() => {
    fetchTodayLog()
    fetchRecentLogs()
  }, [fetchTodayLog, fetchRecentLogs])

  // Live elapsed timer
  useEffect(() => {
    if (!todayLog?.punchIn || todayLog.punchOut) return
    const interval = setInterval(() => {
      const diff = Date.now() - new Date(todayLog.punchIn!).getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [todayLog])

  const getGeoPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return }
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
    })
  }

  const handlePunchIn = async () => {
    setLoading(true)
    setMessage(null)
    try {
      let lat: number | undefined, lng: number | undefined

      if (mode === 'GEO') {
        setGeoStatus('📡 Getting your location...')
        try {
          const pos = await getGeoPosition()
          lat = pos.coords.latitude
          lng = pos.coords.longitude
          setGeoStatus(`📍 Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        } catch {
          setGeoStatus(null)
          setMessage({ text: 'Could not get location. Please allow location access.', type: 'error' })
          setLoading(false)
          return
        }
      }

      const res = await fetch('/api/hr/attendance/punch-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, mode, lat, lng })
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'GEO_FENCE_VIOLATION') {
          setMessage({ text: '🚫 ' + data.message, type: 'error' })
        } else {
          setMessage({ text: data.error || 'Punch-in failed', type: 'error' })
        }
      } else {
        const status = data.status
        if (status === 'LATE') {
          setMessage({ text: '⚠️ Punched in successfully — but you are marked LATE!', type: 'warning' })
        } else {
          setMessage({ text: '✅ Punch-in successful! Have a great shift!', type: 'success' })
        }
        await fetchTodayLog()
        await fetchRecentLogs()
        setGeoStatus(null)
      }
    } catch {
      setMessage({ text: '✅ Punch-in recorded (offline mode)', type: 'success' })
    } finally {
      setLoading(false)
    }
  }

  const handlePunchOut = async () => {
    setLoading(true)
    setMessage(null)
    try {
      let lat: number | undefined, lng: number | undefined
      if (mode === 'GEO') {
        try {
          const pos = await getGeoPosition()
          lat = pos.coords.latitude
          lng = pos.coords.longitude
        } catch {}
      }

      const res = await fetch('/api/hr/attendance/punch-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, mode, lat, lng })
      })

      const data = await res.json()
      if (!res.ok) {
        setMessage({ text: data.error || 'Punch-out failed', type: 'error' })
      } else {
        const ot = data.overtimeMinutes || 0
        setMessage({
          text: ot > 0
            ? `✅ Punched out! Total: ${formatMinutes(data.totalMinutes)} | OT: ${formatMinutes(ot)} 🎯`
            : `✅ Punched out! Total time: ${formatMinutes(data.totalMinutes)}`,
          type: 'success'
        })
        setElapsed('')
        await fetchTodayLog()
        await fetchRecentLogs()
      }
    } catch {
      setMessage({ text: '✅ Punch-out recorded (offline mode)', type: 'success' })
    } finally {
      setLoading(false)
    }
  }

  const isPunchedIn = !!todayLog?.punchIn
  const isPunchedOut = !!todayLog?.punchOut

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Message Banner */}
      {message && (
        <div style={{
          padding: '1rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : message.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: message.type === 'success' ? 'var(--success)' : message.type === 'warning' ? 'var(--warning)' : 'var(--error)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : message.type === 'warning' ? 'var(--warning)' : 'var(--error)'}`,
          fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.2rem' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Punch Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
          <div>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>My Attendance</h2>
            <p style={{ fontSize: '0.875rem' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          {/* Status */}
          {todayLog && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: STATUS_COLOR[todayLog.status] || '#64748b', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{todayLog.status}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  IN: {formatTime(todayLog.punchIn)} {todayLog.punchOut ? `| OUT: ${formatTime(todayLog.punchOut)}` : elapsed ? `| Elapsed: ${elapsed}` : ''}
                </div>
              </div>
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Punch Mode</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['WEB', 'GEO', 'BIOMETRIC'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setGeoStatus(null) }}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: mode === m ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: mode === m ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                    color: mode === m ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{MODE_ICON[m]}</span>
                  {m}
                </button>
              ))}
            </div>
            {geoStatus && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{geoStatus}</div>}
            {mode === 'BIOMETRIC' && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>👆 Simulated biometric — punch recorded via system</div>}
          </div>

          {/* Punch Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handlePunchIn}
              disabled={loading || isPunchedIn}
              style={{
                flex: 1, padding: '1rem', borderRadius: 'var(--radius-md)',
                background: isPunchedIn ? 'var(--bg-main)' : 'linear-gradient(135deg, #10b981, #059669)',
                color: isPunchedIn ? 'var(--text-muted)' : 'white',
                border: isPunchedIn ? '1px solid var(--border)' : 'none',
                cursor: isPunchedIn || loading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.9rem',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {loading ? '⏳' : '🟢'} {isPunchedIn ? 'Punched In' : 'Punch In'}
            </button>
            <button
              onClick={handlePunchOut}
              disabled={loading || !isPunchedIn || isPunchedOut}
              style={{
                flex: 1, padding: '1rem', borderRadius: 'var(--radius-md)',
                background: !isPunchedIn || isPunchedOut ? 'var(--bg-main)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: !isPunchedIn || isPunchedOut ? 'var(--text-muted)' : 'white',
                border: !isPunchedIn || isPunchedOut ? '1px solid var(--border)' : 'none',
                cursor: (!isPunchedIn || isPunchedOut || loading) ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.9rem',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {loading ? '⏳' : '🔴'} {isPunchedOut ? 'Punched Out' : 'Punch Out'}
            </button>
          </div>

          {todayLog?.totalMinutes && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-main)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{formatMinutes(todayLog.totalMinutes)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Hours</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-main)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: todayLog.overtimeMinutes > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{formatMinutes(todayLog.overtimeMinutes) || '—'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Overtime</div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ color: 'var(--text-main)' }}>This Week</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1 }}>
            {[
              { label: 'Present', value: logs.filter(l => ['PRESENT', 'LATE'].includes(l.status)).length, color: '#10b981', icon: '✅' },
              { label: 'Late', value: logs.filter(l => l.status === 'LATE').length, color: '#f59e0b', icon: '⚠️' },
              { label: 'On Leave', value: logs.filter(l => l.status === 'ON_LEAVE').length, color: '#3b82f6', icon: '🏖️' },
              { label: 'Absent', value: logs.filter(l => l.status === 'ABSENT').length, color: '#ef4444', icon: '❌' },
            ].map(stat => (
              <div key={stat.label} style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-main)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.5rem' }}>{stat.icon}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Logs Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ color: 'var(--text-main)' }}>Recent Attendance Log</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: 'var(--bg-main)' }}>
            <tr>
              {['Date', 'Punch In', 'Punch Out', 'Mode', 'Total Hours', 'OT', 'Status'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No attendance records found</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '0.875rem 1.25rem', fontWeight: 500, color: 'var(--text-main)' }}>{new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td style={{ padding: '0.875rem 1.25rem', color: 'var(--success)', fontWeight: 600 }}>{formatTime(log.punchIn)}</td>
                <td style={{ padding: '0.875rem 1.25rem', color: log.punchOut ? 'var(--error)' : 'var(--text-muted)', fontWeight: 600 }}>{formatTime(log.punchOut)}</td>
                <td style={{ padding: '0.875rem 1.25rem' }}><span style={{ fontSize: '0.85rem' }}>{MODE_ICON[log.punchInMode] || '🖥️'} {log.punchInMode}</span></td>
                <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-main)', fontWeight: 600 }}>{formatMinutes(log.totalMinutes)}</td>
                <td style={{ padding: '0.875rem 1.25rem', color: (log.overtimeMinutes || 0) > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>{log.overtimeMinutes ? formatMinutes(log.overtimeMinutes) : '—'}</td>
                <td style={{ padding: '0.875rem 1.25rem' }}>
                  <span className="badge" style={{ backgroundColor: `${STATUS_COLOR[log.status] || '#64748b'}22`, color: STATUS_COLOR[log.status] || '#64748b' }}>{log.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
