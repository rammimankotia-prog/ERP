'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import OneTapPunchInterface, { EmployeeInfo } from '@/components/OneTapPunchInterface';

type UserType = 'admin' | 'employee';
type EmployeeMode = 'direct-punch' | 'portal-login';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  // Primary Mode: Admin vs Employee
  const [userType, setUserType] = useState<UserType>('employee'); // Default to employee for fast daily punch

  // Employee Sub-Mode: Direct 1-Tap Punch (No Password) vs Portal Login (with Password)
  const [empMode, setEmpMode] = useState<EmployeeMode>('direct-punch');

  // Employee List for Quick ID Identification
  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeInfo | null>(null);
  const [identifyError, setIdentifyError] = useState('');

  // Admin Login States
  const [adminTab, setAdminTab] = useState<'login' | 'reset'>('login');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [adminError, setAdminError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Admin Reset States
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

  // Employee Password Login States
  const [empIdentifier, setEmpIdentifier] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [empError, setEmpError] = useState('');
  const [empSubmitting, setEmpSubmitting] = useState(false);

  // Fetch employees list for quick Staff ID matching and 1-tap punch
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await fetch('/api/kiosk/employees');
        if (res.ok) {
          const data = await res.json();
          if (data.employees && Array.isArray(data.employees)) {
            setEmployees(data.employees);
          }
        }
      } catch (e) {
        console.error('Failed to load employees', e);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  // Read URL query params on mount to support direct links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode') || params.get('type') || params.get('role') || params.get('tab');
      if (mode === 'admin' || mode === 'manager') {
        setUserType('admin');
      } else if (mode === 'employee' || mode === 'staff') {
        setUserType('employee');
      }
    }
  }, []);

  // Function to switch between modes and synchronize URL cleanly
  const handleSwitchMode = (newMode: UserType) => {
    setUserType(newMode);
    setSelectedEmployee(null);
    setAdminError('');
    setEmpError('');
    setIdentifyError('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', newMode);
      window.history.replaceState(null, '', url.toString());
    }
  };

  // If already logged in as Admin, redirect to dashboard (only if NOT explicitly logged out)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoggedOut = localStorage.getItem('GODWIN_LOGGED_OUT') === 'true';
      if (isLoggedOut) {
        return;
      }
    }
    if (user && userType === 'admin') {
      router.push('/');
    }
  }, [user, userType, router]);

  // Identify employee by ID or name for One-Tap Punch (No Password Needed)
  const handleIdentifyStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setIdentifyError('');
    const query = staffSearch.trim().toLowerCase();
    if (!query) {
      setIdentifyError('Please enter your Staff ID or Name.');
      return;
    }

    const found = employees.find(emp => {
      const eId = (emp.employeeId || '').toLowerCase();
      const rawId = (emp.id || '').toLowerCase();
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      return (
        eId === query ||
        rawId === query ||
        fullName === query ||
        fullName.includes(query) ||
        (eId.includes('-') && eId.split('-')[1] === query)
      );
    });

    if (found) {
      setSelectedEmployee(found);
      setStaffSearch('');
    } else {
      setIdentifyError(`Staff ID "${staffSearch}" not found. Try GG-1001, GG-1002, GD-1001 or select from list below.`);
    }
  };

  // Handle Admin Login Submit
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        login(data.user);
        if (!rememberMe) {
          sessionStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(data.user));
        }
        router.push('/');
      } else {
        setAdminError(data.error || 'Invalid credentials. Please verify username and password.');
      }
    } catch {
      setAdminError('Unable to connect to authentication server. Please check your network connection.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  // Handle Admin Password Reset
  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setAdminSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
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
      setAdminSubmitting(false);
    }
  };

  // Handle Employee Portal Login Submit (With Password)
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError('');
    setEmpSubmitting(true);

    try {
      const res = await fetch('/api/kiosk/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: empIdentifier.trim(),
          password: empPassword.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.employee) {
        localStorage.setItem('kiosk_employee', JSON.stringify(data.employee));
        router.push('/kiosk/dashboard');
      } else {
        setEmpError(data.error || 'Invalid Employee ID / Email or Password.');
      }
    } catch {
      setEmpError('Unable to connect to staff authentication service.');
    } finally {
      setEmpSubmitting(false);
    }
  };

  // Quick fill helpers
  const fillAdminCredentials = () => {
    setAdminUsername('Godwinhotels');
    setAdminPassword('Godwindeluxe@99');
    setAdminError('');
  };

  const fillEmployeeCredentials = () => {
    setEmpIdentifier('GG-1002');
    setEmpPassword('Godwin@123');
    setEmpError('');
  };

  return (
    <div className="login-page-wrapper">
      {/* Background ambient lighting */}
      <div className={`ambient-light ${userType === 'admin' ? 'gold-light' : 'emerald-light'}`} />
      <div className="ambient-light blue-light" />

      {/* Main Centered Login Card */}
      <div className="login-card">
        {/* Dynamic Color Accent Bar */}
        <div className={`accent-bar ${userType === 'admin' ? 'admin-accent' : 'emp-accent'}`} />

        {/* Portal Type Switcher (Top Segmented Control) */}
        <div className="portal-selector" role="tablist" aria-label="Login Role Selection">
          <button
            type="button"
            role="tab"
            aria-selected={userType === 'employee'}
            onClick={() => handleSwitchMode('employee')}
            className={`portal-tab ${userType === 'employee' ? 'active emp-active' : ''}`}
          >
            <span className="portal-icon">⚡</span>
            <div className="portal-tab-content">
              <span className="portal-title">Employee Punch</span>
              <span className="portal-hint">One-Tap (No Password)</span>
            </div>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={userType === 'admin'}
            onClick={() => handleSwitchMode('admin')}
            className={`portal-tab ${userType === 'admin' ? 'active admin-active' : ''}`}
          >
            <span className="portal-icon">👔</span>
            <div className="portal-tab-content">
              <span className="portal-title">Admin Login</span>
              <span className="portal-hint">Management &amp; ERP</span>
            </div>
          </button>
        </div>

        {/* ==================== EMPLOYEE SECTION ==================== */}
        {userType === 'employee' && (
          <div className="section-content">
            {/* If an employee is identified, render OneTapPunchInterface directly! */}
            {selectedEmployee ? (
              <div>
                <OneTapPunchInterface
                  employee={selectedEmployee}
                  onBack={() => setSelectedEmployee(null)}
                  onSuccess={() => {
                    // Refetch status or reset after timeout
                  }}
                  autoResetSeconds={4}
                />
              </div>
            ) : (
              <div>
                <div className="card-header">
                  <div className="brand-badge emerald-badge">
                    <span>⚡</span>
                    <span>STAFF ATTENDANCE • NO PASSWORD NEEDED</span>
                  </div>
                  <h1 className="card-title">One-Tap Punch In / Out</h1>
                  <p className="card-subtitle">
                    Enter your Staff ID or tap your profile to record Check-In or Check-Out instantly.
                  </p>
                </div>

                {/* Sub-mode switcher: Direct Punch vs Portal Login */}
                <div className="tab-switcher">
                  <button
                    type="button"
                    onClick={() => setEmpMode('direct-punch')}
                    className={`tab-btn ${empMode === 'direct-punch' ? 'active' : ''}`}
                  >
                    <span>⚡</span> Direct Punch (1-Tap)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmpMode('portal-login')}
                    className={`tab-btn ${empMode === 'portal-login' ? 'active' : ''}`}
                  >
                    <span>🔑</span> Staff Portal Login
                  </button>
                </div>

                {empMode === 'direct-punch' ? (
                  <div>
                    {/* Direct Punch Identification Form */}
                    <form onSubmit={handleIdentifyStaff} className="auth-form">
                      {identifyError && (
                        <div className="alert-box error-alert">
                          <span className="alert-icon">⚠️</span>
                          <span>{identifyError}</span>
                        </div>
                      )}

                      <div className="input-group">
                        <label className="input-label">Staff ID or Full Name</label>
                        <div className="input-wrapper focus-emerald">
                          <span className="input-icon">🆔</span>
                          <input
                            type="text"
                            required
                            autoFocus
                            value={staffSearch}
                            onChange={(e) => {
                              setStaffSearch(e.target.value);
                              setIdentifyError('');
                            }}
                            placeholder="e.g. GG-1002, GG-1001, or Priya"
                            className="form-input"
                          />
                          <button
                            type="submit"
                            className="inline-identify-btn"
                          >
                            Punch ➔
                          </button>
                        </div>
                      </div>

                      {/* Quick Staff Selection Chips */}
                      <div className="quick-staff-section">
                        <div className="quick-staff-header">
                          <span>Or tap your staff profile:</span>
                          {loadingEmployees && <span style={{ fontSize: '0.7rem' }}>Loading...</span>}
                        </div>
                        <div className="quick-staff-chips">
                          {employees.slice(0, 6).map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => setSelectedEmployee(emp)}
                              className="staff-chip"
                            >
                              <span className="chip-avatar">
                                {emp.photo ? (
                                  <img src={emp.photo} alt={emp.firstName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  `${emp.firstName[0]}${emp.lastName[0] || ''}`
                                )}
                              </span>
                              <div className="chip-info">
                                <span className="chip-name">{emp.firstName} {emp.lastName}</span>
                                <span className="chip-id">{emp.employeeId} • {emp.department}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Wall Kiosk Link */}
                      <div className="kiosk-shortcut-box">
                        <span className="shortcut-icon">🖥️</span>
                        <div className="shortcut-text">
                          <div className="shortcut-title">Using Tablet or Wall Screen?</div>
                          <Link href="/kiosk" className="shortcut-link">
                            Open Full-Screen Kiosk Terminal ➔
                          </Link>
                        </div>
                      </div>

                      {/* Switch to Admin Login Prompt */}
                      <div className="switch-helper-box">
                        <div className="helper-content">
                          <span className="helper-icon">👔</span>
                          <span className="helper-label">Are you a manager or administrator?</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSwitchMode('admin')}
                          className="switch-action-btn to-admin-action"
                        >
                          Switch to Admin Login ➔
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  /* Employee Portal Login (With Password) */
                  <form onSubmit={handleEmployeeLogin} className="auth-form">
                    {empError && (
                      <div className="alert-box error-alert">
                        <span className="alert-icon">⚠️</span>
                        <span>{empError}</span>
                      </div>
                    )}

                    <div className="input-group">
                      <label className="input-label">Employee ID or Staff Email</label>
                      <div className="input-wrapper focus-emerald">
                        <span className="input-icon">🆔</span>
                        <input
                          type="text"
                          required
                          autoComplete="username"
                          value={empIdentifier}
                          onChange={(e) => setEmpIdentifier(e.target.value)}
                          placeholder="GG-1002 or staff@godwinhotels.com"
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Staff Password / PIN</label>
                      <div className="input-wrapper focus-emerald">
                        <span className="input-icon">🔑</span>
                        <input
                          type={showEmpPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={empPassword}
                          onChange={(e) => setEmpPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="form-input"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEmpPassword(!showEmpPassword)}
                          className="toggle-password-btn"
                          aria-label={showEmpPassword ? 'Hide password' : 'Show password'}
                        >
                          {showEmpPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={empSubmitting}
                      className="submit-btn emerald-btn"
                    >
                      {empSubmitting ? (
                        <>
                          <span className="btn-spinner" />
                          Verifying Staff Access...
                        </>
                      ) : (
                        <>
                          <span>⚡</span> Access Staff Dashboard ➔
                        </>
                      )}
                    </button>

                    {/* Quick Demo Fill */}
                    <div className="demo-credentials-card">
                      <div className="demo-card-header">
                        <span className="demo-badge emerald-text">👤 Staff Demo (Priya Sharma - Front Desk)</span>
                        <button
                          type="button"
                          onClick={fillEmployeeCredentials}
                          className="auto-fill-btn emerald-fill-btn"
                        >
                          ⚡ Auto-Fill
                        </button>
                      </div>
                      <div className="demo-card-body">
                        <span>ID: <strong className="mono-text">GG-1002</strong></span>
                        <span className="divider">|</span>
                        <span>Pass: <strong className="mono-text">Godwin@123</strong></span>
                      </div>
                    </div>

                    {/* Switch to Direct Punch */}
                    <button
                      type="button"
                      onClick={() => setEmpMode('direct-punch')}
                      className="text-mode-btn"
                    >
                      ⚡ Just need to punch in/out? Tap here (No Password)
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== ADMIN SECTION ==================== */}
        {userType === 'admin' && (
          <div className="section-content">
            <div className="card-header">
              <div className="brand-badge gold-badge">
                <span>👑</span>
                <span>HOTEL GRAND GODWIN &amp; GODWIN DELUXE</span>
              </div>
              <h1 className="card-title">Executive ERP Portal</h1>
              <p className="card-subtitle">
                {adminTab === 'login'
                  ? 'Sign in with administrative credentials to access centralized ERP controls.'
                  : 'Enter your registered email to receive administrative recovery instructions.'}
              </p>
            </div>

            {/* Sub-tab: Login vs Reset */}
            <div className="tab-switcher">
              <button
                type="button"
                onClick={() => { setAdminTab('login'); setAdminError(''); }}
                className={`tab-btn ${adminTab === 'login' ? 'active' : ''}`}
              >
                <span>🔐</span> Secure Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAdminTab('reset'); setResetError(''); setResetSuccess(''); }}
                className={`tab-btn ${adminTab === 'reset' ? 'active' : ''}`}
              >
                <span>❓</span> Reset Password
              </button>
            </div>

            {adminTab === 'login' ? (
              <form onSubmit={handleAdminLogin} className="auth-form">
                {adminError && (
                  <div className="alert-box error-alert">
                    <span className="alert-icon">⚠️</span>
                    <span>{adminError}</span>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">Username or Admin Email</label>
                  <div className="input-wrapper focus-gold">
                    <span className="input-icon">👤</span>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Godwinhotels"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <div className="password-header">
                    <label className="input-label" style={{ margin: 0 }}>Password</label>
                    <button
                      type="button"
                      onClick={() => setAdminTab('reset')}
                      className="forgot-link"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="input-wrapper focus-gold">
                    <span className="input-icon">🔑</span>
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="form-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="toggle-password-btn"
                      aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                    >
                      {showAdminPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="remember-row">
                  <input
                    type="checkbox"
                    id="adminRemember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="remember-checkbox gold-checkbox"
                  />
                  <label htmlFor="adminRemember" className="remember-label">
                    Remember executive session for 30 days
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={adminSubmitting}
                  className="submit-btn gold-btn"
                >
                  {adminSubmitting ? (
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

                {/* Quick Auto-Fill Demo Credentials */}
                <div className="demo-credentials-card">
                  <div className="demo-card-header">
                    <span className="demo-badge gold-text">🔒 Root Admin Credentials</span>
                    <button
                      type="button"
                      onClick={fillAdminCredentials}
                      className="auto-fill-btn gold-fill-btn"
                    >
                      ⚡ Auto-Fill
                    </button>
                  </div>
                  <div className="demo-card-body">
                    <span>User: <strong className="mono-text">Godwinhotels</strong></span>
                    <span className="divider">|</span>
                    <span>Pass: <strong className="mono-text">Godwindeluxe@99</strong></span>
                  </div>
                </div>

                {/* Switch to Employee Punch */}
                <div className="switch-helper-box">
                  <div className="helper-content">
                    <span className="helper-icon">⚡</span>
                    <span className="helper-label">Need Staff 1-Tap Punch or Shift Access?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('employee')}
                    className="switch-action-btn to-employee-action"
                  >
                    Switch to Employee Punch ➔
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAdminReset} className="auth-form">
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
                  Enter your registered administrator email (<strong style={{ color: '#fbbf24' }}>mail@godwinhotels.com</strong>) to receive a secure password recovery token.
                </p>

                <div className="input-group">
                  <label className="input-label">Admin Email Address</label>
                  <div className="input-wrapper focus-gold">
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
                  disabled={adminSubmitting}
                  className="submit-btn blue-btn"
                >
                  {adminSubmitting ? 'Processing Request...' : '📧 Send Recovery Instructions'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Card Footer */}
        <div className="card-footer">
          <p className="security-text">
            🔒 Protected by Godwin Hospitality Security Protocol v3.0.<br />
            Assistance: <a href="mailto:mail@godwinhotels.com" className="support-link">mail@godwinhotels.com</a>
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
          transition: background 0.4s ease;
        }

        .gold-light {
          top: -10%;
          right: -5%;
          width: clamp(300px, 40vw, 550px);
          height: clamp(300px, 40vw, 550px);
          background: radial-gradient(circle, rgba(245, 158, 11, 0.09) 0%, transparent 70%);
        }

        .emerald-light {
          top: -10%;
          right: -5%;
          width: clamp(300px, 40vw, 550px);
          height: clamp(300px, 40vw, 550px);
          background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%);
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
          max-width: 530px;
          background: rgba(15, 23, 42, 0.86);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
          padding: clamp(1.6rem, 3.8vw, 2.35rem);
          position: relative;
          z-index: 1;
          box-sizing: border-box;
        }

        .accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          transition: background 0.3s ease;
        }

        .admin-accent {
          background: linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #d97706 100%);
        }

        .emp-accent {
          background: linear-gradient(90deg, #059669 0%, #10b981 50%, #06b6d4 100%);
        }

        /* Top Segmented Role Switcher */
        .portal-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(2, 6, 23, 0.75);
          padding: 0.35rem;
          border-radius: 14px;
          margin-bottom: 1.6rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          gap: 0.35rem;
        }

        .portal-tab {
          padding: 0.65rem 0.5rem;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          min-height: 48px;
          text-align: left;
        }

        .portal-tab:hover:not(.active) {
          background: rgba(255, 255, 255, 0.04);
          color: #cbd5e1;
        }

        .portal-icon {
          font-size: 1.35rem;
          flex-shrink: 0;
        }

        .portal-tab-content {
          display: flex;
          flex-direction: column;
        }

        .portal-title {
          font-size: 0.86rem;
          font-weight: 800;
          line-height: 1.2;
        }

        .portal-hint {
          font-size: 0.68rem;
          font-weight: 500;
          color: #64748b;
          line-height: 1.2;
          margin-top: 2px;
        }

        .portal-tab.active.admin-active {
          background: rgba(245, 158, 11, 0.18);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
        }

        .portal-tab.active.admin-active .portal-hint {
          color: #fde68a;
          opacity: 0.85;
        }

        .portal-tab.active.emp-active {
          background: rgba(16, 185, 129, 0.18);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.35);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
        }

        .portal-tab.active.emp-active .portal-hint {
          color: #a7f3d0;
          opacity: 0.85;
        }

        .section-content {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .card-header {
          text-align: center;
          margin-bottom: 1.35rem;
        }

        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.35rem 0.8rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 0.75rem;
        }

        .gold-badge {
          background: rgba(245, 158, 11, 0.14);
          border: 1px solid rgba(245, 158, 11, 0.28);
          color: #fbbf24;
        }

        .emerald-badge {
          background: rgba(16, 185, 129, 0.14);
          border: 1px solid rgba(16, 185, 129, 0.28);
          color: #34d399;
        }

        .card-title {
          color: #ffffff;
          font-size: clamp(1.4rem, 3vw, 1.75rem);
          font-weight: 900;
          margin: 0 0 0.35rem 0;
          letter-spacing: -0.02em;
        }

        .card-subtitle {
          color: #94a3b8;
          font-size: 0.84rem;
          margin: 0;
          font-weight: 500;
          line-height: 1.45;
        }

        /* Sub Tab Switcher */
        .tab-switcher {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(0, 0, 0, 0.4);
          padding: 0.25rem;
          border-radius: 11px;
          margin-bottom: 1.25rem;
          border: 1px solid rgba(255, 255, 255, 0.06);
          gap: 0.25rem;
        }

        .tab-btn {
          padding: 0.6rem 0.5rem;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 800;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 38px;
        }

        .tab-btn.active {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
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
          font-size: 0.76rem;
          font-weight: 800;
          margin-bottom: 0.45rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          background: rgba(2, 6, 23, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 12px;
          padding: 0 0.9rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .focus-gold:focus-within {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
        }

        .focus-emerald:focus-within {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
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
          font-size: 16px;
          outline: none;
          font-weight: 600;
        }

        .form-input::placeholder {
          color: #475569;
          font-weight: 500;
          font-size: 0.9rem;
        }

        .inline-identify-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 800;
          padding: 0.45rem 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .inline-identify-btn:hover {
          transform: translateY(-1px);
        }

        /* Quick Staff Chips */
        .quick-staff-section {
          margin-top: 0.25rem;
        }

        .quick-staff-header {
          font-size: 0.74rem;
          color: #94a3b8;
          font-weight: 600;
          margin-bottom: 0.5rem;
          display: flex;
          justify-content: space-between;
        }

        .quick-staff-chips {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.5rem;
        }

        .staff-chip {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 0.5rem 0.6rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .staff-chip:hover {
          background: rgba(16, 185, 129, 0.14);
          border-color: rgba(16, 185, 129, 0.3);
          transform: translateY(-1px);
        }

        .chip-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.25);
          color: #34d399;
          font-size: 0.68rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .chip-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chip-name {
          color: #ffffff;
          font-size: 0.74rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chip-id {
          color: #64748b;
          font-size: 0.65rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
          font-size: 0.76rem;
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
          width: 17px;
          height: 17px;
          cursor: pointer;
          border-radius: 4px;
        }

        .gold-checkbox {
          accent-color: #d97706;
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
          font-size: 0.95rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 0.35rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          min-height: 48px;
        }

        .gold-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 10px 20px -5px rgba(217, 119, 6, 0.4);
        }

        .gold-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #fbbf24 0%, #b45309 100%);
          transform: translateY(-1px);
          box-shadow: 0 12px 24px -5px rgba(217, 119, 6, 0.55);
        }

        .emerald-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.4);
        }

        .emerald-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #34d399 0%, #047857 100%);
          transform: translateY(-1px);
          box-shadow: 0 12px 24px -5px rgba(16, 185, 129, 0.55);
        }

        .blue-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
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

        .text-mode-btn {
          background: transparent;
          border: none;
          color: #34d399;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          text-align: center;
          padding: 0.4rem;
          text-decoration: underline;
        }

        /* Demo credentials card */
        .demo-credentials-card {
          margin-top: 0.35rem;
          padding: 0.8rem 0.95rem;
          background: rgba(2, 6, 23, 0.55);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.76rem;
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
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .gold-text { color: #fbbf24; }
        .emerald-text { color: #34d399; }

        .auto-fill-btn {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .gold-fill-btn {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: #fbbf24;
        }

        .gold-fill-btn:hover {
          background: rgba(245, 158, 11, 0.28);
        }

        .emerald-fill-btn {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #34d399;
        }

        .emerald-fill-btn:hover {
          background: rgba(16, 185, 129, 0.28);
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

        /* Switch Helper Box at Bottom of Form */
        .switch-helper-box {
          margin-top: 0.5rem;
          padding: 0.85rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.6rem;
        }

        .helper-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .helper-icon {
          font-size: 1.1rem;
        }

        .helper-label {
          color: #94a3b8;
          font-size: 0.78rem;
          font-weight: 500;
        }

        .switch-action-btn {
          background: transparent;
          border: none;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }

        .to-employee-action {
          color: #34d399;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .to-employee-action:hover {
          background: rgba(16, 185, 129, 0.22);
          transform: translateX(2px);
        }

        .to-admin-action {
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .to-admin-action:hover {
          background: rgba(245, 158, 11, 0.22);
          transform: translateX(2px);
        }

        .kiosk-shortcut-box {
          margin-top: 0.35rem;
          padding: 0.8rem 0.95rem;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.22);
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .shortcut-icon {
          font-size: 1.4rem;
        }

        .shortcut-title {
          color: #94a3b8;
          font-size: 0.76rem;
          font-weight: 500;
        }

        .shortcut-link {
          color: #34d399;
          font-size: 0.8rem;
          font-weight: 700;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .shortcut-link:hover {
          color: #6ee7b7;
          text-decoration: underline;
        }

        .reset-helper-text {
          color: #94a3b8;
          font-size: 0.84rem;
          line-height: 1.5;
          margin: 0;
        }

        .card-footer {
          margin-top: 1.6rem;
          padding-top: 1.15rem;
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

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Mobile adjustments */
        @media (max-width: 480px) {
          .login-page-wrapper {
            padding: 1rem 0.65rem;
          }

          .login-card {
            padding: 1.4rem 1.1rem;
            border-radius: 20px;
          }

          .portal-tab {
            padding: 0.5rem 0.4rem;
            min-height: 44px;
          }

          .portal-title {
            font-size: 0.8rem;
          }

          .portal-hint {
            display: none;
          }

          .card-title {
            font-size: 1.35rem;
          }

          .brand-badge {
            font-size: 0.65rem;
            padding: 0.3rem 0.65rem;
          }

          .quick-staff-chips {
            grid-template-columns: 1fr;
          }

          .switch-helper-box {
            flex-direction: column;
            align-items: flex-start;
          }

          .switch-action-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
