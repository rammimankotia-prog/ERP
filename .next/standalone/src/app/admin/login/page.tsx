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
          <div className="al-deactivated-banner">
            <span className="al-deactivated-icon">🚫</span>
            <div>
              <div className="al-deactivated-title">
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
    </div>
  );
}
