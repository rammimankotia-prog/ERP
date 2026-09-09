'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import { useSidebar } from '@/components/SidebarContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { user, hasPermission, isMasterAdmin } = useAuth();
  const { isCollapsed } = useSidebar();

  if (!user || pathname === '/login' || pathname === '/logout' || isCollapsed) return null;

  // Helper: show HR sublink only if user has view permission
  const canSee = (module: string) => isMasterAdmin || hasPermission(module, 'view');

  // Check if ANY hr module is visible (to show parent HR & Attendance link)
  const showHR = canSee('hr.employees') || canSee('hr.attendance') || canSee('hr.shifts') ||
    canSee('hr.leave') || canSee('hr.payroll') || canSee('hr.reports');

  return (
    <aside className="sidebar no-print" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      padding: '1.5rem 1.25rem',
      background: theme === 'light' ? '#f8fafc' : '#0f172a',
      borderRight: theme === 'light' ? '1px solid #e2e8f0' : 'none',
      flexShrink: 0
    }}>
      <div style={{ marginBottom: '2.5rem', padding: '0 0.5rem' }}>
        <h2 style={{ color: theme === 'light' ? '#1e293b' : 'white', letterSpacing: '-0.02em', fontSize: '1.25rem', fontWeight: 900 }}>GODWIN ERP</h2>
        <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '0.7rem', marginTop: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hospitality & Tour Mgmt</p>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, overflowY: 'auto' }}>

        {showHR && (
          <>
            <NavLink href="/hr/employees" icon="👔" label="HR & Attendance" active={pathname.startsWith('/hr')} theme={theme} />
            <div style={{ marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderLeft: '2px solid rgba(37, 99, 235, 0.3)', paddingLeft: '0.75rem' }}>
              {canSee('hr.employees') && <SubLink href="/hr/employees" label="Employees" active={pathname === '/hr/employees' || pathname.startsWith('/hr/employees')} theme={theme} />}
              {canSee('hr.attendance') && <SubLink href="/hr/attendance" label="Attendance" active={pathname.startsWith('/hr/attendance')} theme={theme} />}
              {canSee('hr.shifts') && <SubLink href="/hr/shifts" label="Shift Manager" active={pathname.startsWith('/hr/shifts')} theme={theme} />}
              {canSee('hr.leave') && <SubLink href="/hr/leave" label="Leave" active={pathname.startsWith('/hr/leave')} theme={theme} />}
              {canSee('hr.payroll') && <SubLink href="/hr/payroll" label="Payroll" active={pathname.startsWith('/hr/payroll')} theme={theme} />}
              {canSee('hr.reports') && <SubLink href="/hr/reports" label="Reports" active={pathname.startsWith('/hr/reports')} theme={theme} />}
            </div>
          </>
        )}

        {canSee('quotations') && (
          <NavLink href="/quotations" icon="📝" label="Quotations" active={pathname.startsWith('/quotations')} theme={theme} />
        )}

        {canSee('fleet') && (
          <NavLink href="/fleet" icon="🚗" label="Fleet Manager" active={pathname === '/fleet'} theme={theme} />
        )}

        <div style={{ margin: '1.5rem 0.5rem', borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }} />

        {canSee('userAccess') && (
          <NavLink href="/users" icon="👥" label="User Access" active={pathname === '/users'} theme={theme} />
        )}
        {canSee('settings') && (
          <NavLink href="/settings" icon="⚙️" label="Settings" active={pathname === '/settings'} theme={theme} />
        )}

      </nav>

      <style jsx>{`
        .sidebar {
          color: ${theme === 'light' ? '#374151' : '#94a3b8'};
        }
        .nav-link-hover:hover {
          background-color: ${theme === 'light' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(255, 255, 255, 0.07)'} !important;
          color: ${theme === 'light' ? '#1d4ed8' : 'white'} !important;
        }
      `}</style>
    </aside>
  );
}

function NavLink({ href, icon, label, active, theme }: { href: string; icon: string; label: string; active?: boolean; theme?: string }) {
  const isLight = theme === 'light';
  return (
    <Link href={href} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.875rem 1rem',
      borderRadius: '12px',
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
      }}>{icon}</span>
      {label}
    </Link>
  );
}

function SubLink({ href, label, active, theme }: { href: string; label: string; active?: boolean; theme?: string }) {
  const isLight = theme === 'light';
  return (
    <Link href={href} style={{
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
