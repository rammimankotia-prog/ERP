'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  if (!user || pathname === '/login' || pathname === '/logout') return null;

  return (
    <aside className="sidebar no-print" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '1.5rem 1.25rem', background: theme === 'light' ? '#f8fafc' : '#0f172a', borderRight: theme === 'light' ? '1px solid #e2e8f0' : 'none' }}>
      <div style={{ marginBottom: '2.5rem', padding: '0 0.5rem' }}>
        <h2 style={{ color: theme === 'light' ? '#1e293b' : 'white', letterSpacing: '-0.02em', fontSize: '1.25rem', fontWeight: 900 }}>GODWIN ERP</h2>
        <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '0.7rem', marginTop: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hospitality & Tour Mgmt</p>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
        <NavLink href="/" icon="📊" label="Dashboard" active={pathname === '/'} theme={theme} />
        <NavLink href="/quotations" icon="📝" label="Quotations" active={pathname.startsWith('/quotations')} theme={theme} />
        <NavLink href="/inventory" icon="🏨" label="Room Inventory" active={pathname === '/inventory'} theme={theme} />
        <NavLink href="/fleet" icon="🚗" label="Fleet Manager" active={pathname === '/fleet'} theme={theme} />
        <NavLink href="/itinerary" icon="🗺️" label="Itinerary Builder" active={pathname === '/itinerary'} theme={theme} />
        <NavLink href="/finance" icon="💰" label="Financial Ledger" active={pathname === '/finance'} theme={theme} />
        <NavLink href="/finance/fx" icon="💱" label="FX Terminal" active={pathname === '/finance/fx'} theme={theme} />
        
        <div style={{ margin: '1.5rem 0.5rem', borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }} />
        
        <NavLink href="/agent" icon="🤝" label="Agent Portal" active={pathname === '/agent'} theme={theme} />
        <NavLink href="/leads" icon="🧠" label="AI Leads" active={pathname === '/leads'} theme={theme} />
        <NavLink href="/reputation" icon="🛡️" label="ORM & Reputation" active={pathname === '/reputation'} theme={theme} />
        <NavLink href="/users" icon="👥" label="User Access" active={pathname === '/users'} theme={theme} />
        <NavLink href="/settings" icon="⚙️" label="Settings" active={pathname === '/settings'} theme={theme} />
        <NavLink href="/tours" icon="🌍" label="Tour Packages" active={pathname === '/tours'} theme={theme} />
        <NavLink href="/reports" icon="📈" label="Reports" active={pathname === '/reports'} theme={theme} />
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button 
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.875rem 1rem',
            borderRadius: '12px',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
            background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
            color: theme === 'light' ? '#1e293b' : 'white',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            transition: 'all 0.2s',
            boxShadow: theme === 'light' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>{theme === 'light' ? '🌙' : '☀️'}</span>
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>

        <div style={{ paddingTop: '1.25rem', borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'GH'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ color: theme === 'light' ? '#1e293b' : 'white', fontSize: '0.85rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.name || 'Godwin Admin'}</p>
              <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>{user?.role || 'Admin'}</p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Log out of Godwin ERP Admin Session"
            style={{
              width: '100%',
              background: theme === 'light' ? '#fee2e2' : 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: theme === 'light' ? '1px solid #fca5a5' : '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '0.65rem 1rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.1)'
            }}
          >
            <span>🚪</span> Admin Log Out
          </button>
        </div>
      </div>

      <style jsx>{`
        .sidebar {
          color: ${theme === 'light' ? '#64748b' : '#94a3b8'};
        }
        .nav-link-hover:hover {
          background-color: ${theme === 'light' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.05)'} !important;
          color: ${theme === 'light' ? '#2563eb' : 'white'} !important;
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
      color: active ? (isLight ? '#2563eb' : '#fff') : (isLight ? '#64748b' : '#94a3b8'),
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
