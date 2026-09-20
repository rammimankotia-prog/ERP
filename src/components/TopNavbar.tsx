'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { useSidebar } from '@/components/SidebarContext';

export default function TopNavbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deployState, setDeployState] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [deployMsg, setDeployMsg] = useState('');

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const cleanPath = (pathname || '').split('?')[0].replace(/\/$/, '') || '/';
  if (!user || cleanPath.startsWith('/login') || cleanPath.startsWith('/logout') || cleanPath.startsWith('/admin/login') || cleanPath.startsWith('/kiosk')) return null;

  const isMasterAdmin =
    user?.role === 'Master Admin' ||
    user?.role === 'ADMIN' ||
    user?.role === 'Manager' ||
    user?.id === 'admin-001' ||
    user?.id === 'admin-002' ||
    user?.id === 'admin-003' ||
    user?.id === 'admin-004' ||
    (user?.email && ['mail@godwinhotels.com', 'generalmanager@godwinhotels.com', 'ksareen@godwinhotels.com', 'vsareen@godwinhotels.com'].includes(user.email.toLowerCase()));

  const handleActivateServer = async () => {
    if (deployState === 'deploying') return;
    const ok = window.confirm(
      '🚀 Live Server Par Activate Karein?\n\nIsse live server (grandgodwin.com) par latest GitHub code pull hoga, build banega aur PM2 restart hoga bina kisi data loss ke.\n\nKya aap continue karna chahte hain?'
    );
    if (!ok) return;

    setDeployState('deploying');
    setDeployMsg('Deploying...');

    try {
      const res = await fetch('/api/webhook/deploy?manual=true', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDeployState('success');
        setDeployMsg('Server Updated!');
        setTimeout(() => {
          setDeployState('idle');
          setDeployMsg('');
        }, 8000);
      } else {
        setDeployState('error');
        setDeployMsg('Failed: ' + (data.message || data.error || 'Deploy error'));
        setTimeout(() => setDeployState('idle'), 8000);
      }
    } catch {
      setDeployState('error');
      setDeployMsg('Network Error');
      setTimeout(() => setDeployState('idle'), 5000);
    }
  };

  const isLight = theme === 'light';

  return (
    <header className="top-navbar no-print">
      {/* Left side: Mobile Hamburger / Desktop Toggle & Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: '1 1 auto' }}>
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="mobile-hamburger-btn"
          title="Open Navigation Menu"
          aria-label="Toggle navigation drawer"
          style={{
            display: 'none', // Overridden by media query to flex
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            minWidth: '40px',
            minHeight: '40px',
            borderRadius: '9px',
            border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
            background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
            color: isLight ? '#1e293b' : '#f8fafc',
            cursor: 'pointer',
            fontSize: '1.35rem',
            padding: 0,
            flexShrink: 0,
            touchAction: 'manipulation',
          }}
        >
          ☰
        </button>

        {/* Desktop Sidebar Toggle (Full Width Page) */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="desktop-sidebar-btn"
          title={isCollapsed ? "Show Sidebar Menu" : "Collapse Sidebar (Full Width Page)"}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.75rem',
            borderRadius: '9px',
            border: isCollapsed ? '1px solid #3b82f6' : (isLight ? '1px solid #cbd5e1' : '1px solid #334155'),
            background: isCollapsed
              ? (isLight ? '#eff6ff' : 'rgba(59, 130, 246, 0.2)')
              : (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.06)'),
            color: isCollapsed ? '#2563eb' : (isLight ? '#334155' : '#e2e8f0'),
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 700,
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '1rem' }}>{isCollapsed ? '📖' : '📐'}</span>
          <span>{isCollapsed ? 'Show Menu' : 'Full Page'}</span>
        </button>

      </div>

      {/* Right side: Controls (Theme Toggle, Fullscreen, User, Logout) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>

        {/* Live Server Activate Button (for Master Admins) */}
        {isMasterAdmin && (
          <button
            type="button"
            onClick={handleActivateServer}
            disabled={deployState === 'deploying'}
            title="Click to pull latest GitHub code and restart server on grandgodwin.com"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.42rem 0.8rem',
              minHeight: '36px',
              borderRadius: '9px',
              border: deployState === 'success' 
                ? '1px solid #10b981' 
                : deployState === 'error'
                ? '1px solid #ef4444'
                : '1px solid #2563eb',
              background: deployState === 'success'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : deployState === 'error'
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : deployState === 'deploying'
                ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: 'white',
              cursor: deployState === 'deploying' ? 'wait' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: '0.95rem' }}>
              {deployState === 'deploying' ? '⏳' : deployState === 'success' ? '✅' : deployState === 'error' ? '⚠️' : '🚀'}
            </span>
            <span className="hide-on-mobile">
              {deployState === 'deploying'
                ? 'Activating Server...'
                : deployState === 'success'
                ? (deployMsg || 'Server Updated!')
                : deployState === 'error'
                ? (deployMsg || 'Failed!')
                : 'Live Server Par Activate Karein'}
            </span>
            <span className="show-on-mobile" style={{ display: 'none' }}>
              {deployState === 'deploying' ? 'Syncing...' : deployState === 'success' ? 'Done' : 'Activate'}
            </span>
          </button>
        )}

        {/* Dark Mode / Light Mode Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.65rem',
            minHeight: '36px',
            minWidth: '36px',
            borderRadius: '9px',
            border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
            background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
            color: isLight ? '#1e293b' : '#f8fafc',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 700,
            transition: 'all 0.15s ease',
            boxShadow: isLight ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '1rem' }}>{isLight ? '🌙' : '☀️'}</span>
          <span className="hide-on-mobile">{isLight ? 'Dark' : 'Light'}</span>
        </button>

        {/* Fullscreen Toggle Button (Desktop only) */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen' : 'Toggle Full Screen'}
          className="hide-on-mobile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.75rem',
            minHeight: '36px',
            borderRadius: '9px',
            border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
            background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
            color: isLight ? '#475569' : '#cbd5e1',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 700,
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>{isFullscreen ? '🗗' : '⛶'}</span>
          <span>{isFullscreen ? 'Exit' : 'Full'}</span>
        </button>

        {/* User profile + Online Indicator (Compact on Mobile) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <div className="hide-on-mobile" style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: isLight ? '#1e293b' : '#f8fafc' }}>
              {user?.name || 'Godwin Admin'}
            </p>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {user?.role || 'Root Admin'}
            </p>
          </div>
          
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              title={`${user?.name || 'Godwin Admin'} (${user?.role || 'Root Admin'})`}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 900,
                color: 'white',
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
              }}
            >
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'GH'}
            </div>
            {/* Integrated Online Pulse Dot */}
            <span
              title="System Online"
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10b981',
                border: isLight ? '2px solid #ffffff' : '2px solid #0f172a',
                boxShadow: '0 0 5px rgba(16, 185, 129, 0.9)'
              }}
            />
          </div>
        </div>

        <div className="hide-on-mobile" style={{ width: '1px', height: '24px', background: isLight ? '#cbd5e1' : '#334155' }} />

        {/* Logout */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            logout();
          }}
          title="Log Out of Godwin ERP"
          aria-label="Log out"
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '9px',
            padding: '0.45rem 0.75rem',
            minHeight: '36px',
            minWidth: '36px',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '1rem' }}>🚪</span>
          <span className="hide-on-mobile">Log Out</span>
        </button>
      </div>

      <style jsx>{`
        .top-navbar {
          width: 100%;
          background: ${isLight ? '#ffffff' : '#0f172a'};
          border-bottom: 1px solid ${isLight ? '#e2e8f0' : '#1e293b'};
          padding: 0.65rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          z-index: 900;
          gap: 0.75rem;
        }

        @media (max-width: 1024px) {
          .desktop-sidebar-btn {
            display: none !important;
          }
          .mobile-hamburger-btn {
            display: flex !important;
          }
        }

        @media (max-width: 768px) {
          .top-navbar {
            padding: 0.5rem 0.65rem !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
          .show-on-mobile {
            display: inline !important;
          }
        }
      `}</style>
    </header>
  );
}
