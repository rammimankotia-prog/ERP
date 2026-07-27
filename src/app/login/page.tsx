'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  // Login Form States
  const [activeTab, setActiveTab] = useState<'login' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Form States
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        login(data.user);
        if (!rememberMe) {
          // If remember me is unchecked, transfer from localStorage to sessionStorage in auth logic
          sessionStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(data.user));
        }
        router.push('/');
      } else {
        setErrorMsg(data.error || 'Invalid credentials. Please verify username and password.');
      }
    } catch (err) {
      setErrorMsg('Unable to connect to authentication server. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetSuccess(data.message);
      } else {
        setResetError(data.error || 'Password reset request failed.');
      }
    } catch (err) {
      setResetError('Server communication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(circle at 20% 20%, #1e293b 0%, #0f172a 60%, #020617 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Subtle decorative gold ambient light */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-5%',
        width: '650px',
        height: '650px',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
        borderRadius: '50%'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        left: '-5%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
        borderRadius: '50%'
      }} />

      {/* Main Login Portal Card Grid */}
      <div style={{
        width: '100%',
        maxWidth: '1150px',
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '28px',
        boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(245, 158, 11, 0.15)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* Left Column: Brand & Luxury Hotel Showcase */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          padding: '3.5rem 3rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'relative'
        }}>
          {/* Top Gold Accent Line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #d97706 100%)'
          }} />

          <div>
            {/* Header Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              color: '#fbbf24',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '1.75rem'
            }}>
              <span>👑</span> HOTEL GRAND GODWIN &amp; GODWIN DELUXE
            </div>

            <h1 style={{
              color: 'white',
              fontSize: '2.5rem',
              fontWeight: 900,
              margin: '0 0 0.75rem 0',
              letterSpacing: '-0.03em',
              lineHeight: 1.15
            }}>
              Enterprise ERP Terminal
            </h1>
            <p style={{
              color: '#94a3b8',
              fontSize: '1.05rem',
              lineHeight: 1.6,
              margin: '0 0 2.5rem 0',
              fontWeight: 500
            }}>
              New Delhi&apos;s premier luxury 3-star hospitality destination. Centralized executive control for reservations, dynamic room rates, and tour operations.
            </p>

            {/* Feature Highlights Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(2, 6, 23, 0.5)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🏨</div>
                <div>
                  <h4 style={{ color: 'white', margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Live Inventory &amp; Reservations</h4>
                  <p style={{ color: '#64748b', margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>Real-time rate management across all room categories</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(2, 6, 23, 0.5)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🌍</div>
                <div>
                  <h4 style={{ color: 'white', margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Tour Packages &amp; Quotations</h4>
                  <p style={{ color: '#64748b', margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>End-to-end B2B agent itinerary pricing and ledger tracking</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(2, 6, 23, 0.5)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🤖</div>
                <div>
                  <h4 style={{ color: 'white', margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>AI Hospitality Intelligence</h4>
                  <p style={{ color: '#64748b', margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>Automated pricing rules and guest reputation analytics</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Official Link & Info */}
          <div style={{ paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              📍 8502/41, Arakshan Road, Pahar Ganj, New Delhi
            </div>
            <a
              href="https://grandgodwin.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#fbbf24',
                fontSize: '0.85rem',
                fontWeight: 700,
                textDecoration: 'none',
                padding: '0.4rem 0.8rem',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              <span>🌐</span> Official Website ➔
            </a>
          </div>
        </div>

        {/* Right Column: Secure Login & Password Recovery Form */}
        <div style={{ padding: '3.5rem 3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div style={{ marginBottom: '2.25rem' }}>
            <h2 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 900, margin: '0 0 0.4rem 0', letterSpacing: '-0.02em' }}>
              {activeTab === 'login' ? 'Welcome Back, Executive' : 'Credential Recovery'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>
              {activeTab === 'login' ? 'Please sign in to access your hotel management dashboard.' : 'Verify your administrative email to receive recovery instructions.'}
            </p>
          </div>

          {/* Tab Switcher */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(0, 0, 0, 0.5)',
            padding: '0.3rem',
            borderRadius: '14px',
            marginBottom: '2rem',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
              style={{
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'login' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: activeTab === 'login' ? 'white' : '#64748b',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <span>🔐</span> Secure Sign In
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('reset'); setResetError(''); setResetSuccess(''); }}
              style={{
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'reset' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: activeTab === 'reset' ? 'white' : '#64748b',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <span>❓</span> Reset Password
            </button>
          </div>

          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
              {errorMsg && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderLeft: '4px solid #ef4444',
                  padding: '1rem 1.15rem',
                  borderRadius: '10px',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  lineHeight: 1.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Username or Email Address
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(2, 6, 23, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '0 1rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}>
                  <span style={{ color: '#64748b', fontSize: '1.2rem', marginRight: '0.6rem' }}>👤</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Godwinhotels"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: '0.85rem 0',
                      color: 'white',
                      fontSize: '1rem',
                      outline: 'none',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reset')}
                    style={{ background: 'transparent', border: 'none', color: '#fbbf24', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'underline' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(2, 6, 23, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '0 1rem'
                }}>
                  <span style={{ color: '#64748b', fontSize: '1.2rem', marginRight: '0.6rem' }}>🔑</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: '0.85rem 0',
                      color: 'white',
                      fontSize: '1rem',
                      outline: 'none',
                      fontWeight: 600
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '0.4rem',
                      fontSize: '1.2rem'
                    }}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#d97706', width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="remember" style={{ color: '#cbd5e1', cursor: 'pointer', fontWeight: 600 }}>
                  Remember executive session for 30 days
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: isSubmitting ? '#92400e' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '1rem',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 20px -5px rgba(217, 119, 6, 0.4)',
                  transition: 'all 0.2s',
                  marginTop: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem'
                }}
              >
                {isSubmitting ? (
                  <>
                    <span style={{ width: '20px', height: '20px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                    Authenticating Credentials...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Access Executive Dashboard ➔
                  </>
                )}
              </button>

              {/* Quick Credentials Info Card for User Convenience */}
              <div style={{
                marginTop: '1rem',
                padding: '1rem 1.25rem',
                background: 'rgba(2, 6, 23, 0.5)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.8rem',
                color: '#94a3b8',
                lineHeight: 1.5
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontWeight: 800, marginBottom: '0.3rem' }}>
                  <span>🔒</span> Root Admin Access
                </div>
                Username: <strong style={{ color: 'white', fontFamily: 'monospace' }}>Godwinhotels</strong> | Password: <strong style={{ color: 'white', fontFamily: 'monospace' }}>Godwindeluxe@99</strong>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
              {resetError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', borderLeft: '4px solid #ef4444', padding: '1rem 1.15rem', borderRadius: '10px', color: '#fca5a5', fontSize: '0.85rem', fontWeight: 700 }}>
                  ⚠️ {resetError}
                </div>
              )}
              {resetSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', borderLeft: '4px solid #10b981', padding: '1rem 1.15rem', borderRadius: '10px', color: '#6ee7b7', fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.5 }}>
                  ✅ {resetSuccess}
                </div>
              )}

              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                Enter your registered username or admin contact (<strong style={{ color: '#fbbf24' }}>mail@godwinhotels.com</strong>). An automated verification email with temporary login token will be generated.
              </p>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Admin / Registered Email Address
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(2, 6, 23, 0.7)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '12px', padding: '0 1rem' }}>
                  <span style={{ color: '#64748b', fontSize: '1.2rem', marginRight: '0.6rem' }}>✉️</span>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="mail@godwinhotels.com"
                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.85rem 0', color: 'white', fontSize: '1rem', outline: 'none', fontWeight: 600 }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: isSubmitting ? '#1e3a8a' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '1rem',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)',
                  transition: 'all 0.2s',
                  marginTop: '0.75rem'
                }}
              >
                {isSubmitting ? 'Processing Request...' : '📧 Send Recovery Instructions'}
              </button>
            </form>
          )}

          {/* Bottom Security Audit Notice */}
          <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
              🔒 Protected by Godwin Security Protocol v3.0. All access attempts are logged.<br />
              For technical assistance, contact: <a href="mailto:mail@godwinhotels.com" style={{ color: '#fbbf24', textDecoration: 'none', fontWeight: 700 }}>mail@godwinhotels.com</a>
            </p>
          </div>
        </div>

      </div>

      <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
