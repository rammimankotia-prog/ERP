'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';

export default function TopNavbar() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();

  if (!user || pathname === '/login' || pathname === '/logout') return null;

  return (
    <header className="no-print" style={{
      width: '100%',
      background: theme === 'light' ? '#ffffff' : '#0f172a',
      borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
      padding: '0.75rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      zIndex: 900
    }}>
      {/* Left side: Enterprise Portal Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem'
        }}>
          👑
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#f8fafc', letterSpacing: '-0.01em' }}>
            Hotel Grand Godwin &amp; Godwin Deluxe
          </h3>
          <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Executive Enterprise Portal • Arakshan Road, New Delhi
          </p>
        </div>
      </div>

      {/* Right side: Session Status, Profile, and Logout on the Top Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: theme === 'light' ? '#f0fdf4' : 'rgba(16, 185, 129, 0.15)', padding: '0.4rem 0.85rem', borderRadius: '20px', border: '1px solid #10b981' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.03em' }}>ONLINE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>
              {user?.name || 'Godwin Admin'}
            </p>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {user?.role || 'Root Admin'}
            </p>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, color: 'white', boxShadow: '0 4px 10px rgba(217, 119, 6, 0.3)' }}>
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'GH'}
          </div>
        </div>

        <div style={{ width: '1px', height: '28px', background: theme === 'light' ? '#cbd5e1' : '#334155' }} />

        <button
          onClick={logout}
          title="Log Out of Godwin ERP Executive Session"
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '0.65rem 1.35rem',
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          <span>🚪</span> Log Out
        </button>
      </div>
    </header>
  );
}
