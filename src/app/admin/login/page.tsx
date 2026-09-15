'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import './admin-login.css';

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
    <div
      className="al-wrap"
      style={{
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100vw',
        background: 'radial-gradient(ellipse at 60% 0%, #1c1206 0%, #070509 70%)',
        color: '#f8fafc',
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
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

      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .al-wrap {
          min-height: 100vh; min-height: 100dvh; width: 100%; max-width: 100vw;
          background: radial-gradient(ellipse at 60% 0%, #1c1206 0%, #070509 70%) !important;
          display: flex; align-items: center; justify-content: center;
          padding: max(1.25rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1.75rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
          position: relative; overflow-x: hidden; overflow-y: auto;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #f8fafc;
        }
        .al-card {
          width: 100%; max-width: 480px; margin: auto;
          background: rgba(10, 8, 3, 0.94);
          backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(245,158,11,0.18); border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85);
          padding: clamp(1.4rem, 4.5vw, 2.4rem); position: relative; z-index: 1;
        }
        .al-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 4px; border-top-left-radius: 24px; border-top-right-radius: 24px; background: linear-gradient(90deg, #d97706, #f59e0b, #fbbf24); }
        .al-brand { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1.35rem; padding-bottom: 1.15rem; border-bottom: 1px solid rgba(245,158,11,0.12); }
        .al-brand-name { font-size: 1rem; font-weight: 800; color: #f1f5f9; line-height: 1.25; }
        .al-brand-sub { font-size: 0.72rem; color: #64748b; font-weight: 500; }
        .al-header { text-align: center; margin-bottom: 1.35rem; }
        .al-badge { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.3rem 0.85rem; border-radius: 20px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.65rem; background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.28); color: #fbbf24; }
        .al-title { font-size: clamp(1.4rem, 4.5vw, 1.85rem); font-weight: 900; color: #fff; margin: 0 0 0.35rem 0; }
        .al-subtitle { font-size: 0.82rem; color: #64748b; line-height: 1.45; }
        .al-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(245,158,11,0.12); border-radius: 12px; padding: 0.3rem; margin-bottom: 1.35rem; }
        .al-tab { padding: 0.58rem 0.4rem; border-radius: 9px; border: none; background: transparent; color: #64748b; font-weight: 700; font-size: 0.78rem; cursor: pointer; }
        .al-tab-active { background: rgba(245,158,11,0.18); color: #fbbf24; }
        .al-form { display: flex; flex-direction: column; gap: 1rem; }
        .al-label { font-size: 0.72rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.45rem; }
        .al-input-wrap { display: flex; align-items: center; background: rgba(2,3,1,0.8); border: 1px solid rgba(245,158,11,0.22); border-radius: 12px; padding: 0 0.85rem; min-height: 48px; width: 100%; }
        .al-input { width: 100%; background: transparent; border: none; padding: 0.85rem 0; color: #fff; font-size: 16px; outline: none; }
        .al-remember { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0.9rem; border-radius: 12px; background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.25); color: #fbbf24; }
        .al-submit { color: #fff; border: none; border-radius: 12px; padding: 0.95rem 1.25rem; font-size: 0.96rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.6rem; min-height: 50px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); width: 100%; }
      `}} />
    </div>
  );
}
