'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Instantly clear session credentials
    try {
      localStorage.removeItem('GODWIN_LOGGED_IN_USER');
      sessionStorage.removeItem('GODWIN_LOGGED_IN_USER');
    } catch (e) {
      console.error('Error clearing session storage:', e);
    }
    
    if (logout) {
      logout();
    } else {
      router.push('/login');
    }
  }, [logout, router]);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(circle at 50% 10%, #1e293b 0%, #0f172a 60%, #020617 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.25rem',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        border: '4px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: '#ef4444',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.35rem', fontWeight: 900, color: '#f8fafc' }}>
          🚪 Signing Out...
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Terminating Executive Session &amp; Locking Terminal
        </p>
      </div>
      <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
