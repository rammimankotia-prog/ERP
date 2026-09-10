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
      {/* Subtle ambient lighting */}
      <div className="ambient-light gold-light" />
      <div className="ambient-light blue-light" />

      {/* Main Centered Login Card */}
      <div className="login-card">
        {/* Top Gold Accent Bar */}
        <div className="gold-accent-bar" />

        {/* Brand Header */}
        <div className="card-header">
          <div className="brand-badge">
            <span>👑</span>
            <span>HOTEL GRAND GODWIN &amp; GODWIN DELUXE</span>
          </div>

          <h1 className="card-title">
            {activeTab === 'login' ? 'Executive ERP Login' : 'Password Recovery'}
          </h1>
          <p className="card-subtitle">
            {activeTab === 'login'
              ? 'Please sign in to access your administrative dashboard.'
              : 'Enter your registered email to receive recovery instructions.'}
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

        {/* Login Form */}
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

            {/* Quick Demo Credentials Card with 1-Tap Auto Fill */}
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

        {/* Card Footer: Security Note & Official Link */}
        <div className="card-footer">
          <p className="security-text">
            🔒 Protected by Godwin Security Protocol v3.0.<br />
            For technical assistance, contact: <a href="mailto:mail@godwinhotels.com" className="support-link">mail@godwinhotels.com</a>
          </p>
          <div className="footer-links">
            <a
              href="https://grandgodwin.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="website-link"
            >
              🌐 grandgodwin.com
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-page-wrapper {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 60%, #020617 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 1rem;
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
          width: clamp(300px, 40vw, 550px);
          height: clamp(300px, 40vw, 550px);
          background: radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%);
        }

        .blue-light {
          bottom: -15%;
          left: -5%;
          width: clamp(280px, 35vw, 500px);
          height: clamp(280px, 35vw, 500px);
          background: radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%);
        }

        .login-card {
          width: 100%;
          max-width: 480px;
          background: rgba(15, 23, 42, 0.82);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(245, 158, 11, 0.12);
          padding: clamp(1.75rem, 4vw, 2.5rem);
          position: relative;
          z-index: 1;
          box-sizing: border-box;
        }

        .gold-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #d97706 100%);
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
        }

        .card-header {
          text-align: center;
          margin-bottom: 1.75rem;
        }

        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background: rgba(245, 158, 11, 0.14);
          border: 1px solid rgba(245, 158, 11, 0.28);
          padding: 0.35rem 0.8rem;
          border-radius: 20px;
          color: #fbbf24;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }

        .card-title {
          color: #ffffff;
          font-size: clamp(1.5rem, 3vw, 1.85rem);
          font-weight: 900;
          margin: 0 0 0.4rem 0;
          letter-spacing: -0.02em;
        }

        .card-subtitle {
          color: #94a3b8;
          font-size: 0.85rem;
          margin: 0;
          font-weight: 500;
          line-height: 1.45;
        }

        .tab-switcher {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(0, 0, 0, 0.5);
          padding: 0.3rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
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
          gap: 1.15rem;
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
          font-size: 16px; /* Prevents auto-zoom on iOS Safari */
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
          margin-top: 0.4rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          min-height: 48px;
        }

        .login-submit {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 10px 20px -5px rgba(217, 119, 6, 0.4);
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
          margin-top: 0.35rem;
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

        .card-footer {
          margin-top: 1.75rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
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

        .footer-links {
          display: flex;
          justify-content: center;
        }

        .website-link {
          color: #94a3b8;
          font-size: 0.75rem;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.15s ease;
        }

        .website-link:hover {
          color: #fbbf24;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Mobile Adjustments */
        @media (max-width: 480px) {
          .login-page-wrapper {
            padding: 1rem 0.75rem;
          }

          .login-card {
            padding: 1.5rem 1.15rem;
            border-radius: 20px;
          }

          .brand-badge {
            font-size: 0.65rem;
            padding: 0.3rem 0.65rem;
          }

          .card-title {
            font-size: 1.4rem;
          }
        }
      `}</style>
    </div>
  );
}
