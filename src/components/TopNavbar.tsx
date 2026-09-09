'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { useSidebar } from '@/components/SidebarContext';

export default function TopNavbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  if (!user || pathname === '/login' || pathname === '/logout') return null;

  return (
    <header className="no-print" style={{
      width: '100%',
      background: theme === 'light' ? '#ffffff' : '#0f172a',
      borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
      padding: '0.65rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      zIndex: 900,
      gap: '1rem'
    }}>
      {/* Left side: Sidebar Toggle & Enterprise Portal Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? "Show Sidebar Menu" : "Collapse Sidebar (Full Width Page)"}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.75rem',
            borderRadius: '9px',
            border: isCollapsed ? '1px solid #3b82f6' : (theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155'),
            background: isCollapsed 
              ? (theme === 'light' ? '#eff6ff' : 'rgba(59, 130, 246, 0.2)') 
              : (theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.06)'),
            color: isCollapsed ? '#2563eb' : (theme === 'light' ? '#334155' : '#e2e8f0'),
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 700,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1rem' }}>{isCollapsed ? '📖' : '📐'}</span>
          <span>{isCollapsed ? 'Show Menu' : 'Full Page'}</span>
        </button>

        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '9px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          flexShrink: 0
        }}>
          👑
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#f8fafc', letterSpacing: '-0.01em' }}>
            Hotel Grand Godwin &amp; Godwin Deluxe
          </h3>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Executive Enterprise Portal • Arakshan Road, New Delhi
          </p>
        </div>
      </div>

      {/* Right side: Controls (Theme Toggle, Fullscreen, User, Logout) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        
        {/* Dark Mode / Light Mode Button in Header */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.85rem',
            borderRadius: '9px',
            border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155',
            background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
            color: theme === 'light' ? '#1e293b' : '#f8fafc',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 700,
            transition: 'all 0.15s ease',
            boxShadow: theme === 'light' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
          }}
        >
          <span style={{ fontSize: '1rem' }}>{theme === 'light' ? '🌙' : '☀️'}</span>
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen' : 'Toggle Full Screen'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.75rem',
            borderRadius: '9px',
            border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155',
            background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
            color: theme === 'light' ? '#475569' : '#cbd5e1',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 700,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>{isFullscreen ? '🗗' : '⛶'}</span>
          <span>{isFullscreen ? 'Exit' : 'Full Screen'}</span>
        </button>

        {/* Online status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: theme === 'light' ? '#f0fdf4' : 'rgba(16, 185, 129, 0.15)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid #10b981' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.03em' }}>ONLINE</span>
        </div>

        {/* User profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>
              {user?.name || 'Godwin Admin'}
            </p>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {user?.role || 'Root Admin'}
            </p>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900, color: 'white', boxShadow: '0 3px 8px rgba(217, 119, 6, 0.25)' }}>
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'GH'}
          </div>
        </div>

        <div style={{ width: '1px', height: '24px', background: theme === 'light' ? '#cbd5e1' : '#334155' }} />

        {/* Logout */}
        <button
          onClick={logout}
          title="Log Out of Godwin ERP Executive Session"
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '9px',
            padding: '0.5rem 1.1rem',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 3px 10px rgba(239, 68, 68, 0.3)',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
        >
          <span>🚪</span> Log Out
        </button>
      </div>
    </header>
  );
}
