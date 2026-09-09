'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'

type Employee = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  department: string
  designation: string
}

export default function KioskDashboard() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasPunchedIn, setHasPunchedIn] = useState(false)
  const [hasPunchedOut, setHasPunchedOut] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  const router = useRouter()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Load employee and check status
  useEffect(() => {
    const saved = localStorage.getItem('kiosk_employee')
    if (!saved) {
      router.push('/kiosk')
      return
    }
    try {
      const emp = JSON.parse(saved)
      setEmployee(emp)
      checkStatus(emp.id)
    } catch {
      router.push('/kiosk')
    }
  }, [router])

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const checkStatus = async (empId: string) => {
    try {
      const res = await fetch(`/api/hr/attendance?date=${new Date().toISOString().split('T')[0]}`)
      if (res.ok) {
        const data = await res.json()
        const record = data.logs?.find((l: any) => l.employeeId === empId)
        if (record && record.punchIn) {
          setHasPunchedIn(true)
          if (record.punchOut) {
            setHasPunchedOut(true)
          }
        }
      }
    } catch (err) {
      console.error('Failed to check status', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePunch = async (action: 'IN' | 'OUT') => {
    setProcessing(true)
    setMessage('')
    try {
      const res = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee?.id, action })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to punch')
      
      setMessage(`Successfully checked ${action.toLowerCase()} at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`)
      
      // Auto logout after 3 seconds
      setTimeout(() => {
        handleLogout()
      }, 3000)

    } catch (err: any) {
      setMessage(err.message)
      setProcessing(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('kiosk_employee')
    router.push('/kiosk')
  }

  if (loading || !employee) {
    return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: isLight ? '#f1f5f9' : '#0f172a',
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        background: isLight ? '#ffffff' : '#1e293b',
        padding: '1.25rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>🏨</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: isLight ? '#0f172a' : '#f8fafc' }}>Terminal 1 - Front Desk</h1>
            <p style={{ margin: 0, color: isLight ? '#64748b' : '#94a3b8', fontSize: '0.85rem' }}>Self-Service Attendance Kiosk</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em' }}>
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: '0.85rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
            {currentTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Main Content Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Side: Personal Check-In */}
        <div style={{ 
          flex: 1, 
          padding: '3rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: isLight ? '#ffffff' : '#1e293b',
            borderRadius: '24px',
            padding: '3rem',
            width: '100%',
            maxWidth: '500px',
            boxShadow: isLight ? '0 20px 40px rgba(0,0,0,0.08)' : '0 20px 40px rgba(0,0,0,0.4)',
            border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
            textAlign: 'center'
          }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              color: 'white',
              fontWeight: 800,
              boxShadow: '0 10px 20px rgba(37, 99, 235, 0.3)'
            }}>
              {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
            </div>
            
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', color: isLight ? '#0f172a' : '#f8fafc' }}>
              Welcome, {employee.firstName} {employee.lastName}
            </h2>
            <p style={{ margin: '0 0 2.5rem', color: isLight ? '#64748b' : '#94a3b8', fontSize: '1.1rem' }}>
              {employee.designation} • {employee.department}
            </p>

            {message ? (
              <div style={{
                padding: '1.5rem',
                borderRadius: '12px',
                background: message.includes('Successfully') ? '#dcfce7' : '#fee2e2',
                color: message.includes('Successfully') ? '#166534' : '#991b1b',
                fontSize: '1.1rem',
                fontWeight: 600,
                marginBottom: '1.5rem'
              }}>
                {message}
                <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 500 }}>Auto-logging out in 3 seconds...</div>
              </div>
            ) : hasPunchedOut ? (
              <div style={{
                padding: '2rem',
                borderRadius: '16px',
                background: isLight ? '#f1f5f9' : '#0f172a',
                color: isLight ? '#334155' : '#cbd5e1',
                fontSize: '1.2rem',
                fontWeight: 600,
                border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b'
              }}>
                ✅ You have completed your shift for today. Have a great day!
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={() => handlePunch('IN')}
                  disabled={processing || hasPunchedIn}
                  style={{
                    flex: 1,
                    padding: '1.5rem',
                    borderRadius: '16px',
                    border: 'none',
                    background: hasPunchedIn ? (isLight ? '#e2e8f0' : '#334155') : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: hasPunchedIn ? (isLight ? '#94a3b8' : '#64748b') : 'white',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    cursor: (processing || hasPunchedIn) ? 'not-allowed' : 'pointer',
                    boxShadow: (!hasPunchedIn && !processing) ? '0 10px 25px rgba(16, 185, 129, 0.4)' : 'none',
                    transition: 'all 0.2s',
                    transform: (!hasPunchedIn && !processing) ? 'scale(1.05)' : 'scale(1)',
                    opacity: hasPunchedIn ? 0.6 : 1
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🟢</div>
                  Check-In
                </button>

                <button
                  onClick={() => handlePunch('OUT')}
                  disabled={processing || !hasPunchedIn}
                  style={{
                    flex: 1,
                    padding: '1.5rem',
                    borderRadius: '16px',
                    border: 'none',
                    background: !hasPunchedIn ? (isLight ? '#e2e8f0' : '#334155') : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: !hasPunchedIn ? (isLight ? '#94a3b8' : '#64748b') : 'white',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    cursor: (processing || !hasPunchedIn) ? 'not-allowed' : 'pointer',
                    boxShadow: (hasPunchedIn && !processing) ? '0 10px 25px rgba(239, 68, 68, 0.4)' : 'none',
                    transition: 'all 0.2s',
                    transform: (hasPunchedIn && !processing) ? 'scale(1.05)' : 'scale(1)',
                    opacity: !hasPunchedIn ? 0.6 : 1
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔴</div>
                  Check-Out
                </button>
              </div>
            )}

            <button
              onClick={handleLogout}
              style={{
                marginTop: '3rem',
                background: 'transparent',
                border: 'none',
                color: isLight ? '#64748b' : '#94a3b8',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Not {employee.firstName}? Log out
            </button>
          </div>
        </div>

        {/* Right Side: Live Status Log */}
        <div style={{
          width: '400px',
          background: isLight ? '#ffffff' : '#1e293b',
          borderLeft: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
            background: isLight ? '#f8fafc' : '#0f172a'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: isLight ? '#0f172a' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
              Live Shift Activity
            </h3>
            <p style={{ margin: '0.25rem 0 0', color: isLight ? '#64748b' : '#94a3b8', fontSize: '0.85rem' }}>
              Employees currently on shift
            </p>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <LiveStatusFeed isLight={isLight} refreshTrigger={hasPunchedIn || hasPunchedOut} />
          </div>
        </div>

      </div>
    </div>
  )
}

function LiveStatusFeed({ isLight, refreshTrigger }: { isLight: boolean, refreshTrigger: any }) {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/hr/attendance?date=${new Date().toISOString().split('T')[0]}`)
        if (res.ok) {
          const data = await res.json()
          // Only show people who have punched in
          const active = data.logs.filter((l: any) => l.punchIn)
          // Sort by latest punch in (descending)
          active.sort((a: any, b: any) => new Date(b.punchIn).getTime() - new Date(a.punchIn).getTime())
          setLogs(active)
        }
      } catch (err) {}
    }
    fetchLive()
    // Poll every 10 seconds to keep feed alive
    const interval = setInterval(fetchLive, 10000)
    return () => clearInterval(interval)
  }, [refreshTrigger])

  if (logs.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: isLight ? '#94a3b8' : '#64748b' }}>No activity yet today.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {logs.map((log: any, idx: number) => {
        const timeIn = new Date(log.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        const timeOut = log.punchOut ? new Date(log.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null
        const isCompleted = !!log.punchOut

        return (
          <div key={idx} style={{
            padding: '1rem',
            borderRadius: '12px',
            background: isLight ? (isCompleted ? '#f8fafc' : '#eff6ff') : (isCompleted ? '#0f172a' : 'rgba(37, 99, 235, 0.1)'),
            border: isLight ? `1px solid ${isCompleted ? '#e2e8f0' : '#bfdbfe'}` : `1px solid ${isCompleted ? '#1e293b' : 'rgba(37, 99, 235, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: isCompleted ? (isLight ? '#e2e8f0' : '#334155') : '#3b82f6',
              color: isCompleted ? (isLight ? '#64748b' : '#94a3b8') : 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1rem'
            }}>
              {log.employeeName.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: isLight ? '#0f172a' : '#f8fafc', fontSize: '0.95rem' }}>
                {log.employeeName}
              </div>
              <div style={{ fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                {log.department}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
              <div style={{ color: '#10b981', fontWeight: 600 }}>IN: {timeIn}</div>
              {timeOut && <div style={{ color: '#ef4444', fontWeight: 600 }}>OUT: {timeOut}</div>}
              {!timeOut && <div style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '0.2rem' }}>Working</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
