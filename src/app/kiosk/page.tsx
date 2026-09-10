'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import OneTapPunchInterface, { EmployeeInfo } from '@/components/OneTapPunchInterface';

export default function KioskPage() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const { user, login, logout } = useAuth();

  const isGuardAuthenticated = !!(
    user &&
    (user.role === 'Security Guard' ||
      user.role === 'Master Admin' ||
      user.role === 'ADMIN' ||
      user.role === 'Manager')
  );

  const [guardLoginUser, setGuardLoginUser] = useState('');
  const [guardLoginPass, setGuardLoginPass] = useState('');
  const [guardLoginError, setGuardLoginError] = useState('');
  const [guardLoginLoading, setGuardLoginLoading] = useState(false);

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

  // Departments list
  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(e => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts);
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.firstName.toLowerCase().includes(q) ||
        emp.lastName.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.designation && emp.designation.toLowerCase().includes(q));

      const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;

      return matchesSearch && matchesDept;
    });
  }, [employees, searchQuery, selectedDept]);

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

      login(data.user);
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
      {/* Kiosk Terminal Header */}
      <header
        style={{
          width: '100%',
          background: isLight ? '#ffffff' : '#1e293b',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
            }}
          >
            🏨
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 900,
                color: isLight ? '#0f172a' : '#f8fafc',
                letterSpacing: '-0.01em',
              }}
            >
              Godwin ERP • Security Gate Kiosk
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Fixed Station Punch-In / Punch-Out Terminal
            </p>
          </div>
        </div>

        {/* Right side live clock & controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: 'var(--primary)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {currentTime.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {currentTime.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '9px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
              color: isLight ? '#1e293b' : '#f8fafc',
              cursor: 'pointer',
              fontSize: '1.1rem',
            }}
          >
            {isLight ? '🌙' : '☀️'}
          </button>

          {isGuardAuthenticated && user && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <span style={{ fontSize: '1rem' }}>🛡️</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>
                {user.name} ({user.role})
              </span>
            </div>
          )}

          {isGuardAuthenticated && (
            <button
              type="button"
              onClick={logout}
              title="Lock terminal and sign out guard"
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '9px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔒 Lock Terminal
            </button>
          )}

          {isGuardAuthenticated && user?.role !== 'Security Guard' && (
            <Link
              href="/hr/attendance"
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '9px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              ← ERP Dashboard
            </Link>
          )}
        </div>
      </header>

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
                borderRadius: '16px',
                padding: 'clamp(1.25rem, 3vw, 2rem)',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                boxShadow: 'var(--shadow)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: '0 0 0.4rem 0',
                    fontSize: 'clamp(1.4rem, 3.5vw, 1.85rem)',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                  }}
                >
                  👋 Tap Your Name or Search to Clock In/Out
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  Select your profile below for <strong>One-Tap Check-In / Check-Out</strong>. The system automatically highlights your next action.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: showPasswordLogin ? 'var(--primary)' : 'var(--bg-main)',
                  color: showPasswordLogin ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                }}
              >
                {showPasswordLogin ? '✕ Close Form Login' : '🔑 Login with Password'}
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

            {/* Instant Search Bar */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: '1 1 300px', position: 'relative' }}>
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
                  placeholder="Type employee name or staff ID (e.g. GG-1001, Raman, Front Desk)..."
                  style={{
                    width: '100%',
                    height: '52px',
                    paddingLeft: '48px',
                    paddingRight: '48px',
                    borderRadius: '14px',
                    border: isLight ? '2px solid #cbd5e1' : '2px solid #334155',
                    backgroundColor: isLight ? '#ffffff' : '#1e293b',
                    color: 'var(--text-main)',
                    fontSize: '1.05rem',
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

              {/* Department filter chips */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setSelectedDept('ALL')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '99px',
                    border: selectedDept === 'ALL' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: selectedDept === 'ALL' ? 'rgba(37, 99, 235, 0.12)' : (isLight ? '#ffffff' : '#1e293b'),
                    color: selectedDept === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                  }}
                >
                  All ({employees.length})
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
                        padding: '0.5rem 1rem',
                        borderRadius: '99px',
                        border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: active ? 'rgba(37, 99, 235, 0.12)' : (isLight ? '#ffffff' : '#1e293b'),
                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                      }}
                    >
                      {dept} ({count})
                    </button>
                  );
                })}
              </div>
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
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
                  gap: '1rem',
                }}
              >
                {filteredEmployees.map(emp => {
                  const onShift = emp.checkedIn && !emp.checkedOut;
                  const shiftDone = emp.checkedIn && emp.checkedOut;

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
                            gap: '0.4rem',
                            marginTop: '0.35rem',
                          }}
                        >
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
        .employee-kiosk-card:hover {
          transform: translateY(-3px) scale(1.02);
          border-color: var(--primary) !important;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.2) !important;
        }
      `}</style>
    </div>
  );
}
