'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [tab, setTab] = useState<'login' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [deactivatedAlert, setDeactivatedAlert] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('deactivated') === 'true') {
        setDeactivatedAlert(true);
        try {
          localStorage.removeItem('GODWIN_LOGGED_IN_USER');
          sessionStorage.removeItem('GODWIN_LOGGED_IN_USER');
          localStorage.removeItem('kiosk_employee');
          document.cookie = 'GODWIN_LOGGED_IN_USER=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        } catch {}
        return;
      }
    }
    if (user) router.replace('/');
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        login(data.user, rememberMe);
        router.push('/');
      } else {
        setError(data.error || 'Invalid credentials. Please check your username and password.');
      }
    } catch {
      setError('Unable to connect. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetSuccess(data.message || 'Recovery instructions sent to your email.');
      } else {
        setResetError(data.error || 'Reset request failed. Please try again.');
      }
    } catch {
      setResetError('Server error. Please try again later.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="al-wrap">
      <div className="al-glow-top" />
      <div className="al-glow-bottom" />

      <div className="al-card">
        <div className="al-accent-bar" />

        {/* Brand */}
        <div className="al-brand">
          <div className="al-brand-logo">👑</div>
          <div className="al-brand-text">
            <div className="al-brand-name">Hotel Grand Godwin</div>
            <div className="al-brand-sub">Executive ERP · Management Portal</div>
          </div>
        </div>

        {/* Header */}
        <div className="al-header">
          <div className="al-badge">
            <span>🔐</span>
            <span>ADMIN &amp; MANAGEMENT PORTAL</span>
          </div>
          <h1 className="al-title">
            {tab === 'login' ? 'Admin Login' : 'Reset Password'}
          </h1>
          <p className="al-subtitle">
            {tab === 'login'
              ? 'Sign in with administrative credentials to access the ERP dashboard.'
              : 'Enter your registered email to receive password recovery instructions.'}
          </p>
        </div>

        {/* Deactivated Notice Banner */}
        {deactivatedAlert && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 14,
            padding: '1rem 1.15rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem',
            color: '#ef4444',
            fontSize: '0.88rem',
            lineHeight: 1.45,
            boxShadow: '0 4px 16px rgba(239,68,68,0.12)'
          }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🚫</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.2rem', color: '#dc2626' }}>
                Account Deactivated
              </div>
              <div style={{ opacity: 0.95 }}>
                Your account has been deactivated. You have been automatically logged out from all platforms, devices, and sessions. Please contact Master Admin.
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="al-tabs">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); }}
            className={`al-tab ${tab === 'login' ? 'al-tab-active' : ''}`}
          >
            🔐 Secure Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('reset'); setResetError(''); setResetSuccess(''); }}
            className={`al-tab ${tab === 'reset' ? 'al-tab-active' : ''}`}
          >
            ❓ Reset Password
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="al-form">
            {error && (
              <div className="al-alert al-alert-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="al-field">
              <label className="al-label">Username or Admin Email</label>
              <div className="al-input-wrap">
                <span className="al-icon">👤</span>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="al-input"
                />
              </div>
            </div>

            <div className="al-field">
              <div className="al-pw-header">
                <label className="al-label" style={{ margin: 0 }}>Password</label>
                <button type="button" className="al-forgot" onClick={() => setTab('reset')}>
                  Forgot password?
                </button>
              </div>
              <div className="al-input-wrap">
                <span className="al-icon">🔑</span>
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="al-input"
                />
                <button
                  type="button"
                  className="al-eye"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label="Toggle password"
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="al-remember" onClick={() => setRememberMe(v => !v)}>
              <input
                type="checkbox"
                id="remAdmin"
                checked={rememberMe}
                onChange={e => { e.stopPropagation(); setRememberMe(e.target.checked); }}
                className="al-checkbox"
              />
              <div className="al-remember-text">
                <label htmlFor="remAdmin" onClick={e => e.stopPropagation()} className="al-remember-label">
                  Remember session for 30 days
                </label>
                <span className="al-remember-hint">
                  Keep executive session active on this device
                </span>
              </div>
              {rememberMe && (
                <span className="al-remember-badge">
                  ✓ 30 Days
                </span>
              )}
            </div>

            <button type="submit" disabled={loading} className="al-submit">
              {loading ? (
                <><span className="al-spinner" /> Authenticating...</>
              ) : (
                <><span>🚀</span> Access Executive Dashboard</>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="al-form">
            {resetError && (
              <div className="al-alert al-alert-error">
                <span>⚠️</span>
                <span>{resetError}</span>
              </div>
            )}
            {resetSuccess && (
              <div className="al-alert al-alert-success">
                <span>✅</span>
                <span>{resetSuccess}</span>
              </div>
            )}

            <p className="al-reset-info">
              Enter your registered admin email to receive a secure password recovery link.
            </p>

            <div className="al-field">
              <label className="al-label">Admin Email Address</label>
              <div className="al-input-wrap">
                <span className="al-icon">✉️</span>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="admin@godwinhotels.com"
                  className="al-input"
                />
              </div>
            </div>

            <button type="submit" disabled={resetLoading} className="al-submit al-submit-blue">
              {resetLoading ? 'Sending...' : '📧 Send Recovery Instructions'}
            </button>
          </form>
        )}

        {/* Back to staff login */}
        <div className="al-back">
          <span>Not an admin?</span>
          <a href="/login" className="al-back-btn">← Staff / Security Login</a>
        </div>

        <div className="al-footer">
          🔒 Protected by Godwin Hospitality Security Protocol ·
          <a href="mailto:mail@godwinhotels.com" className="al-footer-link"> mail@godwinhotels.com</a>
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        .al-wrap {
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          max-width: 100vw;
          background: radial-gradient(ellipse at 60% 0%, #1c1206 0%, #070509 70%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: max(1.25rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1.75rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
          position: relative;
          overflow-x: hidden;
          overflow-y: auto;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-overflow-scrolling: touch;
        }
        .al-glow-top {
          position: absolute; top: -10%; right: -5%;
          width: clamp(260px, 45vw, 550px); height: clamp(260px, 45vw, 550px);
          border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%);
          filter: blur(40px);
          -webkit-filter: blur(40px);
          max-width: 100vw;
        }
        .al-glow-bottom {
          position: absolute; bottom: -10%; left: -5%;
          width: clamp(240px, 35vw, 450px); height: clamp(240px, 35vw, 450px);
          border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 70%);
          filter: blur(40px);
          -webkit-filter: blur(40px);
          max-width: 100vw;
        }
        .al-card {
          width: 100%; max-width: 480px;
          margin: auto;
          background: rgba(10, 8, 3, 0.94);
          backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(245,158,11,0.18);
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(245,158,11,0.08);
          padding: clamp(1.4rem, 4.5vw, 2.4rem);
          position: relative; z-index: 1;
          box-sizing: border-box;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .al-accent-bar {
          position: absolute; top: 0; left: 0; right: 0; height: 4px;
          border-top-left-radius: 24px; border-top-right-radius: 24px;
          background: linear-gradient(90deg, #d97706, #f59e0b, #fbbf24);
        }
        .al-brand {
          display: flex; align-items: center; gap: 0.85rem;
          margin-bottom: 1.35rem; padding-bottom: 1.15rem;
          border-bottom: 1px solid rgba(245,158,11,0.12);
          min-width: 0;
        }
        .al-brand-logo {
          width: 44px; height: 44px; min-width: 44px;
          background: rgba(245,158,11,0.12);
          border-radius: 12px; display: flex; align-items: center;
          justify-content: center; font-size: 1.4rem;
          flex-shrink: 0;
        }
        .al-brand-text {
          min-width: 0;
          overflow: hidden;
        }
        .al-brand-name {
          font-size: 1rem; font-weight: 800; color: #f1f5f9; line-height: 1.25;
          letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .al-brand-sub {
          font-size: 0.72rem; color: #64748b; font-weight: 500; margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .al-header { text-align: center; margin-bottom: 1.35rem; }
        .al-badge {
          display: inline-flex; align-items: center; gap: 0.45rem;
          padding: 0.3rem 0.85rem; border-radius: 20px;
          font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em;
          text-transform: uppercase; margin-bottom: 0.65rem;
          background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.28); color: #fbbf24;
        }
        .al-title {
          font-size: clamp(1.4rem, 4.5vw, 1.85rem); font-weight: 900; color: #fff;
          margin: 0 0 0.35rem 0; letter-spacing: -0.02em; line-height: 1.25;
        }
        .al-subtitle {
          font-size: 0.82rem; color: #64748b; line-height: 1.45; margin: 0;
          word-break: break-word;
        }
        .al-tabs {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;
          background: rgba(0,0,0,0.5); border: 1px solid rgba(245,158,11,0.12);
          border-radius: 12px; padding: 0.3rem; margin-bottom: 1.35rem;
          width: 100%; box-sizing: border-box;
        }
        .al-tab {
          padding: 0.58rem 0.4rem; border-radius: 9px; border: none; background: transparent;
          color: #64748b; font-weight: 700; font-size: 0.78rem; cursor: pointer;
          transition: all 0.2s; min-height: 42px; min-width: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          touch-action: manipulation;
        }
        .al-tab-active { background: rgba(245,158,11,0.18); color: #fbbf24; }
        .al-form { display: flex; flex-direction: column; gap: 1rem; width: 100%; }
        .al-alert {
          padding: 0.85rem 1rem; border-radius: 12px; font-size: 0.82rem;
          font-weight: 600; display: flex; align-items: flex-start; gap: 0.6rem;
          line-height: 1.45; word-break: break-word; overflow-wrap: break-word;
          box-sizing: border-box; width: 100%;
        }
        .al-alert-error { background: rgba(239,68,68,0.14); border-left: 3px solid #ef4444; color: #fca5a5; }
        .al-alert-success { background: rgba(16,185,129,0.14); border-left: 3px solid #10b981; color: #6ee7b7; }
        .al-field { display: flex; flex-direction: column; width: 100%; }
        .al-label { font-size: 0.72rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.45rem; }
        .al-pw-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; gap: 0.5rem; }
        .al-forgot { background: transparent; border: none; color: #fbbf24; cursor: pointer; font-weight: 700; font-size: 0.76rem; text-decoration: underline; padding: 0; touch-action: manipulation; }
        .al-input-wrap {
          display: flex; align-items: center;
          background: rgba(2,3,1,0.8); border: 1px solid rgba(245,158,11,0.22);
          border-radius: 12px; padding: 0 0.85rem;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%; box-sizing: border-box; min-height: 48px;
        }
        .al-input-wrap:focus-within { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.18); }
        .al-icon { font-size: 1rem; color: #64748b; margin-right: 0.65rem; flex-shrink: 0; }
        .al-input {
          width: 100%; background: transparent; border: none; padding: 0.85rem 0;
          color: #fff; font-size: 16px !important; font-weight: 600; outline: none;
          box-sizing: border-box; -webkit-appearance: none; appearance: none;
        }
        .al-input::placeholder { color: #374151; font-weight: 500; }
        
        .al-input:-webkit-autofill,
        .al-input:-webkit-autofill:hover, 
        .al-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0px 1000px #0c0903 inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        .al-eye {
          background: transparent; border: none; color: #64748b; cursor: pointer;
          padding: 0.45rem; font-size: 1.15rem; display: flex; align-items: center; justify-content: center;
          touch-action: manipulation; min-width: 36px; min-height: 36px;
        }
        .al-remember {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.75rem 0.9rem; border-radius: 12px;
          background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.25);
          cursor: pointer; user-select: none; width: 100%; box-sizing: border-box;
          touch-action: manipulation;
        }
        .al-checkbox { width: 19px; height: 19px; cursor: pointer; accent-color: #d97706; flex-shrink: 0; margin: 0; }
        .al-remember-text { flex: 1; min-width: 0; }
        .al-remember-label { color: #fbbf24; cursor: pointer; font-weight: 700; font-size: 0.86rem; display: block; line-height: 1.3; }
        .al-remember-hint { font-size: 0.72rem; color: #94a3b8; display: block; margin-top: 2px; line-height: 1.3; }
        .al-remember-badge {
          font-size: 0.68rem; padding: 3px 8px; border-radius: 99px; font-weight: 800;
          white-space: nowrap; flex-shrink: 0;
          background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .al-submit {
          color: #fff; border: none; border-radius: 12px; padding: 0.95rem 1.25rem;
          font-size: 0.96rem; font-weight: 800; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 0.6rem;
          min-height: 50px; margin-top: 0.25rem; width: 100%; box-sizing: border-box;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 10px 24px -6px rgba(217,119,6,0.45);
          touch-action: manipulation; -webkit-appearance: none;
        }
        .al-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 28px -6px rgba(217,119,6,0.55); }
        .al-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }
        .al-submit-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 10px 24px -6px rgba(37,99,235,0.4); }
        .al-spinner { width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.75s linear infinite; display: inline-block; }
        .al-reset-info { font-size: 0.82rem; color: #94a3b8; line-height: 1.45; margin: 0; word-break: break-word; }
        .al-back {
          margin-top: 1.5rem; padding: 0.85rem 1rem;
          background: rgba(255,255,255,0.025); border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 12px; display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 0.6rem; font-size: 0.8rem; color: #64748b; width: 100%; box-sizing: border-box;
        }
        .al-back-btn {
          font-size: 0.78rem; font-weight: 700; color: #34d399; background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; padding: 0.35rem 0.75rem;
          text-decoration: none; transition: background 0.15s; white-space: nowrap; touch-action: manipulation;
        }
        .al-back-btn:hover { background: rgba(16,185,129,0.2); }
        .al-footer { margin-top: 1.25rem; text-align: center; font-size: 0.72rem; color: #475569; line-height: 1.4; word-break: break-word; }
        .al-footer-link { color: #64748b; text-decoration: none; }
        .al-footer-link:hover { color: #94a3b8; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .al-wrap {
            padding: max(1rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(1.25rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
          }
          .al-card { padding: 1.35rem 1rem; border-radius: 18px; }
          .al-title { font-size: 1.38rem; }
          .al-brand { margin-bottom: 1.15rem; padding-bottom: 1rem; }
          .al-back { flex-direction: column; align-items: flex-start; }
          .al-back-btn { align-self: flex-start; }
        }

        @media (max-width: 360px) {
          .al-card { padding: 1.15rem 0.85rem; border-radius: 16px; }
          .al-tab { font-size: 0.72rem; }
          .al-remember { padding: 0.65rem 0.75rem; }
          .al-remember-badge { display: none; }
        }
      `}</style>
    </div>
  );
}
