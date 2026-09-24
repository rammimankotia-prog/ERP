'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import OneTapPunchInterface, { EmployeeInfo } from '@/components/OneTapPunchInterface';
import { verifyStaffLocation } from '@/lib/geofence';

export default function KioskPage() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const { user, login, logout } = useAuth();

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

  const handleGuardAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardLoginError('');
    setGuardLoginLoading(true);

    try {
      let authUser: any = null;

      // 1. Try /api/kiosk/auth first (accepts aliases like sec, security, guard, etc.)
      try {
        const resKiosk = await fetch('/api/kiosk/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: guardLoginUser.trim(),
            password: guardLoginPass.trim(),
          }),
        });
        if (resKiosk.ok) {
          const dKiosk = await resKiosk.json();
          if (dKiosk.success && dKiosk.employee) {
            authUser = {
              id: dKiosk.employee.id,
              employeeId: dKiosk.employee.employeeId,
              username: dKiosk.employee.email || dKiosk.employee.employeeId,
              name: `${dKiosk.employee.firstName || ''} ${dKiosk.employee.lastName || ''}`.trim() || 'Security Guard',
              email: dKiosk.employee.email,
              role: dKiosk.employee.role || 'Security Guard',
              department: dKiosk.employee.department,
              designation: dKiosk.employee.designation,
            };
            const payload = JSON.stringify({
              ...dKiosk.employee,
              loginRole: 'security',
              expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            });
            localStorage.setItem('kiosk_employee', payload);
            sessionStorage.setItem('kiosk_employee', payload);
            setKioskGuard(dKiosk.employee);
          }
        }
      } catch {}

      // 2. If not authenticated via kiosk/auth, try /api/auth/login
      if (!authUser) {
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
        authUser = data.user;
      }

      if (
        authUser.role !== 'Security Guard' &&
        authUser.role !== 'Master Admin' &&
        authUser.role !== 'Manager' &&
        authUser.role !== 'ADMIN'
      ) {
        throw new Error('Access restricted: Only Security Guard, Manager, or Admin accounts can unlock this Kiosk Terminal.');
      }

      login(authUser, guardRememberMe);
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



      {/* Main Container */}




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
        ) : selectedEmployee ? (
          /* ========================================================================= */
          /* STAGE 2: PUNCH-IN / PUNCH-OUT INTERFACE (ONE-TAP ACTION)                 */
          /* ========================================================================= */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <OneTapPunchInterface
              employee={selectedEmployee}
              mode="KIOSK"
              punchedBy="SECURITY"
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
            className="page-container kiosk-main-content"
            style={{
              maxWidth: '1200px',
              paddingTop: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >


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
                  className="kiosk-search-icon"
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
                  className="kiosk-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search name, ID or hotel (e.g. GG-1001, Raman)..."
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
              className="kiosk-horizontal-scroll kiosk-filter-row"
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
              <span className="kiosk-filter-label" style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '0.2rem', flexShrink: 0 }}>HOTEL:</span>
              <button
                type="button"
                className="kiosk-filter-pill"
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
                    className="kiosk-filter-pill"
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
              className="kiosk-horizontal-scroll kiosk-filter-row"
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
              <span className="kiosk-filter-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.2rem', flexShrink: 0 }}>DEPT:</span>
              <button
                type="button"
                className="kiosk-filter-pill"
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
                    className="kiosk-filter-pill"
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
                className="kiosk-emp-grid"
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
                      <div className="kiosk-emp-avatar-box" style={{ position: 'relative', flexShrink: 0 }}>
                        {emp.photo ? (
                          <img
                            src={emp.photo}
                            alt={`${emp.firstName} ${emp.lastName}`}
                            className="kiosk-emp-avatar"
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
                            className="kiosk-emp-avatar"
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
                          className="kiosk-emp-status-dot"
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
                          className="kiosk-emp-name"
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
                          className="kiosk-emp-dept"
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
                          className="kiosk-emp-badges"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                            marginTop: '0.35rem',
                          }}
                        >
                          <span
                            className="kiosk-emp-badge"
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
                            className="kiosk-emp-id"
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

                          {/* Shift timing badge (Accurately displays Night Shift and custom hours) */}
                          {(emp.morningTime || emp.eveningTime || emp.shiftDisplay) && (() => {
                            const mTime = (emp.morningTime || '').trim()
                            const eTime = (emp.eveningTime || '').trim()
                            const isNight = emp.isNightShift === true ||
                              (emp.shiftName && emp.shiftName.toLowerCase().includes('night')) ||
                              mTime === '20:00' || mTime.startsWith('2') || mTime.startsWith('19') || mTime.startsWith('18') ||
                              mTime.toLowerCase().includes('pm') ||
                              eTime === '08:00' || eTime === '07:00' || eTime === '06:00'

                            const format12H = (t?: string) => {
                              if (!t) return ''
                              const tr = t.trim()
                              if (tr.toUpperCase() === 'OFF') return 'Weekly Off'
                              if (tr.toLowerCase().includes('am') || tr.toLowerCase().includes('pm')) return tr
                              const parts = tr.split(':')
                              if (parts.length < 2) return tr
                              const h = parseInt(parts[0], 10)
                              const m = parts[1]
                              if (isNaN(h)) return tr
                              const ampm = h >= 12 ? 'PM' : 'AM'
                              const h12 = h % 12 === 0 ? 12 : h % 12
                              const mClean = m.padStart(2, '0')
                              return mClean === '00' ? `${h12} ${ampm}` : `${h12}:${mClean} ${ampm}`
                            }

                            const isBreak = mTime === '10:00' && eTime === '22:00'
                            const isAfternoon = mTime === '13:00'

                            return (
                              <span
                                className="kiosk-emp-shift-tag"
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  padding: '1px 7px',
                                  borderRadius: '4px',
                                  background: isNight
                                    ? (isLight ? '#ede9fe' : 'rgba(139, 92, 246, 0.22)')
                                    : isBreak
                                    ? (isLight ? '#e0f2fe' : 'rgba(14, 165, 233, 0.22)')
                                    : isAfternoon
                                    ? (isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)')
                                    : (isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.15)'),
                                  color: isNight
                                    ? '#7c3aed'
                                    : isBreak
                                    ? '#0284c7'
                                    : isAfternoon
                                    ? '#d97706'
                                    : '#16a34a',
                                  border: isNight
                                    ? '1px solid rgba(124, 58, 237, 0.35)'
                                    : isBreak
                                    ? '1px solid rgba(2, 132, 199, 0.3)'
                                    : isAfternoon
                                    ? '1px solid rgba(217, 119, 6, 0.25)'
                                    : '1px solid rgba(22, 163, 74, 0.25)',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                }}
                                title={emp.shiftDisplay || `${emp.morningTime} – ${emp.eveningTime}`}
                              >
                                {isNight
                                  ? `🌙 ${format12H(mTime || '20:00')} – ${format12H(eTime || '08:00')}`
                                  : isBreak
                                  ? '☕ 10 AM – 10 PM'
                                  : isAfternoon
                                  ? '🌆 1 PM – 11 PM'
                                  : `☀️ ${format12H(mTime || '09:00')} – ${format12H(eTime || '18:00')}`}
                              </span>
                            )
                          })()}

                          <span
                            className="kiosk-emp-status"
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: onShift ? '#10b981' : shiftDone ? '#64748b' : '#3b82f6',
                            }}
                          >
                            {onShift
                              ? (emp.punchInMode === 'SECURITY' || emp.punchInMode === 'KIOSK' ? '🛡️ In (Security)' : '🟢 On Shift')
                              : shiftDone
                              ? (emp.punchOutMode === 'SECURITY' || emp.punchOutMode === 'KIOSK' ? '🛡️ Out (Security)' : '🔴 Completed')
                              : '⚪ Ready'}
                          </span>
                        </div>

                        {/* Shift Swapped Notice Badge */}
                        {(emp.shiftChangeNotice || emp.isShiftSwapped) && (
                          <div
                            style={{
                              marginTop: '0.3rem',
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              color: isLight ? '#6d28d9' : '#c084fc',
                              backgroundColor: isLight ? '#ede9fe' : 'rgba(139, 92, 246, 0.2)',
                              border: isLight ? '1px solid #c4b5fd' : '1px solid rgba(139, 92, 246, 0.35)',
                              borderRadius: '5px',
                              padding: '2px 7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              width: 'fit-content',
                            }}
                            title={emp.shiftInstruction || emp.shiftChangeNotice || 'Shift changed in roster'}
                          >
                            <span>📢</span>
                            <span>{emp.shiftChangeNotice || (emp.isNightShift ? '🌙 Night Shift Swapped (8 PM – 8 AM)' : '☀️ Day Shift Swapped')}</span>
                          </div>
                        )}
                      </div>

                      {/* Tap Arrow */}
                      <span className="kiosk-emp-arrow" style={{ fontSize: '1.1rem', color: 'var(--text-muted)', opacity: 0.6 }}>
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

        /* Tablet & Mobile <= 768px */
        @media (max-width: 768px) {
          .kiosk-hdr-erplink { display: none !important; }
          .kiosk-sort-container { display: none !important; }
        }

        /* Mobile <= 640px */
        @media (max-width: 640px) {
          .kiosk-top-tab-bar {
            padding: 0.25rem 0.5rem !important;
          }
          .kiosk-main-content {
            padding-top: 0.4rem !important;
            padding-bottom: 1.25rem !important;
            padding-left: 0.45rem !important;
            padding-right: 0.45rem !important;
            gap: 0.45rem !important;
          }
          .kiosk-hero-banner {
            padding: 0.4rem 0.65rem !important;
            border-radius: 10px !important;
            gap: 0.35rem !important;
          }
          .kiosk-hero-title {
            font-size: 0.88rem !important;
            margin: 0 !important;
          }
          .kiosk-hero-subtitle {
            display: none !important;
          }
          .kiosk-pwd-btn {
            padding: 0.28rem 0.55rem !important;
            font-size: 0.72rem !important;
            border-radius: 7px !important;
          }
          .kiosk-search-sort-bar {
            gap: 0.35rem !important;
          }
          .kiosk-search-input {
            height: 38px !important;
            padding-left: 36px !important;
            padding-right: 32px !important;
            font-size: 0.88rem !important;
            border-radius: 9px !important;
          }
          .kiosk-search-icon {
            font-size: 0.95rem !important;
            left: 12px !important;
          }
          .kiosk-filter-row {
            gap: 0.25rem !important;
            padding-bottom: 2px !important;
          }
          .kiosk-filter-label {
            font-size: 0.65rem !important;
            margin-right: 0.15rem !important;
          }
          .kiosk-filter-pill {
            padding: 0.22rem 0.52rem !important;
            font-size: 0.72rem !important;
          }
          .kiosk-tab-hint { display: none !important; }

          /* Employee Directory Grid */
          .kiosk-emp-grid {
            grid-template-columns: 1fr !important;
            gap: 0.35rem !important;
          }
          .employee-kiosk-card {
            padding: 0.5rem 0.65rem !important;
            gap: 0.55rem !important;
            border-radius: 11px !important;
          }
          .kiosk-emp-avatar {
            width: 38px !important;
            height: 38px !important;
            font-size: 0.9rem !important;
          }
          .kiosk-emp-status-dot {
            width: 10px !important;
            height: 10px !important;
          }
          .kiosk-emp-name {
            font-size: 0.86rem !important;
            line-height: 1.2 !important;
          }
          .kiosk-emp-dept {
            font-size: 0.7rem !important;
            line-height: 1.2 !important;
          }
          .kiosk-emp-badges {
            gap: 0.25rem !important;
            margin-top: 0.2rem !important;
          }
          .kiosk-emp-badge {
            font-size: 0.62rem !important;
            padding: 1px 4px !important;
          }
          .kiosk-emp-id {
            font-size: 0.64rem !important;
            padding: 1px 4px !important;
          }
          .kiosk-emp-status {
            font-size: 0.64rem !important;
          }
          .kiosk-emp-arrow {
            font-size: 0.85rem !important;
          }
        }

        /* Phone portrait <= 480px */
        @media (max-width: 480px) {
          .kiosk-hdr-date { display: none !important; }
          .kiosk-hdr-badge { display: none !important; }
          .kiosk-hdr-locktext { display: none !important; }
          .kiosk-tab-text { font-size: 0.76rem !important; }
        }
      `}</style>
    </div>
  );
}
