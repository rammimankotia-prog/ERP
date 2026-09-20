'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import OneTapPunchInterface, { EmployeeInfo } from '@/components/OneTapPunchInterface';
import GuardAttendanceSheet from './GuardAttendanceSheet';
import { verifyStaffLocation } from '@/lib/geofence';

export default function KioskPage() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const { user, login, logout } = useAuth();
  const [kioskTab, setKioskTab] = useState<'punch' | 'sheet'>('punch');

  const [kioskGuard, setKioskGuard] = useState<any>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kiosk_employee') || sessionStorage.getItem('kiosk_employee');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.loginRole === 'security' || (parsed.department && parsed.department.toLowerCase().includes('security')))) {
          setKioskGuard(parsed);
        }
      }
    } catch {}
  }, []);

  const isGuardAuthenticated = !!(
    (user &&
      (user.role === 'Security Guard' ||
        user.role === 'Master Admin' ||
        user.role === 'ADMIN' ||
        user.role === 'Manager')) ||
    (kioskGuard &&
      (kioskGuard.loginRole === 'security' ||
        (kioskGuard.department && kioskGuard.department.toLowerCase().includes('security'))))
  );

  const handleGuardLogout = () => {
    try {
      localStorage.removeItem('kiosk_employee');
      localStorage.removeItem('GODWIN_REMEMBER_30DAYS');
      localStorage.removeItem('GODWIN_LOGGED_IN_USER');
      sessionStorage.removeItem('kiosk_employee');
      sessionStorage.removeItem('GODWIN_LOGGED_IN_USER');
      sessionStorage.clear();
      document.cookie = 'kiosk_employee=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      document.cookie = 'GODWIN_LOGGED_IN_USER=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      localStorage.setItem('GODWIN_LOGGED_OUT', 'true');
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('GODWIN_AUTH_BROADCAST_CHANNEL');
        bc.postMessage({ type: 'LOGOUT', timestamp: Date.now().toString() });
        bc.close();
      }
    } catch {}
    setKioskGuard(null);
    logout('/login?mode=security&logout=true');
  };

  const handleLockTerminal = () => {
    try {
      localStorage.removeItem('kiosk_employee');
      localStorage.removeItem('GODWIN_REMEMBER_30DAYS');
      localStorage.removeItem('GODWIN_LOGGED_IN_USER');
      sessionStorage.removeItem('kiosk_employee');
      sessionStorage.removeItem('GODWIN_LOGGED_IN_USER');
      sessionStorage.clear();
      document.cookie = 'kiosk_employee=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      document.cookie = 'GODWIN_LOGGED_IN_USER=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      localStorage.setItem('GODWIN_LOGGED_OUT', 'true');
    } catch {}
    setKioskGuard(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/kiosk';
    }
  };

  const [guardLoginUser, setGuardLoginUser] = useState('');
  const [guardLoginPass, setGuardLoginPass] = useState('');
  const [guardLoginError, setGuardLoginError] = useState('');
  const [guardLoginLoading, setGuardLoginLoading] = useState(false);
  const [guardRememberMe, setGuardRememberMe] = useState(true);
  const [geofence, setGeofence] = useState<{enabled: boolean, lat: number, lng: number, radius: number} | null>(null);

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

  const verifyLocation = async (): Promise<boolean> => {
    if (geofence && !geofence.enabled) {
      return true;
    }
    try {
      await verifyStaffLocation();
      return true;
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Location verification failed';
      setGuardLoginError(`📍 ${msg}`);
      return false;
    }
  };

  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeInfo | null>(null);

  // Manual PIN / Email login fallback toggle
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active employee list with today's real-time punch status
  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/kiosk/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (e) {
      console.error('Failed to load kiosk employees', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const [selectedHotel, setSelectedHotel] = useState('ALL');
  const [sortOption, setSortOption] = useState<'HOTEL' | 'NAME' | 'ID'>('HOTEL');

  // Hotels list (Hotel Grand Godwin & Hotel Godwin Deluxe first)
  const hotels = useMemo(() => {
    const defaultHotels = ['Hotel Grand Godwin', 'Hotel Godwin Deluxe', 'Indian Grill', 'Cafe Brownie'];
    const s = new Set<string>(defaultHotels);
    employees.forEach(e => {
      if (e.branch) s.add(e.branch);
    });
    const priority = (name: string) => {
      const l = (name || '').toLowerCase();
      if (l.includes('grand godwin')) return 1;
      if (l.includes('godwin deluxe')) return 2;
      if (l.includes('indian grill')) return 3;
      if (l.includes('cafe brownie') || l.includes('brownie')) return 4;
      return 10;
    };
    return Array.from(s).sort((a, b) => priority(a) - priority(b));
  }, [employees]);

  // Departments list
  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(e => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts);
  }, [employees]);

  // Filtered and Sorted employees
  const filteredEmployees = useMemo(() => {
    const list = employees.filter(emp => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.firstName.toLowerCase().includes(q) ||
        emp.lastName.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.designation && emp.designation.toLowerCase().includes(q)) ||
        (emp.branch && emp.branch.toLowerCase().includes(q));

      const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;
      const matchesHotel = selectedHotel === 'ALL' || emp.branch === selectedHotel;

      return matchesSearch && matchesDept && matchesHotel;
    });

    const hotelPriority = (bName: string) => {
      const l = (bName || '').toLowerCase();
      if (l.includes('grand godwin')) return 1;
      if (l.includes('godwin deluxe')) return 2;
      if (l.includes('indian grill')) return 3;
      if (l.includes('cafe brownie') || l.includes('brownie')) return 4;
      return 10;
    };

    return list.sort((a, b) => {
      if (sortOption === 'HOTEL') {
        const pA = hotelPriority(a.branch || '');
        const pB = hotelPriority(b.branch || '');
        if (pA !== pB) return pA - pB;
        const bComp = (a.branch || '').localeCompare(b.branch || '');
        if (bComp !== 0) return bComp;
        return (a.employeeId || '').localeCompare(b.employeeId || '');
      } else if (sortOption === 'NAME') {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else {
        return (a.employeeId || '').localeCompare(b.employeeId || '');
      }
    });
  }, [employees, searchQuery, selectedDept, selectedHotel, sortOption]);

  // Handle password / credential login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/kiosk/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Immediately select employee for One-Tap Punch
      const matched = employees.find(
        e => e.id === data.employee.id || e.employeeId === data.employee.employeeId
      ) || data.employee;

      setSelectedEmployee(matched);
      setShowPasswordLogin(false);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGuardAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardLoginError('');
    setGuardLoginLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: guardLoginUser.trim(),
          password: guardLoginPass.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (
        data.user.role !== 'Security Guard' &&
        data.user.role !== 'Master Admin' &&
        data.user.role !== 'Manager' &&
        data.user.role !== 'ADMIN'
      ) {
        throw new Error('Access restricted: Only Security Guard, Manager, or Admin accounts can unlock this Kiosk Terminal.');
      }

      login(data.user, guardRememberMe);
    } catch (err: any) {
      setGuardLoginError(err.message || 'Failed to authenticate guard');
    } finally {
      setGuardLoginLoading(false);
    }
  };

  const getInitials = (first: string, last: string) => {
    return `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}` || 'GH';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: isLight ? '#f8fafc' : '#0f172a',
        color: 'var(--text-main)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ============================================================ */}
      {/* KIOSK HEADER — sticky, compact, mobile-first                 */}
      {/* ============================================================ */}
      <header
        style={{
          width: '100%',
          background: isLight ? '#ffffff' : '#1e293b',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
          padding: '0.5rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          zIndex: 100,
          position: 'sticky',
          top: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {/* Left: Hotel icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              flexShrink: 0,
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              boxShadow: '0 3px 8px rgba(217, 119, 6, 0.3)',
            }}
          >
            🏨
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(0.72rem, 2.4vw, 0.95rem)',
                fontWeight: 900,
                color: isLight ? '#0f172a' : '#f8fafc',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Terminal 1 &ndash; Front Desk
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '0.6rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              Self-Service Attendance Kiosk
            </p>
          </div>
        </div>

        {/* Right: Clock + controls — flex-shrink:0 so they never wrap below title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>

          {/* Live clock */}
          <div style={{ textAlign: 'right', lineHeight: 1.15 }}>
            <div
              style={{
                fontSize: 'clamp(0.82rem, 2.8vw, 1.25rem)',
                fontWeight: 800,
                color: 'var(--primary)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            {/* Hide date on phones (<=480px via className) */}
            <div className="kiosk-hdr-date" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isLight ? 'Dark Mode' : 'Light Mode'}
            style={{
              padding: '0.32rem 0.5rem',
              borderRadius: '7px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
              background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.08)',
              color: isLight ? '#1e293b' : '#f8fafc',
              cursor: 'pointer',
              fontSize: '0.95rem',
              lineHeight: 1,
            }}
          >
            {isLight ? '🌙' : '☀️'}
          </button>

          {/* Guard badge — first name only, hidden on phone */}
          {isGuardAuthenticated && (
            <div
              className="kiosk-hdr-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.28rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '7px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <span style={{ fontSize: '0.8rem' }}>🛡️</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
                {(user?.name || kioskGuard?.firstName || 'Guard').split(' ')[0]}
              </span>
            </div>
          )}

          {/* Lock terminal */}
          {isGuardAuthenticated && (
            <button
              type="button"
              onClick={handleLockTerminal}
              title="Lock terminal screen"
              style={{
                padding: '0.32rem 0.55rem',
                borderRadius: '7px',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🔒<span className="kiosk-hdr-locktext">&nbsp;Lock</span>
            </button>
          )}

          {/* Explicit Log Out button */}
          {isGuardAuthenticated && (
            <button
              type="button"
              onClick={handleGuardLogout}
              title="Log out and return to login portal"
              style={{
                padding: '0.32rem 0.6rem',
                borderRadius: '7px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>🚪</span>
              <span>Log Out</span>
            </button>
          )}

          {/* ERP back link — hidden on mobile */}
          {isGuardAuthenticated && user?.role !== 'Security Guard' && (
            <Link
              href="/hr/attendance"
              className="kiosk-hdr-erplink"
              style={{
                padding: '0.32rem 0.6rem',
                borderRadius: '7px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              ← ERP
            </Link>
          )}
        </div>
      </header>



      {/* ============================================================ */}
      {/* TAB BAR — compact, icon-only on mobile                       */}
      {/* ============================================================ */}
      {isGuardAuthenticated && (
        <div
          style={{
            width: '100%',
            background: isLight ? '#ffffff' : '#1e293b',
            borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
            padding: '0.4rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => { setKioskTab('punch'); setSelectedEmployee(null); }}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '9px',
                border: kioskTab === 'punch' ? '2px solid var(--primary)' : (isLight ? '1px solid #cbd5e1' : '1px solid #475569'),
                background: kioskTab === 'punch' ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                color: kioskTab === 'punch' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>📇</span>
              <span className="kiosk-tab-text">Punch Station</span>
            </button>

            <button
              type="button"
              onClick={() => { setKioskTab('sheet'); setSelectedEmployee(null); }}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '9px',
                border: kioskTab === 'sheet' ? '2px solid #d97706' : (isLight ? '1px solid #cbd5e1' : '1px solid #475569'),
                background: kioskTab === 'sheet' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: kioskTab === 'sheet' ? '#d97706' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>📋</span>
              <span className="kiosk-tab-text">Attendance Sheet</span>
              <span style={{ fontSize: '0.58rem', padding: '1px 4px', borderRadius: '3px', background: '#f59e0b', color: '#fff', fontWeight: 900 }}>MGR</span>
            </button>
          </div>

          <div className="kiosk-tab-hint" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {kioskTab === 'sheet' ? '🔒 Shift Manager' : '⚡ One-Tap'}
          </div>
        </div>
      )}




      {/* Main Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!isGuardAuthenticated ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem' }}>
            <div
              style={{
                maxWidth: '440px',
                width: '100%',
                background: isLight ? '#ffffff' : '#1e293b',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                borderRadius: '20px',
                padding: '2.5rem 2rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  margin: '0 auto 1.25rem auto',
                  boxShadow: '0 8px 18px rgba(217, 119, 6, 0.3)',
                }}
              >
                🛡️
              </div>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Security Guard Station
              </h2>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Gate Kiosk is locked. Please sign in with on-duty Security Guard or Admin credentials to activate attendance punch terminal.
              </p>

              {guardLoginError && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '1rem',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    textAlign: 'left',
                  }}
                >
                  ⚠️ {guardLoginError}
                </div>
              )}

              <form onSubmit={handleGuardAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', textAlign: 'left' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Guard Email / Login ID
                  </label>
                  <input
                    type="text"
                    required
                    value={guardLoginUser}
                    onChange={e => setGuardLoginUser(e.target.value)}
                    placeholder="guard@godwinhotels.com"
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Guard Password
                  </label>
                  <input
                    type="password"
                    required
                    value={guardLoginPass}
                    onChange={e => setGuardLoginPass(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  <input
                    type="checkbox"
                    id="remGuardKiosk"
                    checked={guardRememberMe}
                    onChange={e => setGuardRememberMe(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="remGuardKiosk" style={{ color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>
                    Remember session for 30 days
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={guardLoginLoading}
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    height: '46px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: guardLoginLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  }}
                >
                  {guardLoginLoading ? 'Unlocking Kiosk...' : '🔓 Unlock Gate Kiosk'}
                </button>
                <div style={{ marginTop: '0.85rem', textAlign: 'center' }}>
                  <Link
                    href="/login"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <span>←</span> <span>Return to Staff Login / Punch Portal</span>
                  </Link>
                </div>
              </form>
            </div>
          </div>
        ) : kioskTab === 'sheet' ? (
          /* ========================================================================= */
          /* STAGE 3: SHIFT MANAGER ATTENDANCE SHEET (TILL TODAY ONLY)                */
          /* ========================================================================= */
          <div
            className="page-container"
            style={{
              maxWidth: '1400px',
              width: '100%',
              paddingTop: '1.5rem',
              paddingBottom: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
          >
            <GuardAttendanceSheet
              isLight={isLight}
              onPunchEmployee={(empId) => {
                const emp = employees.find(e => e.id === empId || e.employeeId === empId);
                if (emp) {
                  setSelectedEmployee(emp);
                  setKioskTab('punch');
                }
              }}
            />
          </div>
        ) : selectedEmployee ? (
          /* ========================================================================= */
          /* STAGE 2: PUNCH-IN / PUNCH-OUT INTERFACE (ONE-TAP ACTION)                 */
          /* ========================================================================= */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <OneTapPunchInterface
              employee={selectedEmployee}
              mode="KIOSK"
              showLeaveAndHistory={false}
              onBack={() => {
                setSelectedEmployee(null);
                fetchEmployees();
              }}
              onSuccess={() => {
                fetchEmployees();
              }}
            />
          </div>
        ) : (
          /* ========================================================================= */
          /* STAGE 1: EMPLOYEE IDENTIFICATION (INSTANT SEARCH & 1-TAP CARDS)          */
          /* ========================================================================= */
          <div
            className="page-container"
            style={{
              maxWidth: '1200px',
              paddingTop: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
          >
            {/* Hero Welcome Banner */}
            <div
              style={{
                background: isLight ? '#ffffff' : '#1e293b',
                borderRadius: '14px',
                padding: 'clamp(0.85rem, 2.5vw, 1.5rem)',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                boxShadow: 'var(--shadow)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    margin: '0 0 0.2rem 0',
                    fontSize: 'clamp(0.95rem, 3.5vw, 1.5rem)',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    lineHeight: 1.2,
                  }}
                >
                  👋 Tap Your Name to Clock In/Out
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'clamp(0.75rem, 2vw, 0.88rem)' }}>
                  One-Tap <strong>Check-In / Check-Out</strong>. System shows your next action.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '9px',
                  border: '1px solid var(--border)',
                  background: showPasswordLogin ? 'var(--primary)' : 'var(--bg-main)',
                  color: showPasswordLogin ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {showPasswordLogin ? '✕ Close' : '🔑 Password Login'}
              </button>
            </div>

            {/* Optional Password Login Box */}
            {showPasswordLogin && (
              <div
                style={{
                  background: isLight ? '#ffffff' : '#1e293b',
                  borderRadius: '16px',
                  padding: '1.75rem',
                  border: '2px solid var(--primary)',
                  boxShadow: 'var(--shadow-lg)',
                  maxWidth: '480px',
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 800 }}>
                  Employee Password Verification
                </h3>

                {loginError && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--error)',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      marginBottom: '1rem',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    ⚠️ {loginError}
                  </div>
                )}

                <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. raman@godwinhotels.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem' }}
                  >
                    {loginLoading ? 'Verifying...' : 'Identify & Continue'}
                  </button>
                </form>
              </div>
            )}

            {/* Search and Sort Control Bar */}
            <div
              className="kiosk-search-sort-bar"
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: '1 1 280px', minWidth: 0, position: 'relative', width: '100%' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '1.25rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Type employee name, ID or hotel (e.g. GG-1001, Raman, Godwin)..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    height: '48px',
                    paddingLeft: '48px',
                    paddingRight: '48px',
                    borderRadius: '12px',
                    border: isLight ? '2px solid #cbd5e1' : '2px solid #334155',
                    backgroundColor: isLight ? '#ffffff' : '#1e293b',
                    color: 'var(--text-main)',
                    fontSize: '0.98rem',
                    fontWeight: 500,
                    outline: 'none',
                    boxShadow: 'var(--shadow)',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort By Selector */}
              <div className="kiosk-sort-container" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Sort by:</span>
                <select
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value as any)}
                  style={{
                    height: '48px',
                    boxSizing: 'border-box',
                    padding: '0 12px',
                    borderRadius: '12px',
                    border: isLight ? '2px solid #cbd5e1' : '2px solid #334155',
                    backgroundColor: isLight ? '#ffffff' : '#1e293b',
                    color: 'var(--primary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="HOTEL">🏨 Hotel (Grand Godwin & Godwin Deluxe)</option>
                  <option value="NAME">👤 Employee Name (A-Z)</option>
                  <option value="ID">🔢 Staff ID (Ascending)</option>
                </select>
              </div>
            </div>

            {/* Hotel / Property Filter Pills */}
            <div
              className="kiosk-horizontal-scroll"
              style={{
                display: 'flex',
                gap: '0.4rem',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: '4px',
                scrollbarWidth: 'none',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '0.2rem', flexShrink: 0 }}>HOTEL:</span>
              <button
                type="button"
                onClick={() => setSelectedHotel('ALL')}
                style={{
                  flexShrink: 0,
                  padding: '0.42rem 0.85rem',
                  borderRadius: '99px',
                  border: selectedHotel === 'ALL' ? '2px solid #f59e0b' : (isLight ? '1px solid #cbd5e1' : '1px solid #334155'),
                  background: selectedHotel === 'ALL' ? 'rgba(245, 158, 11, 0.15)' : (isLight ? '#ffffff' : '#1e293b'),
                  color: selectedHotel === 'ALL' ? '#d97706' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🏨 All Hotels</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({employees.length})</span>
              </button>
              {hotels.map(h => {
                const count = employees.filter(e => e.branch === h).length;
                const active = selectedHotel === h;
                const isGrand = h.toLowerCase().includes('grand godwin');
                const isDeluxe = h.toLowerCase().includes('deluxe');
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHotel(h)}
                    style={{
                      flexShrink: 0,
                      padding: '0.42rem 0.85rem',
                      borderRadius: '99px',
                      border: active
                        ? isDeluxe ? '2px solid #6366f1' : isGrand ? '2px solid #d97706' : '2px solid var(--primary)'
                        : (isLight ? '1px solid #cbd5e1' : '1px solid #334155'),
                      background: active
                        ? isDeluxe ? 'rgba(99, 102, 241, 0.15)' : isGrand ? 'rgba(217, 119, 6, 0.15)' : 'rgba(37, 99, 235, 0.12)'
                        : (isLight ? '#ffffff' : '#1e293b'),
                      color: active
                        ? isDeluxe ? '#6366f1' : isGrand ? '#d97706' : 'var(--primary)'
                        : 'var(--text-main)',
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>🏨 {h}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Department filter chips */}
            <div
              className="kiosk-horizontal-scroll"
              style={{
                display: 'flex',
                gap: '0.35rem',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: '4px',
                scrollbarWidth: 'none',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.2rem', flexShrink: 0 }}>DEPT:</span>
              <button
                type="button"
                onClick={() => setSelectedDept('ALL')}
                style={{
                  flexShrink: 0,
                  padding: '0.35rem 0.8rem',
                  borderRadius: '99px',
                  border: selectedDept === 'ALL' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: selectedDept === 'ALL' ? 'rgba(37, 99, 235, 0.12)' : (isLight ? '#ffffff' : '#1e293b'),
                  color: selectedDept === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  whiteSpace: 'nowrap',
                }}
              >
                All
              </button>
              {departments.map(dept => {
                const count = employees.filter(e => e.department === dept).length;
                const active = selectedDept === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    style={{
                      flexShrink: 0,
                      padding: '0.35rem 0.8rem',
                      borderRadius: '99px',
                      border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: active ? 'rgba(37, 99, 235, 0.12)' : (isLight ? '#ffffff' : '#1e293b'),
                      color: active ? 'var(--primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {dept} ({count})
                  </button>
                );
              })}
            </div>

            {/* Employee Cards Grid (1-Tap to Identify) */}
            {loading ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                <p>Loading active employee directory...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div
                style={{
                  padding: '4rem 2rem',
                  textAlign: 'center',
                  background: isLight ? '#ffffff' : '#1e293b',
                  borderRadius: '16px',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No staff members found</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  No match for "{searchQuery}". Try searching by first name, last name, or staff ID.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
                  gap: 'clamp(0.5rem, 2vw, 1rem)',
                }}
              >
                {filteredEmployees.map(emp => {
                  const onShift = emp.checkedIn && !emp.checkedOut;
                  const shiftDone = emp.checkedIn && emp.checkedOut;
                  const isDeluxe = (emp.branch || '').toLowerCase().includes('deluxe') || (emp.employeeId || '').startsWith('GD-');
                  const isGrand = (emp.branch || '').toLowerCase().includes('grand godwin') || (emp.employeeId || '').startsWith('GG-') || (!isDeluxe && !emp.branch?.toLowerCase().includes('grill') && !emp.branch?.toLowerCase().includes('brownie'));

                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className="employee-kiosk-card"
                      style={{
                        background: isLight ? '#ffffff' : '#1e293b',
                        border: onShift
                          ? '2px solid rgba(16, 185, 129, 0.6)'
                          : isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        boxShadow: onShift
                          ? '0 4px 15px rgba(16, 185, 129, 0.15)'
                          : 'var(--shadow)',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      {/* Avatar / Photo */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {emp.photo ? (
                          <img
                            src={emp.photo}
                            alt={`${emp.firstName} ${emp.lastName}`}
                            style={{
                              width: '52px',
                              height: '52px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: onShift ? '2px solid #10b981' : '2px solid var(--border)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '52px',
                              height: '52px',
                              borderRadius: '50%',
                              background: onShift
                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '1.15rem',
                            }}
                          >
                            {getInitials(emp.firstName, emp.lastName)}
                          </div>
                        )}

                        {/* Status dot */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            backgroundColor: onShift ? '#10b981' : shiftDone ? '#64748b' : '#94a3b8',
                            border: `2px solid ${isLight ? '#ffffff' : '#1e293b'}`,
                          }}
                        />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: 'var(--text-main)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {emp.firstName} {emp.lastName}
                        </div>

                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {emp.department} • {emp.designation}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                            marginTop: '0.35rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: isDeluxe
                                ? 'rgba(99, 102, 241, 0.12)'
                                : isGrand
                                ? 'rgba(217, 119, 6, 0.12)'
                                : 'rgba(16, 185, 129, 0.12)',
                              color: isDeluxe
                                ? '#6366f1'
                                : isGrand
                                ? '#d97706'
                                : '#059669',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🏨 {isGrand ? 'Grand Godwin' : isDeluxe ? 'Godwin Deluxe' : emp.branch || 'Grand Godwin'}
                          </span>

                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: 'var(--text-muted)',
                              background: isLight ? '#f1f5f9' : '#0f172a',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {emp.employeeId}
                          </span>

                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: onShift ? '#10b981' : shiftDone ? '#64748b' : '#3b82f6',
                            }}
                          >
                            {onShift ? '🟢 On Shift' : shiftDone ? '🔴 Completed' : '⚪ Ready'}
                          </span>
                        </div>
                      </div>

                      {/* Tap Arrow */}
                      <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', opacity: 0.6 }}>
                        →
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        /* ===== KIOSK — MOBILE RESPONSIVE ===== */
        .kiosk-horizontal-scroll::-webkit-scrollbar { display: none; }
        .employee-kiosk-card { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .employee-kiosk-card:hover {
          transform: translateY(-2px) scale(1.015);
          border-color: var(--primary) !important;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.18) !important;
        }
        .employee-kiosk-card:active { transform: scale(0.97); }

        /* Tablet <= 768px */
        @media (max-width: 768px) {
          .kiosk-hdr-erplink { display: none !important; }
        }

        /* Mobile <= 640px */
        @media (max-width: 640px) {
          .kiosk-search-sort-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.5rem !important;
          }
          .kiosk-sort-container {
            width: 100% !important;
            display: flex !important;
          }
          .kiosk-sort-container select {
            width: 100% !important;
            flex: 1 !important;
          }
          .kiosk-tab-hint { display: none !important; }
        }

        /* Phone portrait <= 480px */
        @media (max-width: 480px) {
          .kiosk-hdr-date { display: none !important; }
          .kiosk-hdr-badge { display: none !important; }
          .kiosk-hdr-locktext { display: none !important; }
          .employee-kiosk-card {
            padding: 0.85rem 1rem !important;
            gap: 0.75rem !important;
            border-radius: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
