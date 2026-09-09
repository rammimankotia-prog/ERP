'use client';

import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';

interface PermissionGuardProps {
  /** Dot-separated module path, e.g. 'hr.leave', 'hr.payroll', 'quotations' */
  module: string;
  /** Specific action, e.g. 'view', 'edit', 'approve', 'delete' */
  action?: string;
  /** If true, renders null instead of Access Denied card */
  silent?: boolean;
  children: React.ReactNode;
}

export default function PermissionGuard({ module, action = 'view', silent = false, children }: PermissionGuardProps) {
  const { hasPermission, isMasterAdmin } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (isMasterAdmin || hasPermission(module, action)) {
    return <>{children}</>;
  }

  if (silent) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '1.5rem',
      padding: '3rem',
      textAlign: 'center',
    }}>
      <div style={{
        width: 90,
        height: 90,
        borderRadius: '50%',
        background: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2.5rem',
      }}>
        🔒
      </div>
      <div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: isLight ? '#1e293b' : '#f1f5f9',
          marginBottom: '0.5rem',
        }}>
          Access Restricted
        </h2>
        <p style={{
          color: isLight ? '#64748b' : '#94a3b8',
          fontSize: '0.95rem',
          maxWidth: 380,
          lineHeight: 1.6,
        }}>
          You don&apos;t have permission to access this section. Contact your Administrator to request access.
        </p>
      </div>
      <div style={{
        padding: '0.6rem 1.25rem',
        background: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.12)',
        borderRadius: '999px',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#ef4444',
        letterSpacing: '0.03em',
      }}>
        Required: {module}{action ? ` → ${action}` : ''}
      </div>
    </div>
  );
}
