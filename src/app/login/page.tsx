'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import './login.css';

type LoginMode = 'staff' | 'security';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [mode, setMode] = useState<LoginMode>('staff');
  const [rememberMe, setRememberMe] = useState(true);
  const [geofence, setGeofence] = useState<{enabled: boolean, lat: number, lng: number, radius: number} | null>({
    enabled: true,
    lat: 28.6475,
    lng: 77.21699,
    radius: 50,
  });

  useEffect(() => {
    fetch('/api/settings/global')
      .then(res => res.json())
      .then(data => {
        if (data.geofence) {
          setGeofence({
            enabled: data.geofence.enabled !== undefined ? data.geofence.enabled : true,
            lat: data.geofence.lat || 28.6475,
            lng: data.geofence.lng || 77.21699,
            radius: typeof data.geofence.radius === 'number' ? data.geofence.radius : 50,
          });
        }
      })
      .catch(console.error);
  }, []);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const verifyLocation = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!geofence || !geofence.enabled) {
        return resolve(true);
      }
      
      if (!navigator.geolocation) {
        const err = '📍 Geolocation is not supported by your browser. Please use a device with GPS support.';
        setStaffError(err);
        setSecError(err);
        return resolve(false);
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const distance = getDistance(position.coords.latitude, position.coords.longitude, geofence.lat, geofence.lng);
          const allowedRadius = typeof geofence.radius === 'number' ? geofence.radius : 50;
          if (distance <= allowedRadius) {
            resolve(true);
          } else {
            const err = `📍 Access Denied: You are ${Math.round(distance)}m away from hotel premises. Access is strictly restricted within ${allowedRadius}m in premises.`;
            setStaffError(err);
            setSecError(err);
            resolve(false);
          }
        },
        (error) => {
          let err = '📍 Device GPS is OFF or Location Permission Needed! Please turn ON GPS / Location on your device to log in within 50m of hotel premises.';
          if (error.code === 1) { // PERMISSION_DENIED
            err = '📍 Location Permission Denied: Please allow location access in your browser settings so we can verify you are within 50m of hotel premises.';
          } else if (error.code === 2) { // POSITION_UNAVAILABLE
            err = '📍 Device GPS is OFF: Please turn ON GPS / Location in your device settings to verify you are on hotel premises.';
          } else if (error.code === 3) { // TIMEOUT
            err = '📍 GPS Signal Timeout: Could not detect your location. Please ensure device GPS is turned ON and retry.';
          }
          setStaffError(err);
          setSecError(err);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
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

  // Redirect ?mode=admin links to the proper admin portal; default to Staff Login
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('deactivated') === 'true') {
        setDeactivatedAlert(true);
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
    
    const isLocationValid = await verifyLocation();
    if (!isLocationValid) {
      setStaffLoading(false);
      return;
    }

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

    const isLocationValid = await verifyLocation();
    if (!isLocationValid) {
      setSecLoading(false);
      return;
    }

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

      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .lp-wrap {
          min-height: 100vh; min-height: 100dvh; width: 100%; max-width: 100vw;
          background: radial-gradient(ellipse at 50% 0%, #0f1e2e 0%, #070d14 70%) !important;
          display: flex; align-items: center; justify-content: center;
          padding: max(1.25rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1.75rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
          position: relative; overflow-x: hidden; overflow-y: auto;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #f8fafc;
        }
        .lp-card {
          width: 100%; max-width: 490px; margin: auto;
          background: rgba(10, 18, 30, 0.94);
          backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85);
          padding: clamp(1.4rem, 4.5vw, 2.4rem); position: relative; z-index: 1;
        }
        .lp-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 4px; border-top-left-radius: 24px; border-top-right-radius: 24px; }
        .bar-green { background: linear-gradient(90deg, #059669, #10b981, #06b6d4); }
        .bar-blue { background: linear-gradient(90deg, #2563eb, #3b82f6, #6366f1); }
        .lp-brand { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1.35rem; padding-bottom: 1.15rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .lp-brand-name { font-size: 1rem; font-weight: 800; color: #f1f5f9; line-height: 1.25; }
        .lp-brand-sub { font-size: 0.72rem; color: #64748b; font-weight: 500; }
        .lp-mode-switcher { display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 0.35rem; margin-bottom: 1.5rem; }
        .lp-mode-btn { display: flex; align-items: center; gap: 0.55rem; padding: 0.7rem 0.6rem; border-radius: 10px; border: 1px solid transparent; background: transparent; color: #64748b; cursor: pointer; min-height: 54px; }
        .mode-active-green { background: rgba(16,185,129,0.14); border-color: rgba(16,185,129,0.35); color: #34d399; }
        .mode-active-blue { background: rgba(59,130,246,0.14); border-color: rgba(59,130,246,0.35); color: #60a5fa; }
        .lp-section-header { text-align: center; margin-bottom: 1.35rem; }
        .lp-badge { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.3rem 0.85rem; border-radius: 20px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.65rem; }
        .badge-green { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.28); color: #34d399; }
        .badge-blue { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.28); color: #60a5fa; }
        .lp-title { font-size: clamp(1.4rem, 4.5vw, 1.85rem); font-weight: 900; color: #ffffff; margin: 0 0 0.35rem 0; }
        .lp-subtitle { font-size: 0.82rem; color: #64748b; line-height: 1.45; }
        .lp-form { display: flex; flex-direction: column; gap: 1rem; width: 100%; }
        .lp-field { display: flex; flex-direction: column; width: 100%; }
        .lp-label { font-size: 0.72rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.45rem; }
        .lp-input-wrap { display: flex; align-items: center; background: rgba(2,6,23,0.75); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 0 0.85rem; min-height: 48px; width: 100%; }
        .lp-input-icon { font-size: 1rem; color: #64748b; margin-right: 0.65rem; flex-shrink: 0; }
        .lp-input { width: 100%; background: transparent; border: none; padding: 0.85rem 0; color: #ffffff; font-size: 16px; outline: none; }
        .lp-remember-box { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0.9rem; border-radius: 12px; background: rgba(16, 185, 129, 0.07); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; }
        .lp-submit-btn { color: #fff; border: none; border-radius: 12px; padding: 0.95rem 1.25rem; font-size: 0.96rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.6rem; min-height: 50px; width: 100%; }
        .btn-green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .btn-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
      `}} />
    </div>
  );
}
