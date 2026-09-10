'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import { useSidebar } from '@/components/SidebarContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { user, hasPermission, isMasterAdmin } = useAuth();
  const { isCollapsed, isMobileOpen, closeMobileSidebar } = useSidebar();

  // Auto-close mobile sidebar whenever pathname changes
  useEffect(() => {
    closeMobileSidebar();
  }, [pathname, closeMobileSidebar]);

  const cleanPath = (pathname || '').split('?')[0].replace(/\/$/, '') || '/';
  if (!user || cleanPath.startsWith('/login') || cleanPath.startsWith('/logout') || cleanPath.startsWith('/admin/login')) return null;


  // Helper: show HR sublink only if user has view permission
  const canSee = (module: string) => isMasterAdmin || hasPermission(module, 'view');

  // Check if ANY hr module is visible (to show parent HR & Attendance link)
  const showHR = canSee('hr.employees') || canSee('hr.attendance') || canSee('hr.shifts') ||
    canSee('hr.leave') || canSee('hr.payroll') || canSee('hr.reports');

  const isLight = theme === 'light';

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sidebar-backdrop ${isMobileOpen ? 'active' : ''}`}
        onClick={closeMobileSidebar}
        aria-hidden={!isMobileOpen}
      />

      {/* Main Sidebar (Desktop Sticky + Mobile Drawer) */}
      <aside
        className={`sidebar no-print ${isCollapsed ? 'desktop-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          background: isLight ? '#f8fafc' : '#0f172a',
          borderRight: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b',
        }}
      >
        {/* Header with Title & Mobile Close Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          padding: '0 0.5rem'
        }}>
          <div>
            <h2 style={{
              color: isLight ? '#1e293b' : 'white',
              letterSpacing: '-0.02em',
              fontSize: '1.25rem',
              fontWeight: 900,
              margin: 0
            }}>
              GODWIN ERP
            </h2>
            <p style={{
              color: isLight ? '#64748b' : '#94a3b8',
              fontSize: '0.7rem',
              marginTop: '0.25rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: 0
            }}>
              Hospitality &amp; Tour Mgmt
            </p>
          </div>

          {/* Close button - visible only on mobile/tablet drawer */}
          <button
            type="button"
            onClick={closeMobileSidebar}
            className="mobile-close-btn"
            aria-label="Close Navigation Menu"
            style={{
              background: 'transparent',
              border: 'none',
              color: isLight ? '#64748b' : '#94a3b8',
              fontSize: '1.4rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation Items */}
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          flex: 1,
          overflowY: 'auto',
          paddingRight: '0.25rem'
        }}>
          {/* Quick Punch Terminal */}
          <NavLink
            href="/kiosk"
            icon="⚡"
            label="Punch In / Out"
            badge="1-Tap"
            active={pathname.startsWith('/kiosk')}
            theme={theme}
            onClick={closeMobileSidebar}
          />

          {showHR && (
            <>
              <NavLink
                href="/hr/employees"
                icon="👔"
                label="HR & Attendance"
                active={pathname.startsWith('/hr')}
                theme={theme}
                onClick={closeMobileSidebar}
              />
              <div style={{
                marginLeft: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                borderLeft: '2px solid rgba(37, 99, 235, 0.3)',
                paddingLeft: '0.75rem'
              }}>
                {canSee('hr.employees') && (
                  <SubLink
                    href="/hr/employees"
                    label="Employees"
                    active={pathname === '/hr/employees' || pathname.startsWith('/hr/employees')}
                    theme={theme}
                    onClick={closeMobileSidebar}
                  />
                )}
                {canSee('hr.attendance') && (
                  <>
                    <SubLink
                      href="/hr/attendance"
                      label="Attendance Sheet"
                      active={pathname.startsWith('/hr/attendance')}
                      theme={theme}
                      onClick={closeMobileSidebar}
                    />
                    <SubLink
                      href="/kiosk"
                      label="⚡ Punch Terminal"
                      active={pathname.startsWith('/kiosk')}
                      theme={theme}
                      onClick={closeMobileSidebar}
                    />
                  </>
                )}
                {canSee('hr.shifts') && (
                  <SubLink
                    href="/hr/shifts"
                    label="Shift Manager"
                    active={pathname.startsWith('/hr/shifts')}
                    theme={theme}
                    onClick={closeMobileSidebar}
                  />
                )}
                {canSee('hr.leave') && (
                  <SubLink
                    href="/hr/leave"
                    label="Leave"
                    active={pathname.startsWith('/hr/leave')}
                    theme={theme}
                    onClick={closeMobileSidebar}
                  />
                )}
                {canSee('hr.payroll') && (
                  <SubLink
                    href="/hr/payroll"
                    label="Payroll"
                    active={pathname.startsWith('/hr/payroll')}
                    theme={theme}
                    onClick={closeMobileSidebar}
                  />
                )}
                {canSee('hr.reports') && (
                  <SubLink
                    href="/hr/reports"
                    label="Reports"
                    active={pathname.startsWith('/hr/reports')}
                    theme={theme}
                    onClick={closeMobileSidebar}
                  />
                )}
              </div>
            </>
          )}

          <div style={{
            margin: '1.25rem 0.5rem',
            borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b'
          }} />

          {canSee('userAccess') && (
            <NavLink
              href="/users"
              icon="👥"
              label="User Access"
              active={pathname === '/users'}
              theme={theme}
              onClick={closeMobileSidebar}
            />
          )}
          {canSee('settings') && (
            <NavLink
              href="/settings"
              icon="⚙️"
              label="Settings"
              active={pathname === '/settings'}
              theme={theme}
              onClick={closeMobileSidebar}
            />
          )}
        </nav>

        <style jsx>{`
          .sidebar-backdrop {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px);
            -webkit-backdrop-filter: blur(3px);
            z-index: 998;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
          }

          .sidebar {
            width: 280px;
            height: 100vh;
            padding: 1.5rem 1.25rem;
            display: flex;
            flex-direction: column;
            position: sticky;
            top: 0;
            flex-shrink: 0;
            z-index: 999;
            color: ${isLight ? '#374151' : '#94a3b8'};
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .mobile-close-btn {
            display: none;
          }

          .desktop-collapsed {
            display: none;
          }

          @media (max-width: 1024px) {
            .sidebar-backdrop {
              display: block;
            }
            .sidebar-backdrop.active {
              opacity: 1;
              pointer-events: auto;
            }

            .sidebar {
              position: fixed;
              top: 0;
              left: 0;
              bottom: 0;
              width: 285px;
              max-width: 85vw;
              transform: translateX(-100%);
              box-shadow: none;
            }

            .sidebar.mobile-open {
              transform: translateX(0);
              box-shadow: 10px 0 30px rgba(0, 0, 0, 0.35);
            }

            .desktop-collapsed {
              display: flex; /* On mobile, isCollapsed does not hide drawer - mobile-open controls visibility */
            }

            .mobile-close-btn {
              display: block;
            }
          }

          .nav-link-hover:hover {
            background-color: ${isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(255, 255, 255, 0.07)'} !important;
            color: ${isLight ? '#1d4ed8' : 'white'} !important;
          }
        `}</style>
      </aside>
    </>
  );
}

