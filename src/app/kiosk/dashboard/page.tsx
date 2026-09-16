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
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [unreadApproval, setUnreadApproval] = useState<any | null>(null)

  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  const fetchNotifications = async (empId: string, empCode?: string) => {
    try {
      const res = await fetch(`/api/notifications?employeeId=${encodeURIComponent(empId)}&employeeCode=${encodeURIComponent(empCode || '')}`)
      if (res.ok) {
        const data = await res.json()
        const notifs = data.notifications || []
        setNotifications(notifs)
        const unread = data.unreadCount ?? notifs.filter((n: any) => !n.read).length
        setUnreadCount(unread)
        const latestImportant = notifs.find((n: any) => !n.read && (n.type === 'LEAVE_APPROVED' || n.type === 'LEAVE_REJECTED'))
        setUnreadApproval(latestImportant || null)
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err)
    }
  }

  const markNotificationRead = async (notifId?: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MARK_READ',
          id: notifId,
          employeeId: employee?.id
        })
      })
      if (notifId) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
        if (unreadApproval?.id === notifId) setUnreadApproval(null)
        setUnreadCount(prev => Math.max(0, prev - 1))
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadApproval(null)
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('Failed to mark notification read', err)
    }
  }

  // Load employee and check status with multi-window synchronization
  useEffect(() => {
    const saved = localStorage.getItem('kiosk_employee') || sessionStorage.getItem('kiosk_employee')
    if (!saved) {
      router.push('/login')
      return
    }
    try {
      const emp = JSON.parse(saved)
      if (emp.expiresAt && emp.expiresAt < Date.now()) {
        localStorage.removeItem('kiosk_employee')
        localStorage.removeItem('GODWIN_REMEMBER_30DAYS')
        sessionStorage.removeItem('kiosk_employee')
        router.push('/login?expired=true')
        return
      }
      setEmployee(emp)
      checkStatus(emp.id)
      fetchNotifications(emp.id, emp.employeeId)

      // Real-time deactivation check
      const verifyActive = async () => {
        try {
          const res = await fetch(`/api/auth/session-check?employeeId=${encodeURIComponent(emp.id)}&email=${encodeURIComponent(emp.email || '')}`)
          if (res.ok) {
            const data = await res.json()
            if (data.active === false) {
              setEmployee(null)
              try {
                localStorage.removeItem('kiosk_employee')
                sessionStorage.removeItem('kiosk_employee')
                localStorage.removeItem('GODWIN_REMEMBER_30DAYS')
                document.cookie = 'kiosk_employee=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
              } catch {}
              window.location.href = '/login?deactivated=true'
            }
          }
        } catch {}
      }

      verifyActive()
      const focusHandler = () => verifyActive()
      window.addEventListener('focus', focusHandler)

      // Poll notifications and check active status every 10-15 seconds
      const notifTimer = setInterval(() => {
        fetchNotifications(emp.id, emp.employeeId)
        verifyActive()
      }, 10000)

      return () => {
        clearInterval(notifTimer)
        window.removeEventListener('focus', focusHandler)
      }
    } catch {
      router.push('/login')
      return
    }
  }, [router])

  useEffect(() => {
    // BroadcastChannel listener
    let bc: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('GODWIN_AUTH_BROADCAST_CHANNEL')
        bc.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT' || event.data?.type === 'KIOSK_LOGOUT') {
            setEmployee(null)
            try { 
              localStorage.removeItem('kiosk_employee')
              sessionStorage.removeItem('kiosk_employee')
            } catch {}
            router.push('/login?mode=employee')
          } else if (event.data?.type === 'FORCE_LOGOUT_USER') {
            const tId = event.data.targetId
            const tEmail = event.data.targetEmail?.toLowerCase()
            const tUser = event.data.targetUsername?.toLowerCase()
            const currentSaved = localStorage.getItem('kiosk_employee') || sessionStorage.getItem('kiosk_employee')
            let curEmp: any = employee
            if (!curEmp && currentSaved) {
              try { curEmp = JSON.parse(currentSaved); } catch {}
            }
            if (
              curEmp &&
              (curEmp.id === tId ||
               curEmp.employeeId === tId ||
               (curEmp.email && curEmp.email.toLowerCase() === tEmail) ||
               (curEmp.employeeId && curEmp.employeeId.toLowerCase() === tUser))
            ) {
              setEmployee(null)
              try {
                localStorage.removeItem('kiosk_employee')
                sessionStorage.removeItem('kiosk_employee')
                localStorage.removeItem('GODWIN_REMEMBER_30DAYS')
                document.cookie = 'kiosk_employee=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
              } catch {}
              window.location.href = '/login?deactivated=true'
            }
          }
        }
      }
    } catch {}

    // Storage event listener for cross-window logout sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'GODWIN_DEACTIVATED_USER' && e.newValue) {
        try {
          const target = JSON.parse(e.newValue)
          const currentSaved = localStorage.getItem('kiosk_employee') || sessionStorage.getItem('kiosk_employee')
          if (currentSaved) {
            const cur = JSON.parse(currentSaved)
            if (cur.id === target.id || cur.employeeId === target.id || (cur.email && cur.email.toLowerCase() === target.email?.toLowerCase())) {
              setEmployee(null)
              localStorage.removeItem('kiosk_employee')
              sessionStorage.removeItem('kiosk_employee')
              localStorage.removeItem('GODWIN_REMEMBER_30DAYS')
              window.location.href = '/login?deactivated=true'
            }
          }
        } catch {}
      } else if (e.key === 'GODWIN_LOGOUT_EVENT' || (e.key === 'kiosk_employee' && !e.newValue)) {
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
  }, [router, employee])

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
      localStorage.removeItem('GODWIN_REMEMBER_30DAYS')
      sessionStorage.removeItem('kiosk_employee')
      document.cookie = 'kiosk_employee=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
      localStorage.setItem('GODWIN_LOGOUT_EVENT', now)
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('GODWIN_AUTH_BROADCAST_CHANNEL')
        bc.postMessage({ type: 'KIOSK_LOGOUT', timestamp: now })
        bc.close()
      }
    } catch {}
    router.push('/login?logout=true')
  }

  if (loading || !employee) {
    return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: isLight ? '#f8fafc' : '#0b1329',
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        background: isLight ? '#ffffff' : '#0f172a',
        padding: '1rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: isLight ? '1px solid #cbd5e1' : '1px solid #1e293b',
        position: 'relative',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ fontSize: '1.8rem' }}>🏨</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: isLight ? '#0f172a' : '#f8fafc' }}>Terminal 1 - Front Desk</h1>
            <p style={{ margin: 0, color: isLight ? '#475569' : '#94a3b8', fontSize: '0.82rem', fontWeight: 500 }}>Self-Service Attendance Kiosk</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Night / Day Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              background: isLight ? '#f1f5f9' : '#1e293b',
              border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: isLight ? '#0f172a' : '#f8fafc',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}
            title={isLight ? 'Switch to Night Mode (Dark)' : 'Switch to Day Mode (Light)'}
            aria-label="Toggle Night/Day Mode"
          >
            {isLight ? '🌙' : '☀️'}
          </button>

          {/* Notification Bell Button & Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowNotifs(prev => !prev)}
              style={{
                position: 'relative',
                background: isLight ? '#f1f5f9' : '#1e293b',
                border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.15rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: unreadCount > 0 ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none'
              }}
              title="Notifications"
              aria-label="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '2px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                  minWidth: '18px',
                  textAlign: 'center'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Drawer */}
            {showNotifs && (
              <div style={{
                position: 'absolute',
                top: '52px',
                right: '0',
                width: '360px',
                maxHeight: '450px',
                background: isLight ? '#ffffff' : '#1e293b',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '1rem 1.25rem',
                  borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isLight ? '#f8fafc' : '#0f172a'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isLight ? '#0f172a' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        fontWeight: 700
                      }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ overflowY: 'auto', maxHeight: '350px', padding: '0.5rem' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: isLight ? '#94a3b8' : '#64748b', fontSize: '0.9rem' }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const isApproved = notif.type === 'LEAVE_APPROVED'
                      const isRejected = notif.type === 'LEAVE_REJECTED'
                      return (
                        <div
                          key={notif.id}
                          style={{
                            padding: '0.85rem 1rem',
                            borderRadius: '10px',
                            marginBottom: '0.5rem',
                            background: !notif.read
                              ? (isApproved
                                  ? (isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)')
                                  : (isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.15)'))
                              : (isLight ? '#f8fafc' : '#0f172a'),
                            borderLeft: !notif.read
                              ? (isApproved ? '4px solid #10b981' : isRejected ? '4px solid #ef4444' : '4px solid #3b82f6')
                              : '4px solid transparent',
                            cursor: 'default',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div style={{
                              fontWeight: notif.read ? 600 : 700,
                              fontSize: '0.88rem',
                              color: isApproved ? '#059669' : isRejected ? '#dc2626' : (isLight ? '#0f172a' : '#f8fafc')
                            }}>
                              {notif.title}
                            </div>
                            {!notif.read && (
                              <button
                                type="button"
                                onClick={() => markNotificationRead(notif.id)}
                                title="Mark as read"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  color: isLight ? '#64748b' : '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '2px 4px'
                                }}
                              >
                                ✓
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: isLight ? '#475569' : '#cbd5e1', marginTop: '0.25rem', lineHeight: 1.4 }}>
                            {notif.message}
                          </div>
                          {notif.approverNote && (
                            <div style={{ fontSize: '0.78rem', color: isLight ? '#059669' : '#34d399', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              Remark: "{notif.approverNote}"
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: isLight ? '#94a3b8' : '#64748b', marginTop: '0.35rem' }}>
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', letterSpacing: '-0.02em' }}>
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ fontSize: '0.85rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
              {currentTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Prominent Active Leave Approval Notification Banner */}
      {unreadApproval && (
        <div style={{
          background: unreadApproval.type === 'LEAVE_APPROVED'
            ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
            : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
          color: '#ffffff',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
          zIndex: 40
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <div style={{
              fontSize: '1.8rem',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {unreadApproval.type === 'LEAVE_APPROVED' ? '🌴' : '⚠️'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em' }}>
                {unreadApproval.title}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.95, marginTop: '2px', lineHeight: 1.4 }}>
                {unreadApproval.message}
                {unreadApproval.approverNote && (
                  <span style={{ marginLeft: '8px', opacity: 0.9, fontStyle: 'italic', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                    Note: "{unreadApproval.approverNote}"
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => markNotificationRead(unreadApproval.id)}
            style={{
              background: '#ffffff',
              color: unreadApproval.type === 'LEAVE_APPROVED' ? '#065f46' : '#991b1b',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'transform 0.1s ease',
              flexShrink: 0
            }}
          >
            ✓ Got It (Dismiss)
          </button>
        </div>
      )}

      {/* Main Content Layout - Private Staff Self-Service Punch Interface */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'auto',
          padding: 'clamp(0.5rem, 2vw, 1.5rem)',
          width: '100%',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '680px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <OneTapPunchInterface
            employee={employee}
            onBack={handleLogout}
            showLeaveAndHistory={true}
            onSuccess={() => {
              setHasPunchedIn(true);
            }}
          />
        </div>
      </div>
    </div>
  )
}
