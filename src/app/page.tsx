'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/hr/employees');
    } else {
      router.replace('/login');
    }
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
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: '#d97706',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 0.75rem auto'
        }} />
        <p style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>LOADING GODWIN ERP...</p>
      </div>
      <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