function NavLink({
  href,
  icon,
  label,
  badge,
  active,
  theme,
  onClick
}: {
  href: string;
  icon: string;
  label: string;
  badge?: string;
  active?: boolean;
  theme?: string;
  onClick?: () => void;
}) {
  const isLight = theme === 'light';
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        padding: '0.75rem 1rem',
        borderRadius: '10px',
        textDecoration: 'none',
        color: active ? (isLight ? '#2563eb' : '#fff') : (isLight ? '#374151' : '#94a3b8'),
        background: active ? (isLight ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.15)') : 'transparent',
        fontSize: '0.9rem',
        fontWeight: active ? 700 : 500,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        border: active ? (isLight ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)') : '1px solid transparent'
      }}
      className={active ? '' : 'nav-link-hover'}
    >
      <span style={{
        fontSize: '1.1rem',
        filter: active ? 'none' : 'grayscale(0.4)',
        opacity: active ? 1 : 0.8
      }}>
        {icon}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
        <span>{label}</span>
        {badge && (
          <span style={{
            fontSize: '0.65rem',
            padding: '2px 7px',
            borderRadius: '999px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            backgroundColor: isLight ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.25)',
            color: isLight ? '#059669' : '#34d399',
            border: isLight ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(16, 185, 129, 0.4)',
          }}>
            {badge}
          </span>
        )}
      </span>
    </Link>
  );
}

function SubLink({
  href,
  label,
  active,
  theme,
  onClick
}: {
  href: string;
  label: string;
  active?: boolean;
  theme?: string;
  onClick?: () => void;
}) {
  const isLight = theme === 'light';
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'block',
        padding: '0.45rem 0.75rem',
        borderRadius: '8px',
        textDecoration: 'none',
        color: active
          ? (isLight ? '#1d4ed8' : '#93c5fd')
          : (isLight ? '#374151' : '#94a3b8'),
        background: active
          ? (isLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.15)')
          : 'transparent',
        fontSize: '0.825rem',
        fontWeight: active ? 700 : 500,
        transition: 'all 0.15s',
      }}
      className={active ? '' : 'nav-link-hover'}
    >
      {label}
    </Link>
  );
}
