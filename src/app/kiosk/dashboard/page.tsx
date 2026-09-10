'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'
import OneTapPunchInterface from '@/components/OneTapPunchInterface'

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

  // Load employee and check status with multi-window synchronization
  useEffect(() => {
    const saved = localStorage.getItem('kiosk_employee')
    if (!saved) {
      router.push('/login?mode=employee')
      return
    }
    try {
      const emp = JSON.parse(saved)
      setEmployee(emp)
      checkStatus(emp.id)
    } catch {
      router.push('/login?mode=employee')
      return
    }

    // BroadcastChannel listener
    let bc: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('GODWIN_AUTH_BROADCAST_CHANNEL')
        bc.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT' || event.data?.type === 'KIOSK_LOGOUT') {
            setEmployee(null)
            try { localStorage.removeItem('kiosk_employee') } catch {}
            router.push('/login?mode=employee')
          }
        }
      }
    } catch {}

    // Storage event listener for cross-window logout sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'GODWIN_LOGOUT_EVENT' || (e.key === 'kiosk_employee' && !e.newValue)) {
        setEmployee(null)
        router.push('/login?mode=employee')
      }
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      if (bc) {
        try { bc.close() } catch {}
      }
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
    const now = Date.now().toString()
    try {
      localStorage.removeItem('kiosk_employee')
      localStorage.setItem('GODWIN_LOGOUT_EVENT', now)
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('GODWIN_AUTH_BROADCAST_CHANNEL')
        bc.postMessage({ type: 'KIOSK_LOGOUT', timestamp: now })
        bc.close()
      }
    } catch {}
    router.push('/login?mode=employee')
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
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexWrap: 'wrap',
          overflow: 'auto',
        }}
      >
        {/* Left Side: One-Tap Punch Interface */}
        <div
          style={{
            flex: '1 1 500px',
            padding: 'clamp(1rem, 2.5vw, 2.5rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <OneTapPunchInterface
            employee={employee}
            onBack={handleLogout}
            onSuccess={() => {
              setHasPunchedIn(true);
            }}
          />
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
