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

  useEffect(() => {
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
        login(data.user);
        if (!rememberMe) {
          sessionStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(data.user));
        }
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
          <div>
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

            <div className="al-remember">
              <input
                type="checkbox"
                id="remAdmin"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="al-checkbox"
              />
              <label htmlFor="remAdmin" className="al-remember-label">
                Remember session for 30 days
              </label>
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
        * { box-sizing: border-box; }
        .al-wrap {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(ellipse at 60% 0%, #1c1206 0%, #070509 70%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 1rem;
          position: relative;
          overflow: hidden;
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        }
        .al-glow-top {
          position: absolute; top: -15%; right: -10%;
          width: clamp(300px, 50vw, 600px); height: clamp(300px, 50vw, 600px);
          border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(245,158,11,0.11) 0%, transparent 70%);
        }
        .al-glow-bottom {
          position: absolute; bottom: -15%; left: -10%;
          width: clamp(250px, 40vw, 480px); height: clamp(250px, 40vw, 480px);
          border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%);
        }
        .al-card {
          width: 100%; max-width: 480px;
          background: rgba(10, 8, 3, 0.93);
          backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(245,158,11,0.15);
          border-radius: 24px;
          box-shadow: 0 30px 60px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(245,158,11,0.07);
          padding: clamp(1.5rem, 5vw, 2.4rem);
          position: relative; z-index: 1;
        }
        .al-accent-bar {
          position: absolute; top: 0; left: 0; right: 0; height: 4px;
          border-top-left-radius: 24px; border-top-right-radius: 24px;
          background: linear-gradient(90deg, #d97706, #f59e0b, #fbbf24);
        }
        .al-brand {
          display: flex; align-items: center; gap: 0.85rem;
          margin-bottom: 1.5rem; padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(245,158,11,0.12);
        }
        .al-brand-logo {
          width: 44px; height: 44px; min-width: 44px;
          background: rgba(245,158,11,0.12);
          border-radius: 12px; display: flex; align-items: center;
          justify-content: center; font-size: 1.4rem;
        }
        .al-brand-name { font-size: 1rem; font-weight: 800; color: #f1f5f9; line-height: 1.2; }
        .al-brand-sub { font-size: 0.7rem; color: #64748b; font-weight: 500; margin-top: 2px; }
        .al-header { text-align: center; margin-bottom: 1.4rem; }
        .al-badge {
          display: inline-flex; align-items: center; gap: 0.45rem;
          padding: 0.3rem 0.85rem; border-radius: 20px;
          font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em;
          text-transform: uppercase; margin-bottom: 0.75rem;
          background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.28); color: #fbbf24;
        }
        .al-title { font-size: clamp(1.45rem,5vw,1.85rem); font-weight: 900; color: #fff; margin: 0 0 0.4rem 0; letter-spacing: -0.02em; }
        .al-subtitle { font-size: 0.83rem; color: #64748b; line-height: 1.5; margin: 0; }
        .al-tabs {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;
          background: rgba(0,0,0,0.5); border: 1px solid rgba(245,158,11,0.1);
          border-radius: 12px; padding: 0.3rem; margin-bottom: 1.5rem;
        }
        .al-tab {
          padding: 0.58rem 0.4rem; border-radius: 9px; border: none; background: transparent;
          color: #64748b; font-weight: 700; font-size: 0.78rem; cursor: pointer;
          transition: all 0.2s; min-height: 40px;
        }
        .al-tab-active { background: rgba(245,158,11,0.18); color: #fbbf24; }
        .al-form { display: flex; flex-direction: column; gap: 1.1rem; }
        .al-alert {
          padding: 0.85rem 1rem; border-radius: 10px; font-size: 0.82rem;
          font-weight: 600; display: flex; align-items: flex-start; gap: 0.55rem; line-height: 1.4;
        }
        .al-alert-error { background: rgba(239,68,68,0.14); border-left: 3px solid #ef4444; color: #fca5a5; }
        .al-alert-success { background: rgba(16,185,129,0.14); border-left: 3px solid #10b981; color: #6ee7b7; }
        .al-field { display: flex; flex-direction: column; }
        .al-label { font-size: 0.72rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.45rem; }
        .al-pw-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; }
        .al-forgot { background: transparent; border: none; color: #fbbf24; cursor: pointer; font-weight: 700; font-size: 0.76rem; text-decoration: underline; padding: 0; }
        .al-input-wrap {
          display: flex; align-items: center;
          background: rgba(2,3,1,0.8); border: 1px solid rgba(245,158,11,0.2);
          border-radius: 12px; padding: 0 0.9rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .al-input-wrap:focus-within { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.18); }
        .al-icon { font-size: 1rem; color: #475569; margin-right: 0.65rem; flex-shrink: 0; }
        .al-input { width: 100%; background: transparent; border: none; padding: 0.88rem 0; color: #fff; font-size: 16px; font-weight: 600; outline: none; }
        .al-input::placeholder { color: #2d3748; font-weight: 500; }
        .al-eye { background: transparent; border: none; color: #475569; cursor: pointer; padding: 0.35rem; font-size: 1.1rem; display: flex; align-items: center; }
        .al-remember { display: flex; align-items: center; gap: 0.6rem; font-size: 0.82rem; }
        .al-checkbox { width: 17px; height: 17px; cursor: pointer; accent-color: #d97706; flex-shrink: 0; }
        .al-remember-label { color: #94a3b8; cursor: pointer; font-weight: 600; }
        .al-submit {
          color: #fff; border: none; border-radius: 12px; padding: 1rem 1.25rem;
          font-size: 0.96rem; font-weight: 800; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 0.6rem;
          min-height: 52px; margin-top: 0.25rem; width: 100%;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 10px 24px -6px rgba(217,119,6,0.45);
        }
        .al-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 28px -6px rgba(217,119,6,0.55); }
        .al-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }
        .al-submit-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 10px 24px -6px rgba(37,99,235,0.4); }
        .al-spinner { width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.75s linear infinite; display: inline-block; }
        .al-reset-info { font-size: 0.83rem; color: #64748b; line-height: 1.5; margin: 0; }
        .al-back { margin-top: 1.75rem; padding: 0.9rem 1rem; background: rgba(255,255,255,0.025); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem; font-size: 0.8rem; color: #475569; }
        .al-back-btn { font-size: 0.78rem; font-weight: 700; color: #34d399; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; padding: 0.35rem 0.85rem; text-decoration: none; transition: background 0.15s; white-space: nowrap; }
        .al-back-btn:hover { background: rgba(16,185,129,0.2); }
        .al-footer { margin-top: 1.25rem; text-align: center; font-size: 0.7rem; color: #2d3748; }
        .al-footer-link { color: #374151; text-decoration: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .al-card { border-radius: 20px; }
          .al-title { font-size: 1.4rem; }
          .al-back { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
