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
  if (!user || cleanPath.startsWith('/login') || cleanPath.startsWith('/logout')) return null;

  const isLight = theme === 'light';

  return (
    <header className="top-navbar no-print">
      {/* Left side: Mobile Hamburger / Desktop Toggle & Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="mobile-hamburger-btn"
          title="Open Navigation Menu"
          aria-label="Toggle navigation drawer"
          style={{
            display: 'none', // Overridden by media query
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '9px',
            border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
            background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
            color: isLight ? '#1e293b' : '#f8fafc',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: 0,
            flexShrink: 0,
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

        {/* Brand Icon */}
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

        {/* Brand Text */}
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <h3 className="brand-title" style={{
            margin: 0,
            fontSize: '0.92rem',
            fontWeight: 900,
            color: isLight ? '#0f172a' : '#f8fafc',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            <span className="brand-full">Hotel Grand Godwin &amp; Godwin Deluxe</span>
            <span className="brand-compact">Godwin ERP</span>
          </h3>
          <p className="brand-subtitle" style={{
            margin: 0,
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            Executive Enterprise Portal • New Delhi
          </p>
        </div>
      </div>

      {/* Right side: Controls (Theme Toggle, Fullscreen, User, Logout) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        
        {/* Dark Mode / Light Mode Button */}
        <button
          onClick={toggleTheme}
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.75rem',
            minHeight: '36px',
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

        {/* Online status indicator */}
        <div
          title="Server Status: Online"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.15)',
            padding: '0.35rem 0.65rem',
            minHeight: '34px',
            borderRadius: '20px',
            border: '1px solid #10b981',
            flexShrink: 0
          }}
        >
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#10b981',
            display: 'inline-block',
            boxShadow: '0 0 6px #10b981'
          }} />
          <span className="hide-on-mobile" style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#10b981',
            letterSpacing: '0.03em'
          }}>
            ONLINE
          </span>
        </div>

        {/* User profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <div className="hide-on-mobile" style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: isLight ? '#1e293b' : '#f8fafc' }}>
              {user?.name || 'Godwin Admin'}
            </p>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {user?.role || 'Root Admin'}
            </p>
          </div>
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
              boxShadow: '0 3px 8px rgba(217, 119, 6, 0.25)',
              flexShrink: 0
            }}
          >
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'GH'}
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
            padding: '0.45rem 0.85rem',
            minHeight: '36px',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            boxShadow: '0 3px 10px rgba(239, 68, 68, 0.3)',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
        >
          <span>🚪</span>
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

        .brand-compact {
          display: none;
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
            padding: 0.5rem 0.75rem;
          }
          .brand-full {
            display: none;
          }
          .brand-compact {
            display: inline;
          }
          .brand-subtitle {
            display: none !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
