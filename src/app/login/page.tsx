'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

type LoginMode = 'staff' | 'security';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [mode, setMode] = useState<LoginMode>('staff');

  // Staff Login
  const [staffId, setStaffId] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPwd, setShowStaffPwd] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  // Security Login
  const [secId, setSecId] = useState('');
  const [secPassword, setSecPassword] = useState('');
  const [showSecPwd, setShowSecPwd] = useState(false);
  const [secError, setSecError] = useState('');
  const [secLoading, setSecLoading] = useState(false);

  // Redirect ?mode=admin links to the proper admin portal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode') || params.get('type') || params.get('role') || params.get('tab');
      if (m === 'admin' || m === 'manager') {
        router.replace('/admin/login');
      }
    }
  }, [router]);



  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');
    setStaffLoading(true);
    try {
      const res = await fetch('/api/kiosk/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: staffId.trim(), password: staffPassword.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.employee) {
        // Save employee session
        localStorage.setItem('kiosk_employee', JSON.stringify({ ...data.employee, loginRole: 'staff' }));
        router.push('/kiosk/dashboard');
      } else {
        setStaffError(data.error || 'Invalid Staff ID or Password. Please try again.');
      }
    } catch {
      setStaffError('Unable to connect. Please check your network.');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleSecurityLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecError('');
    setSecLoading(true);
    try {
      const res = await fetch('/api/kiosk/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: secId.trim(), password: secPassword.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.employee) {
        // Check if they are a security guard
        const designation = (data.employee.designation || '').toLowerCase();
        const dept = (data.employee.department || '').toLowerCase();
        const isGuard = designation.includes('guard') || designation.includes('security') || dept.includes('security');
        if (!isGuard) {
          setSecError('Access denied. This login is only for Security Guard staff.');
          setSecLoading(false);
          return;
        }
        // Save security session and redirect to full kiosk
        localStorage.setItem('kiosk_employee', JSON.stringify({ ...data.employee, loginRole: 'security' }));
        router.push('/kiosk');
      } else {
        setSecError(data.error || 'Invalid Guard ID or Password. Please try again.');
      }
    } catch {
      setSecError('Unable to connect. Please check your network.');
    } finally {
      setSecLoading(false);
    }
  };

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setStaffError('');
    setSecError('');
  };

  return (
    <div className="lp-wrap">
      {/* Ambient glows */}
      <div className={`lp-glow lp-glow-top ${mode === 'security' ? 'glow-blue' : 'glow-green'}`} />
      <div className="lp-glow lp-glow-bottom" />

      <div className="lp-card">
        {/* Top accent bar */}
        <div className={`lp-accent-bar ${mode === 'security' ? 'bar-blue' : 'bar-green'}`} />

        {/* Hotel brand */}
        <div className="lp-brand">
          <div className="lp-brand-logo">🏨</div>
          <div>
            <div className="lp-brand-name">Hotel Grand Godwin</div>
            <div className="lp-brand-sub">Godwin Deluxe · Indian Grill · Cafe Brownie</div>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="lp-mode-switcher">
          <button
            type="button"
            onClick={() => switchMode('staff')}
            className={`lp-mode-btn ${mode === 'staff' ? 'mode-active-green' : ''}`}
          >
            <span className="lp-mode-icon">👤</span>
            <div className="lp-mode-text">
              <span className="lp-mode-title">Staff Login</span>
              <span className="lp-mode-hint">Punch In / Out your attendance</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => switchMode('security')}
            className={`lp-mode-btn ${mode === 'security' ? 'mode-active-blue' : ''}`}
          >
            <span className="lp-mode-icon">🛡️</span>
            <div className="lp-mode-text">
              <span className="lp-mode-title">Security Login</span>
              <span className="lp-mode-hint">Manage employee attendance</span>
            </div>
          </button>
        </div>

        {/* ===== STAFF LOGIN ===== */}
        {mode === 'staff' && (
          <div className="lp-section">
            <div className="lp-section-header">
              <div className="lp-badge badge-green">
                <span>⚡</span>
                <span>STAFF ATTENDANCE PORTAL</span>
              </div>
              <h1 className="lp-title">Staff Login</h1>
              <p className="lp-subtitle">
                Login with your Staff ID and password to punch in or out.
                Your location will be verified via geo-fencing.
              </p>
            </div>

            <form onSubmit={handleStaffLogin} className="lp-form">
              {staffError && (
                <div className="lp-alert lp-alert-error">
                  <span>⚠️</span>
                  <span>{staffError}</span>
                </div>
              )}

              <div className="lp-field">
                <label className="lp-label">Staff ID or Email</label>
                <div className="lp-input-wrap lp-focus-green">
                  <span className="lp-input-icon">🆔</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={staffId}
                    onChange={e => setStaffId(e.target.value)}
                    placeholder="e.g. GG-1001 or staff@godwinhotels.com"
                    className="lp-input"
                  />
                </div>
              </div>

              <div className="lp-field">
                <label className="lp-label">Password</label>
                <div className="lp-input-wrap lp-focus-green">
                  <span className="lp-input-icon">🔑</span>
                  <input
                    type={showStaffPwd ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={staffPassword}
                    onChange={e => setStaffPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="lp-input"
                  />
                  <button
                    type="button"
                    className="lp-eye-btn"
                    onClick={() => setShowStaffPwd(v => !v)}
                    aria-label="Toggle password"
                  >
                    {showStaffPwd ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Geo-fencing notice */}
              <div className="lp-geo-notice">
                <span>📍</span>
                <span>Location verification (geo-fencing) will activate upon login to confirm you are on-premises.</span>
              </div>

              <button
                type="submit"
                disabled={staffLoading}
                className="lp-submit-btn btn-green"
              >
                {staffLoading ? (
                  <><span className="lp-spinner" /> Verifying...</>
                ) : (
                  <><span>⚡</span> Login &amp; Punch Attendance</>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ===== SECURITY LOGIN ===== */}
        {mode === 'security' && (
          <div className="lp-section">
            <div className="lp-section-header">
              <div className="lp-badge badge-blue">
                <span>🛡️</span>
                <span>SECURITY GUARD PORTAL</span>
              </div>
              <h1 className="lp-title">Security Login</h1>
              <p className="lp-subtitle">
                Login with your Security Guard credentials to access the full kiosk terminal and manage employee check-ins.
              </p>
            </div>

            <form onSubmit={handleSecurityLogin} className="lp-form">
              {secError && (
                <div className="lp-alert lp-alert-error">
                  <span>⚠️</span>
                  <span>{secError}</span>
                </div>
              )}

              <div className="lp-field">
                <label className="lp-label">Guard ID or Email</label>
                <div className="lp-input-wrap lp-focus-blue">
                  <span className="lp-input-icon">🛡️</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={secId}
                    onChange={e => setSecId(e.target.value)}
                    placeholder="e.g. GG-1002 or guard@godwinhotels.com"
                    className="lp-input"
                  />
                </div>
              </div>

              <div className="lp-field">
                <label className="lp-label">Password</label>
                <div className="lp-input-wrap lp-focus-blue">
                  <span className="lp-input-icon">🔑</span>
                  <input
                    type={showSecPwd ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={secPassword}
                    onChange={e => setSecPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="lp-input"
                  />
                  <button
                    type="button"
                    className="lp-eye-btn"
                    onClick={() => setShowSecPwd(v => !v)}
                    aria-label="Toggle password"
                  >
                    {showSecPwd ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Kiosk access info */}
              <div className="lp-kiosk-notice">
                <div className="lp-kiosk-notice-row">
                  <span>🖥️</span>
                  <span>Full kiosk terminal access — view all employees and manage punch in/out on their behalf.</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={secLoading}
                className="lp-submit-btn btn-blue"
              >
                {secLoading ? (
                  <><span className="lp-spinner" /> Verifying...</>
                ) : (
                  <><span>🛡️</span> Login &amp; Open Kiosk Terminal</>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Admin shortcut */}
        <div className="lp-admin-link">
          <span>Are you an Admin or Manager?</span>
          <a href="/admin/login" className="lp-admin-btn">
            Admin Portal →
          </a>
        </div>

        {/* Footer */}
        <div className="lp-footer">
          🔒 Secured by Godwin Hospitality Security Protocol · 
          <a href="mailto:mail@godwinhotels.com" className="lp-footer-link"> mail@godwinhotels.com</a>
        </div>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }

        .lp-wrap {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(ellipse at 50% 0%, #0f1e2e 0%, #070d14 70%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 1rem;
          position: relative;
          overflow: hidden;
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        }

        .lp-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          transition: background 0.5s ease;
        }
        .lp-glow-top {
          top: -15%;
          right: -10%;
          width: clamp(350px, 50vw, 650px);
          height: clamp(350px, 50vw, 650px);
        }
        .glow-green { background: radial-gradient(circle, rgba(16,185,129,0.13) 0%, transparent 70%); }
        .glow-blue  { background: radial-gradient(circle, rgba(59,130,246,0.13) 0%, transparent 70%); }
        .lp-glow-bottom {
          bottom: -15%;
          left: -10%;
          width: clamp(280px, 40vw, 500px);
          height: clamp(280px, 40vw, 500px);
          background: radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%);
        }

        .lp-card {
          width: 100%;
          max-width: 500px;
          background: rgba(10, 18, 30, 0.92);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 24px;
          box-shadow: 0 30px 60px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04);
          padding: clamp(1.6rem, 4vw, 2.4rem);
          position: relative;
          z-index: 1;
        }

        .lp-accent-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          transition: background 0.35s ease;
        }
        .bar-green { background: linear-gradient(90deg, #059669, #10b981, #06b6d4); }
        .bar-blue  { background: linear-gradient(90deg, #2563eb, #3b82f6, #6366f1); }

        /* Brand */
        .lp-brand {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .lp-brand-logo {
          width: 46px;
          height: 46px;
          background: rgba(255,255,255,0.07);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        .lp-brand-name {
          font-size: 1rem;
          font-weight: 800;
          color: #f1f5f9;
          line-height: 1.2;
        }
        .lp-brand-sub {
          font-size: 0.7rem;
          color: #64748b;
          font-weight: 500;
          margin-top: 2px;
        }

        /* Mode Switcher */
        .lp-mode-switcher {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 0.4rem;
          margin-bottom: 1.75rem;
        }
        .lp-mode-btn {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 0.65rem;
          border-radius: 11px;
          border: 1px solid transparent;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          text-align: left;
          transition: all 0.22s ease;
          min-height: 60px;
        }
        .lp-mode-btn:hover:not(.mode-active-green):not(.mode-active-blue) {
          background: rgba(255,255,255,0.04);
          color: #94a3b8;
        }
        .lp-mode-icon {
          font-size: 1.4rem;
          flex-shrink: 0;
        }
        .lp-mode-text {
          display: flex;
          flex-direction: column;
        }
        .lp-mode-title {
          font-size: 0.84rem;
          font-weight: 800;
          line-height: 1.2;
        }
        .lp-mode-hint {
          font-size: 0.65rem;
          font-weight: 500;
          color: #475569;
          line-height: 1.3;
          margin-top: 2px;
        }
        .mode-active-green {
          background: rgba(16,185,129,0.15);
          border-color: rgba(16,185,129,0.35);
          color: #34d399;
          box-shadow: 0 4px 14px rgba(16,185,129,0.15);
        }
        .mode-active-green .lp-mode-hint { color: #6ee7b7; opacity: 0.85; }
        .mode-active-blue {
          background: rgba(59,130,246,0.15);
          border-color: rgba(59,130,246,0.35);
          color: #60a5fa;
          box-shadow: 0 4px 14px rgba(59,130,246,0.15);
        }
        .mode-active-blue .lp-mode-hint { color: #bfdbfe; opacity: 0.85; }

        /* Section */
        .lp-section {
          animation: fadeIn 0.25s ease;
        }
        .lp-section-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.3rem 0.85rem;
          border-radius: 20px;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 0.75rem;
        }
        .badge-green {
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.28);
          color: #34d399;
        }
        .badge-blue {
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.28);
          color: #60a5fa;
        }
        .lp-title {
          font-size: clamp(1.5rem, 3.5vw, 1.85rem);
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 0.4rem 0;
          letter-spacing: -0.02em;
        }
        .lp-subtitle {
          font-size: 0.83rem;
          color: #64748b;
          line-height: 1.5;
          margin: 0;
        }

        /* Form */
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }
        .lp-alert {
          padding: 0.85rem 1rem;
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 600;
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          line-height: 1.4;
        }
        .lp-alert-error {
          background: rgba(239,68,68,0.14);
          border-left: 3px solid #ef4444;
          color: #fca5a5;
        }
        .lp-field {
          display: flex;
          flex-direction: column;
        }
        .lp-label {
          font-size: 0.72rem;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.45rem;
        }
        .lp-input-wrap {
          display: flex;
          align-items: center;
          background: rgba(2,6,23,0.7);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 0 0.9rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .lp-focus-green:focus-within {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.18);
        }
        .lp-focus-blue:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
        }
        .lp-input-icon {
          font-size: 1rem;
          color: #475569;
          margin-right: 0.65rem;
          flex-shrink: 0;
        }
        .lp-input {
          width: 100%;
          background: transparent;
          border: none;
          padding: 0.88rem 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          outline: none;
        }
        .lp-input::placeholder { color: #334155; font-weight: 500; }
        .lp-eye-btn {
          background: transparent;
          border: none;
          color: #475569;
          cursor: pointer;
          padding: 0.35rem;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
        }

        /* Notices */
        .lp-geo-notice {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          padding: 0.75rem 0.9rem;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 10px;
          font-size: 0.78rem;
          color: #6ee7b7;
          line-height: 1.4;
        }
        .lp-kiosk-notice {
          padding: 0.75rem 0.9rem;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 10px;
        }
        .lp-kiosk-notice-row {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          font-size: 0.78rem;
          color: #93c5fd;
          line-height: 1.4;
        }

        /* Submit Button */
        .lp-submit-btn {
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          font-size: 0.96rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          min-height: 50px;
          margin-top: 0.25rem;
        }
        .btn-green {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 10px 24px -6px rgba(16,185,129,0.45);
        }
        .btn-green:hover:not(:disabled) {
          background: linear-gradient(135deg, #34d399 0%, #047857 100%);
          transform: translateY(-1px);
          box-shadow: 0 14px 28px -6px rgba(16,185,129,0.55);
        }
        .btn-blue {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          box-shadow: 0 10px 24px -6px rgba(59,130,246,0.45);
        }
        .btn-blue:hover:not(:disabled) {
          background: linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%);
          transform: translateY(-1px);
          box-shadow: 0 14px 28px -6px rgba(59,130,246,0.55);
        }
        .lp-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }
        .lp-spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
          display: inline-block;
        }

        /* Admin link */
        .lp-admin-link {
          margin-top: 1.75rem;
          padding: 0.9rem 1rem;
          background: rgba(255,255,255,0.025);
          border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.6rem;
          font-size: 0.8rem;
          color: #64748b;
        }
        .lp-admin-btn {
          font-size: 0.78rem;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.28);
          border-radius: 8px;
          padding: 0.3rem 0.75rem;
          text-decoration: none;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .lp-admin-btn:hover { background: rgba(245,158,11,0.2); }

        /* Footer */
        .lp-footer {
          margin-top: 1.25rem;
          text-align: center;
          font-size: 0.7rem;
          color: #334155;
        }
        .lp-footer-link {
          color: #475569;
          text-decoration: none;
        }
        .lp-footer-link:hover { color: #64748b; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .lp-card { padding: 1.4rem 1.1rem; border-radius: 18px; }
          .lp-mode-title { font-size: 0.78rem; }
          .lp-mode-hint { font-size: 0.62rem; }
          .lp-title { font-size: 1.45rem; }
          .lp-admin-link { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
