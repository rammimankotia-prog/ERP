'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'

export default function KioskLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { theme } = useTheme()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/kiosk/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Save to localStorage so dashboard can access it
      localStorage.setItem('kiosk_employee', JSON.stringify(data.employee))
      router.push('/kiosk/dashboard')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const isLight = theme === 'light'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isLight ? '#f8fafc' : '#0f172a',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: isLight ? '#ffffff' : '#1e293b',
        padding: '3rem 2.5rem',
        borderRadius: '16px',
        boxShadow: isLight ? '0 10px 25px rgba(0,0,0,0.05)' : '0 10px 25px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '400px',
        border: isLight ? '1px solid #e2e8f0' : '1px solid #334155'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏨</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: isLight ? '#0f172a' : '#f8fafc' }}>Employee Kiosk</h1>
          <p style={{ margin: '0.5rem 0 0', color: isLight ? '#64748b' : '#94a3b8', fontSize: '0.9rem' }}>Log in to mark your attendance</p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            textAlign: 'center',
            border: '1px solid #fecaca'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: isLight ? '#334155' : '#cbd5e1' }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. yourname@godwinhotels.com"
              required
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                borderRadius: '8px',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                background: isLight ? '#f8fafc' : '#0f172a',
                color: isLight ? '#0f172a' : '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: isLight ? '#334155' : '#cbd5e1' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                borderRadius: '8px',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                background: isLight ? '#f8fafc' : '#0f172a',
                color: isLight ? '#0f172a' : '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '0.875rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Logging in...' : 'Access Portal'}
          </button>
        </form>
      </div>
    </div>
  )
}
