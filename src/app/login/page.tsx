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
          sessionStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(data.user));
        }
        router.push('/');
      } else {
        setErrorMsg(data.error || 'Invalid credentials. Please verify username and password.');
      }
    } catch {
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
    } catch {
      setResetError('Server communication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickFillCredentials = () => {
    setUsername('Godwinhotels');
    setPassword('Godwindeluxe@99');
    setErrorMsg('');
  };

  return (
    <div className="login-page-wrapper">
      {/* Subtle decorative gold ambient light */}
      <div className="ambient-light gold-light" />
      <div className="ambient-light blue-light" />

      {/* Main Login Portal Card Container */}
      <div className="login-card-container">
        {/* Top Gold Accent Line */}
        <div className="gold-accent-bar" />

        {/* Left Column: Brand & Luxury Hotel Showcase */}
        <div className="brand-column">
          <div>
            {/* Header Badge */}
            <div className="brand-badge">
              <span>👑</span>
              <span>HOTEL GRAND GODWIN &amp; GODWIN DELUXE</span>
            </div>

            <h1 className="brand-title">
              Enterprise ERP Terminal
            </h1>

            <p className="brand-subtitle">
              New Delhi&apos;s premier luxury hospitality destination. Centralized executive control for reservations, dynamic room inventory, HR operations, and tour management.
            </p>

            {/* Feature Highlights Grid - Optimized for Desktop & Tablet */}
            <div className="feature-highlights-list">
              <div className="feature-item">
                <div className="feature-icon icon-gold">🏨</div>
                <div>
                  <h4 className="feature-title">Live Inventory &amp; Reservations</h4>
                  <p className="feature-desc">Real-time rate management across all room categories</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon icon-blue">🌍</div>
                <div>
                  <h4 className="feature-title">Tour Packages &amp; Quotations</h4>
                  <p className="feature-desc">End-to-end B2B agent itinerary pricing and ledger tracking</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon icon-green">⚡</div>
                <div>
                  <h4 className="feature-title">1-Tap Staff Punch &amp; HR</h4>
                  <p className="feature-desc">Real-time kiosk punch-in/out, biometric sync &amp; payroll</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Official Link & Info */}
          <div className="brand-footer">
            <div className="address-text">
              📍 8502/41, Arakshan Road, Pahar Ganj, New Delhi
            </div>
            <a
              href="https://grandgodwin.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="website-link"
            >
              <span>🌐</span> Official Website ➔
            </a>
          </div>
        </div>

        {/* Right Column: Secure Login & Password Recovery Form */}
        <div className="form-column">
          <div className="form-header">
            <h2 className="form-title">
              {activeTab === 'login' ? 'Welcome Back, Executive' : 'Credential Recovery'}
            </h2>
            <p className="form-subtitle">
              {activeTab === 'login'
                ? 'Please sign in to access your hotel management dashboard.'
                : 'Verify your administrative email to receive recovery instructions.'}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="tab-switcher">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
              className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            >
              <span>🔐</span> Secure Sign In
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('reset'); setResetError(''); setResetSuccess(''); }}
              className={`tab-btn ${activeTab === 'reset' ? 'active' : ''}`}
            >
              <span>❓</span> Reset Password
            </button>
          </div>

          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="auth-form">
              {errorMsg && (
                <div className="alert-box error-alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">
                  Username or Email Address
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Godwinhotels"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="input-group">
                <div className="password-header">
                  <label className="input-label" style={{ margin: 0 }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reset')}
                    className="forgot-link"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="input-wrapper">
                  <span className="input-icon">🔑</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="toggle-password-btn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="remember-row">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="remember-checkbox"
                />
                <label htmlFor="remember" className="remember-label">
                  Remember executive session for 30 days
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="submit-btn login-submit"
              >
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner" />
                    Authenticating Credentials...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Access Executive Dashboard ➔
                  </>
                )}
              </button>

              {/* Quick Credentials Card with 1-Tap Auto Fill */}
              <div className="demo-credentials-card">
                <div className="demo-card-header">
                  <span className="demo-badge">🔒 Root Admin Access</span>
                  <button
                    type="button"
                    onClick={quickFillCredentials}
                    className="auto-fill-btn"
                  >
                    ⚡ Auto-Fill Credentials
                  </button>
                </div>
                <div className="demo-card-body">
                  <span>User: <strong className="mono-text">Godwinhotels</strong></span>
                  <span className="divider">|</span>
                  <span>Pass: <strong className="mono-text">Godwindeluxe@99</strong></span>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit} className="auth-form">
              {resetError && (
                <div className="alert-box error-alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{resetError}</span>
                </div>
              )}
              {resetSuccess && (
                <div className="alert-box success-alert">
                  <span className="alert-icon">✅</span>
                  <span>{resetSuccess}</span>
                </div>
              )}

              <p className="reset-helper-text">
                Enter your registered administrative contact (<strong style={{ color: '#fbbf24' }}>mail@godwinhotels.com</strong>). An automated verification email with temporary login token will be generated.
              </p>

              <div className="input-group">
                <label className="input-label">
                  Admin / Registered Email Address
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">✉️</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="mail@godwinhotels.com"
                    className="form-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="submit-btn reset-submit"
              >
                {isSubmitting ? 'Processing Request...' : '📧 Send Recovery Instructions'}
              </button>
            </form>
          )}

          {/* Bottom Security Audit Notice */}
          <div className="security-notice">
            <p className="security-text">
              🔒 Protected by Godwin Security Protocol v3.0. All access attempts are logged.<br />
              For technical assistance, contact: <a href="mailto:mail@godwinhotels.com" className="support-link">mail@godwinhotels.com</a>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-page-wrapper {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(circle at 20% 20%, #1e293b 0%, #0f172a 60%, #020617 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.25rem;
          position: relative;
          overflow-x: hidden;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
        }

        .ambient-light {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .gold-light {
          top: -10%;
          right: -5%;
          width: clamp(350px, 45vw, 650px);
          height: clamp(350px, 45vw, 650px);
          background: radial-gradient(circle, rgba(245, 158, 11, 0.09) 0%, transparent 70%);
        }

        .blue-light {
          bottom: -15%;
          left: -5%;
          width: clamp(320px, 40vw, 600px);
          height: clamp(320px, 40vw, 600px);
          background: radial-gradient(circle, rgba(59, 130, 246, 0.07) 0%, transparent 70%);
        }

        .login-card-container {
          width: 100%;
          max-width: 1120px;
          background: rgba(15, 23, 42, 0.78);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 26px;
          box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(245, 158, 11, 0.15);
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        .gold-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #d97706 100%);
          z-index: 10;
        }

        /* Brand Column */
        .brand-column {
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.92) 100%);
          padding: clamp(2rem, 3.5vw, 3.5rem) clamp(1.5rem, 3vw, 3rem);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          position: relative;
        }

        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 0.4rem 0.85rem;
          border-radius: 20px;
          color: #fbbf24;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .brand-title {
          color: #ffffff;
          font-size: clamp(1.65rem, 3.2vw, 2.35rem);
          font-weight: 900;
          margin: 0 0 0.75rem 0;
          letter-spacing: -0.03em;
          line-height: 1.18;
        }

        .brand-subtitle {
          color: #94a3b8;
          font-size: clamp(0.9rem, 1.2vw, 1.02rem);
          line-height: 1.6;
          margin: 0 0 2rem 0;
          font-weight: 500;
        }

        .feature-highlights-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          background: rgba(2, 6, 23, 0.5);
          padding: 0.85rem 1.1rem;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          flex-shrink: 0;
        }

        .icon-gold {
          background: rgba(245, 158, 11, 0.15);
        }

        .icon-blue {
          background: rgba(59, 130, 246, 0.15);
        }

        .icon-green {
          background: rgba(16, 185, 129, 0.15);
        }

        .feature-title {
          color: #ffffff;
          margin: 0;
          font-size: 0.9rem;
          font-weight: 800;
        }

        .feature-desc {
          color: #64748b;
          margin: 0.15rem 0 0 0;
          font-size: 0.78rem;
          line-height: 1.4;
        }

        .brand-footer {
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .address-text {
          font-size: 0.78rem;
          color: #64748b;
          line-height: 1.4;
        }

        .website-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: #fbbf24;
          font-size: 0.82rem;
          font-weight: 700;
          text-decoration: none;
          padding: 0.4rem 0.8rem;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(245, 158, 11, 0.2);
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .website-link:hover {
          background: rgba(245, 158, 11, 0.2);
          transform: translateY(-1px);
        }

        /* Form Column */
        .form-column {
          padding: clamp(2rem, 3.5vw, 3.5rem) clamp(1.5rem, 3vw, 3rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .form-header {
          margin-bottom: 1.75rem;
        }

        .form-title {
          color: #ffffff;
          font-size: clamp(1.4rem, 2.5vw, 1.75rem);
          font-weight: 900;
          margin: 0 0 0.4rem 0;
          letter-spacing: -0.02em;
        }

        .form-subtitle {
          color: #94a3b8;
          font-size: 0.88rem;
          margin: 0;
          font-weight: 500;
          line-height: 1.5;
        }

        .tab-switcher {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(0, 0, 0, 0.5);
          padding: 0.3rem;
          border-radius: 12px;
          margin-bottom: 1.75rem;
          border: 1px solid rgba(255, 255, 255, 0.06);
          gap: 0.25rem;
        }

        .tab-btn {
          padding: 0.65rem 0.5rem;
          border-radius: 9px;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 800;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 40px;
        }

        .tab-btn.active {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .alert-box {
          padding: 0.85rem 1rem;
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .error-alert {
          background: rgba(239, 68, 68, 0.15);
          border-left: 4px solid #ef4444;
          color: #fca5a5;
        }

        .success-alert {
          background: rgba(16, 185, 129, 0.15);
          border-left: 4px solid #10b981;
          color: #6ee7b7;
        }

        .alert-icon {
          font-size: 1.15rem;
          flex-shrink: 0;
        }

        .input-group {
          display: flex;
          flex-direction: column;
        }

        .input-label {
          display: block;
          color: #cbd5e1;
          font-size: 0.78rem;
          font-weight: 800;
          margin-bottom: 0.45rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          background: rgba(2, 6, 23, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 0 0.9rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .input-wrapper:focus-within {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
        }

        .input-icon {
          color: #64748b;
          font-size: 1.1rem;
          margin-right: 0.6rem;
          flex-shrink: 0;
        }

        .form-input {
          width: 100%;
          background: transparent;
          border: none;
          padding: 0.85rem 0;
          color: #ffffff;
          font-size: 16px; /* Prevents auto-zoom on iOS */
          outline: none;
          font-weight: 600;
        }

        .form-input::placeholder {
          color: #475569;
          font-weight: 500;
        }

        .password-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.45rem;
        }

        .forgot-link {
          background: transparent;
          border: none;
          color: #fbbf24;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.78rem;
          text-decoration: underline;
          padding: 0;
        }

        .toggle-password-btn {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0.35rem;
          font-size: 1.15rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remember-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.82rem;
          margin-top: 0.1rem;
        }

        .remember-checkbox {
          accent-color: #d97706;
          width: 17px;
          height: 17px;
          cursor: pointer;
          border-radius: 4px;
        }

        .remember-label {
          color: #cbd5e1;
          cursor: pointer;
          font-weight: 600;
        }

        .submit-btn {
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 0.95rem 1.25rem;
          font-size: 1rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          min-height: 48px;
          box-shadow: 0 10px 20px -5px rgba(217, 119, 6, 0.4);
        }

        .login-submit {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .login-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #fbbf24 0%, #b45309 100%);
          transform: translateY(-1px);
          box-shadow: 0 12px 24px -5px rgba(217, 119, 6, 0.55);
        }

        .reset-submit {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
        }

        .reset-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%);
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .btn-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid white;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }

        /* Demo credentials card */
        .demo-credentials-card {
          margin-top: 0.5rem;
          padding: 0.85rem 1rem;
          background: rgba(2, 6, 23, 0.55);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.78rem;
          color: #94a3b8;
        }

        .demo-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-bottom: 0.4rem;
        }

        .demo-badge {
          color: #fbbf24;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .auto-fill-btn {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: #fbbf24;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .auto-fill-btn:hover {
          background: rgba(245, 158, 11, 0.28);
        }

        .demo-card-body {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .mono-text {
          color: #ffffff;
          font-family: monospace;
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 5px;
          border-radius: 4px;
        }

        .divider {
          color: #475569;
        }

        .reset-helper-text {
          color: #94a3b8;
          font-size: 0.85rem;
          line-height: 1.5;
          margin: 0;
        }

        .security-notice {
          margin-top: 2rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
        }

        .security-text {
          color: #64748b;
          font-size: 0.72rem;
          margin: 0;
          line-height: 1.5;
        }

        .support-link {
          color: #fbbf24;
          text-decoration: none;
          font-weight: 700;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Responsive Breakpoints */
        @media (max-width: 960px) {
          .login-card-container {
            grid-template-columns: 1fr;
            border-radius: 22px;
            max-width: 560px;
          }

          .brand-column {
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }

          .feature-highlights-list {
            display: none; /* Hide heavy marketing cards on mobile/tablet so form is reachable immediately */
          }

          .brand-subtitle {
            margin-bottom: 1rem;
          }
        }

        @media (max-width: 640px) {
          .login-page-wrapper {
            padding: 1rem 0.6rem;
            align-items: flex-start;
          }

          .login-card-container {
            border-radius: 18px;
            margin: 0.5rem 0;
          }

          .brand-column {
            padding: 1.5rem 1.15rem;
          }

          .form-column {
            padding: 1.5rem 1.15rem;
          }

          .brand-badge {
            font-size: 0.68rem;
            padding: 0.35rem 0.7rem;
            margin-bottom: 1rem;
          }

          .brand-title {
            font-size: 1.5rem;
          }

          .brand-footer {
            display: none; /* Compact header on mobile */
          }
        }
      `}</style>
    </div>
  );
}
