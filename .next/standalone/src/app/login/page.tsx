'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { verifyStaffLocation } from '@/lib/geofence';
import './login.css';

type LoginMode = 'staff' | 'security';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [mode, setMode] = useState<LoginMode>('staff');
  const [rememberMe, setRememberMe] = useState(true);
  const [geofence, setGeofence] = useState<{enabled: boolean, lat: number, lng: number, radius: number} | null>({
    enabled: true,
    lat: 28.64574210,
    lng: 77.21535140,
    radius: 80,
  });

  useEffect(() => {
    fetch('/api/settings/global')
      .then(res => res.json())
      .then(data => {
        if (data.geofence) {
          setGeofence({
            enabled: data.geofence.enabled !== undefined ? data.geofence.enabled : true,
            lat: data.geofence.lat || 28.64574210,
            lng: data.geofence.lng || 77.21535140,
            radius: typeof data.geofence.radius === 'number' ? data.geofence.radius : 80,
          });
        }
      })
      .catch(console.error);
  }, []);

  const verifyLocation = async (identifier?: string): Promise<boolean> => {
    if (geofence && !geofence.enabled) {
      return true;
    }
    const cleanId = (identifier || '').toLowerCase().trim();
    if (cleanId.includes('sec') || cleanId.includes('guard') || cleanId.includes('security') || mode === 'security') {
      return true;
    }
    try {
      await verifyStaffLocation(identifier);
      return true;
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Location verification failed';
      setStaffError(`📍 ${msg}`);
      return false;
    }
  };

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
  const [deactivatedAlert, setDeactivatedAlert] = useState(false);
  const [logoutAlert, setLogoutAlert] = useState(false);

  // Redirect ?mode=admin links to the proper admin portal; default to Staff Login
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('deactivated') === 'true') {
        setDeactivatedAlert(true);
      }
      if (params.get('logout') === 'true') {
        setLogoutAlert(true);
      }
      const m = params.get('mode') || params.get('type') || params.get('role') || params.get('tab');
      if (m === 'admin' || m === 'manager') {
        router.replace('/admin/login');
      } else if (m === 'security' || m === 'guard') {
        setMode('security');
      } else {
        setMode('staff');
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = mode === 'security' ? 'Security Login | Godwin Hotels' : 'Staff Login | Godwin Hotels';
    }
  }, [mode]);

  // Auto-restore 30-day remembered session on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('deactivated') === 'true') {
      try {
        localStorage.removeItem('kiosk_employee');
        localStorage.removeItem('GODWIN_REMEMBER_30DAYS');
        localStorage.removeItem('GODWIN_LOGGED_IN_USER');
        sessionStorage.removeItem('kiosk_employee');
        document.cookie = 'kiosk_employee=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'GODWIN_LOGGED_IN_USER=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      } catch {}
      return;
    }
    if (params.get('logout') === 'true' || params.get('reauth') === 'true') {
      return;
    }

    try {
      const savedStr = localStorage.getItem('kiosk_employee');
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (saved && saved.id) {
          const isExpired = saved.expiresAt && saved.expiresAt < Date.now();
          if (!isExpired) {
            if (saved.loginRole === 'security') {
              router.replace('/kiosk');
            } else {
              router.replace('/kiosk/dashboard');
            }
          } else {
            localStorage.removeItem('kiosk_employee');
            localStorage.removeItem('GODWIN_REMEMBER_30DAYS');
          }
        }
      }
    } catch {}
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
        // Save employee session with 30-day duration if ticked
        const expiresAt = rememberMe
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
          : Date.now() + 12 * 60 * 60 * 1000;

        const payload = JSON.stringify({
          ...data.employee,
          loginRole: 'staff',
          remember30Days: !!rememberMe,
          expiresAt,
        });

        if (rememberMe) {
          localStorage.setItem('kiosk_employee', payload);
          try {
            document.cookie = `kiosk_employee=${encodeURIComponent(payload)}; path=/; max-age=2592000; SameSite=Lax`;
          } catch {}
          localStorage.setItem('GODWIN_REMEMBER_30DAYS', 'true');
          localStorage.removeItem('GODWIN_LOGGED_OUT');
        } else {
          sessionStorage.setItem('kiosk_employee', payload);
          localStorage.removeItem('kiosk_employee');
          localStorage.removeItem('GODWIN_REMEMBER_30DAYS');
        }
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
        const role = (data.employee.role || '').toLowerCase();
        const isGuard =
          designation.includes('guard') ||
          designation.includes('security') ||
          dept.includes('security') ||
          role.includes('admin') ||
          role.includes('manager') ||
          designation.includes('admin') ||
          designation.includes('manager') ||
          data.employee.loginRole === 'security';
        if (!isGuard) {
          setSecError('Access denied. This login is only for Security Guard or Management staff.');
          setSecLoading(false);
          return;
        }
        // Save security session and redirect to full kiosk with 30-day duration if ticked
        const expiresAt = rememberMe
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
          : Date.now() + 12 * 60 * 60 * 1000;

        const payload = JSON.stringify({
          ...data.employee,
          loginRole: 'security',
          remember30Days: !!rememberMe,
          expiresAt,
        });

        if (rememberMe) {
          localStorage.setItem('kiosk_employee', payload);
          try {
            document.cookie = `kiosk_employee=${encodeURIComponent(payload)}; path=/; max-age=2592000; SameSite=Lax`;
          } catch {}
          localStorage.setItem('GODWIN_REMEMBER_30DAYS', 'true');
          localStorage.removeItem('GODWIN_LOGGED_OUT');
        } else {
          sessionStorage.setItem('kiosk_employee', payload);
          localStorage.removeItem('kiosk_employee');
          localStorage.removeItem('GODWIN_REMEMBER_30DAYS');
        }

        const guardUser = {
          id: data.employee.id || data.employee.employeeId,
          username: data.employee.email || data.employee.employeeId,
          name: `${data.employee.firstName} ${data.employee.lastName}`.trim(),
          email: data.employee.email || '',
          role: 'Security Guard',
          status: 'Active',
        };
        login(guardUser, rememberMe);

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
    <div
      className="lp-wrap"
      style={{
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100vw',
        background: 'radial-gradient(ellipse at 50% 0%, #0f1e2e 0%, #070d14 70%)',
        color: '#f8fafc',
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Ambient glows */}
      <div className={`lp-glow lp-glow-top ${mode === 'security' ? 'glow-blue' : 'glow-green'}`} />
      <div className="lp-glow lp-glow-bottom" />

      <div className="lp-card">
        {/* Top accent bar */}
        <div className={`lp-accent-bar ${mode === 'security' ? 'bar-blue' : 'bar-green'}`} />

        {/* Hotel brand */}
        <div className="lp-brand">
          <div className="lp-brand-logo">🏨</div>
          <div className="lp-brand-text">
            <div className="lp-brand-name">Hotel Grand Godwin</div>
            <div className="lp-brand-sub">Godwin Deluxe · Indian Grill · Cafe Brownie</div>
          </div>
        </div>

        {/* Deactivated Notice Banner */}
        {deactivatedAlert && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 14,
            padding: '1rem 1.15rem',
            marginBottom: '1.25rem',
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
                Your account has been deactivated. You have been automatically logged out from all platforms, devices, and punch kiosks. Please contact hotel administration.
              </div>
            </div>
          </div>
        )}

        {/* Successful Logout Notice Banner */}
        {logoutAlert && !deactivatedAlert && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 14,
            padding: '0.85rem 1.15rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#10b981',
            fontSize: '0.88rem',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.12)'
          }}>
            <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>✅</span>
            <span>You have been successfully signed out.</span>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="lp-mode-switcher">
          <button
            type="button"
            onClick={() => switchMode('staff')}
            className={`lp-mode-btn ${mode === 'staff' ? 'mode-active-green' : ''}`}
          >
            <span className="lp-mode-icon">👤</span>
            <div className="lp-mode-text">
              <span className="lp-mode-title">Staff login</span>
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
              <span className="lp-mode-title">Security login</span>
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
              <h1 className="lp-title">Staff login</h1>
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

              <div
                className="lp-remember-box lp-remember-staff"
                onClick={() => setRememberMe(v => !v)}
              >
                <input
                  type="checkbox"
                  id="remStaff"
                  checked={rememberMe}
                  onChange={e => {
                    e.stopPropagation();
                    setRememberMe(e.target.checked);
                  }}
                  className="lp-checkbox"
                />
                <div className="lp-remember-text">
                  <label
                    htmlFor="remStaff"
                    onClick={e => e.stopPropagation()}
                    className="lp-remember-label"
                  >
                    Remember session for 30 days
                  </label>
                  <span className="lp-remember-hint">
                    Keep me signed in on this device (No need to re-login every day)
                  </span>
                </div>
                {rememberMe && (
                  <span className="lp-remember-badge badge-green-pill">
                    ✓ 30 Days
                  </span>
                )}
              </div>

              {/* Geo-fencing notice */}
              <div className="lp-geo-notice">
                <span>📍</span>
                <span>Location verification (geo-fencing) will confirm you are within hotel premises when punching attendance.</span>
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
              <h1 className="lp-title">Security login</h1>
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

              <div
                className="lp-remember-box lp-remember-sec"
                onClick={() => setRememberMe(v => !v)}
              >
                <input
                  type="checkbox"
                  id="remSec"
                  checked={rememberMe}
                  onChange={e => {
                    e.stopPropagation();
                    setRememberMe(e.target.checked);
                  }}
                  className="lp-checkbox lp-checkbox-blue"
                />
                <div className="lp-remember-text">
                  <label
                    htmlFor="remSec"
                    onClick={e => e.stopPropagation()}
                    className="lp-remember-label"
                  >
                    Remember session for 30 days
                  </label>
                  <span className="lp-remember-hint">
                    Keep guard terminal session active on this device
                  </span>
                </div>
                {rememberMe && (
                  <span className="lp-remember-badge badge-blue-pill">
                    ✓ 30 Days
                  </span>
                )}
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
    </div>
  );
}
