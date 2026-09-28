'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 1. Authenticated User Redirection: Only Master Admins access ERP
    if (user) {
      const isMaster = 
        user.role === 'Master Admin' || 
        user.role === 'ADMIN' ||
        ['admin-001', 'admin-002', 'admin-003', 'admin-004'].includes(user.id) ||
        ['mail@godwinhotels.com', 'generalmanager@godwinhotels.com', 'ksareen@godwinhotels.com', 'vsareen@godwinhotels.com'].includes((user.email || '').toLowerCase());

      if (isMaster) {
        try { router.replace('/hr/employees'); } catch {}
        try { window.location.replace('/hr/employees'); } catch {}
      } else {
        try { router.replace('/kiosk'); } catch {}
        try { window.location.replace('/kiosk'); } catch {}
      }
      return;
    }

    // 2. Staff Kiosk Session Check
    try {
      const savedKiosk = localStorage.getItem('kiosk_employee') || sessionStorage.getItem('kiosk_employee');
      if (savedKiosk) {
        const emp = JSON.parse(savedKiosk);
        if (emp && emp.id && (!emp.expiresAt || emp.expiresAt >= Date.now())) {
          if (emp.loginRole === 'security') {
            try { router.replace('/kiosk'); } catch {}
            try { window.location.replace('/kiosk'); } catch {}
          } else {
            try { router.replace('/kiosk/dashboard'); } catch {}
            try { window.location.replace('/kiosk/dashboard'); } catch {}
          }
          return;
        }
      }
    } catch {}

    // 3. Unauthenticated Visitor -> Staff Login Portal
    try {
      router.replace('/login');
    } catch {}
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        try { window.location.replace('/login'); } catch { window.location.href = '/login'; }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [user, router]);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#94a3b8',
      fontFamily: 'system-ui, sans-serif',
      padding: '1.5rem',
      textAlign: 'center'
    }}>
      <div style={{ maxWidth: '320px', width: '100%' }}>
        <div style={{
          width: '38px',
          height: '38px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: '#d97706',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem auto'
        }} />
        <p style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', color: '#cbd5e1', marginBottom: '1.25rem' }}>
          CONNECTING TO GODWIN ERP...
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <a
            href="/login"
            style={{
              display: 'block',
              padding: '0.7rem 1.25rem',
              background: '#d97706',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.9rem',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)'
            }}
          >
            Staff Portal Login ➔
          </a>
          <a
            href="/admin/login"
            style={{
              color: '#38bdf8',
              fontSize: '0.8rem',
              textDecoration: 'underline',
              padding: '0.4rem'
            }}
          >
            Executive / Admin Login
          </a>
        </div>
      </div>
      <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
