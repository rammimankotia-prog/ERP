'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface UserPermissions {
  hr?: {
    employees?: { view?: boolean; edit?: boolean; delete?: boolean };
    attendance?: { view?: boolean; edit?: boolean };
    shifts?: { view?: boolean; edit?: boolean };
    leave?: { view?: boolean; approve?: boolean };
    payroll?: { view?: boolean; edit?: boolean };
    reports?: { view?: boolean };
  };
  kiosk?: { access?: boolean };
  userAccess?: { view?: boolean; edit?: boolean };
  settings?: { view?: boolean; edit?: boolean };
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions?: UserPermissions;
}

export const MASTER_ADMIN_PERMISSIONS: UserPermissions = {
  hr: {
    employees: { view: true, edit: true, delete: true },
    attendance: { view: true, edit: true },
    shifts: { view: true, edit: true },
    leave: { view: true, approve: true },
    payroll: { view: true, edit: true },
    reports: { view: true },
  },
  kiosk: { access: true },
  userAccess: { view: true, edit: true },
  settings: { view: true, edit: true },
};

interface AuthContextType {
  user: User | null;
  login: (user: User, rememberMe?: boolean) => void;
  logout: (redirectUrl?: string) => void;
  hasPermission: (module: string, action?: string) => boolean;
  isMasterAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  hasPermission: () => false,
  isMasterAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

const BROADCAST_AUTH_CHANNEL = 'GODWIN_AUTH_BROADCAST_CHANNEL';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Multi-window & multi-tab logout function
  const logout = useCallback((redirectUrl?: string) => {
    // 1. Immediately terminate user state in this window
    setUser(null);

    const now = Date.now().toString();

    // 2. Clear all local/session storages and set cross-window event keys
    try {
      localStorage.setItem('GODWIN_LOGGED_OUT', 'true');
      localStorage.setItem('GODWIN_LOGOUT_EVENT', now);
      localStorage.removeItem('GODWIN_LOGGED_IN_USER');
      localStorage.removeItem('kiosk_employee');
      localStorage.removeItem('GODWIN_REMEMBER_30DAYS');
      sessionStorage.clear();

      // Clear any session cookies across paths
      document.cookie = 'GODWIN_LOGGED_IN_USER=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      document.cookie = 'kiosk_employee=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    } catch (e) {
      console.warn('Error clearing storage on logout', e);
    }

    // 3. Broadcast instant logout signal to all other open tabs/windows
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(BROADCAST_AUTH_CHANNEL);
        bc.postMessage({ type: 'LOGOUT', timestamp: now });
        bc.close();
      }
    } catch {}

    // 4. Determine smart destination: staff/kiosk users go to /login, admin routes go to /admin/login
    const cleanPath = (pathname || '').split('?')[0].replace(/\/$/, '') || '/';
    const isStaffOrKiosk =
      cleanPath.startsWith('/kiosk') ||
      cleanPath.startsWith('/login');
    const defaultDest = isStaffOrKiosk ? '/login?logout=true' : '/admin/login';
    const destination = redirectUrl || defaultDest;

    if (typeof window !== 'undefined') {
      window.location.href = destination;
    } else {
      router.push(destination);
    }
  }, [pathname, router]);

  // Login function
  const login = useCallback((newUser: User, rememberMe: boolean = true) => {
    const userWithPerms = newUser.id === 'admin-001' || newUser.role === 'Master Admin'
      ? { ...newUser, permissions: MASTER_ADMIN_PERMISSIONS }
      : newUser;

    setUser(userWithPerms);

    try {
      localStorage.removeItem('GODWIN_LOGGED_OUT');
      if (rememberMe) {
        localStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(userWithPerms));
      } else {
        sessionStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(userWithPerms));
      }
      localStorage.setItem('GODWIN_LOGIN_EVENT', Date.now().toString());

      // Broadcast login to all other open tabs/windows
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(BROADCAST_AUTH_CHANNEL);
        bc.postMessage({ type: 'LOGIN', user: userWithPerms, timestamp: Date.now() });
        bc.close();
      }
    } catch {}
  }, []);

  // Synchronize authentication across all windows & tabs
  useEffect(() => {
    const cleanPath = (pathname || '').split('?')[0].replace(/\/$/, '') || '/';
    const isPublic = 
      cleanPath === '/' ||
      cleanPath === '/login' || 
      cleanPath.startsWith('/login/') ||
      cleanPath === '/admin/login' ||
      cleanPath.startsWith('/admin/login') ||
      cleanPath === '/logout' || 
      cleanPath.startsWith('/logout/') ||
      cleanPath === '/kiosk' ||
      cleanPath.startsWith('/kiosk/');

    // Decide where to redirect unauthenticated users based on which portal they were on
    const getLoginUrl = () => {
      // If they were on an admin-area page, send to admin login
      if (
        cleanPath.startsWith('/admin') ||
        cleanPath.startsWith('/hr') ||
        cleanPath.startsWith('/users') ||
        cleanPath.startsWith('/settings') ||
        cleanPath.startsWith('/operations')
      ) {
        return '/admin/login';
      }
      return '/login';
    };

    const redirectToLogin = () => {
      const url = getLoginUrl();
      if (typeof window !== 'undefined') {
        try {
          router.replace(url);
        } catch {}
        try {
          window.location.replace(url);
        } catch {
          window.location.href = url;
        }
      } else {
        router.push(url);
      }
    };

    // 1. Initial storage check on load / refresh
    try {
      const isExplicitlyLoggedOut = localStorage.getItem('GODWIN_LOGGED_OUT') === 'true';

      if (isExplicitlyLoggedOut) {
        setUser(null);
        if (!isPublic) redirectToLogin();
      } else {
        const saved = localStorage.getItem('GODWIN_LOGGED_IN_USER') || sessionStorage.getItem('GODWIN_LOGGED_IN_USER');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const isMaster = parsed && (
              parsed.role === 'Master Admin' ||
              parsed.role === 'ADMIN' ||
              ['admin-001', 'admin-002', 'admin-003', 'admin-004'].includes(parsed.id) ||
              ['mail@godwinhotels.com', 'generalmanager@godwinhotels.com', 'ksareen@godwinhotels.com', 'vsareen@godwinhotels.com'].includes((parsed.email || '').toLowerCase())
            );
            if (isMaster && parsed.username && parsed.id) {
              setUser(parsed);
            } else {
              // Regular employees have no ERP access
              setUser(null);
              if (!isPublic) redirectToLogin();
            }
          } catch {
            setUser(null);
            if (!isPublic) redirectToLogin();
          }
        } else {
          setUser(null);
          if (!isPublic) redirectToLogin();
        }
      }
    } catch (err) {
      console.warn('Storage access warning', err);
    } finally {
      setAuthChecked(true);
    }

    // 2. BroadcastChannel listener for all modern browsers & web workers
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel(BROADCAST_AUTH_CHANNEL);
        bc.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT') {
            setUser(null);
            try {
              sessionStorage.clear();
              localStorage.removeItem('GODWIN_LOGGED_IN_USER');
              localStorage.removeItem('kiosk_employee');
            } catch {}
            if (!isPublic) redirectToLogin();
          } else if (event.data?.type === 'FORCE_LOGOUT_USER') {
            const tId = event.data.targetId;
            const tEmail = event.data.targetEmail?.toLowerCase();
            const tUser = event.data.targetUsername?.toLowerCase();
            const currentSaved = localStorage.getItem('GODWIN_LOGGED_IN_USER') || sessionStorage.getItem('GODWIN_LOGGED_IN_USER');
            let currentUser: any = user;
            if (!currentUser && currentSaved) {
              try { currentUser = JSON.parse(currentSaved); } catch {}
            }
            if (
              currentUser && 
              (currentUser.id === tId || 
               (currentUser.email && currentUser.email.toLowerCase() === tEmail) || 
               (currentUser.username && currentUser.username.toLowerCase() === tUser))
            ) {
              setUser(null);
              try {
                sessionStorage.clear();
                localStorage.removeItem('GODWIN_LOGGED_IN_USER');
                localStorage.removeItem('kiosk_employee');
                localStorage.setItem('GODWIN_LOGGED_OUT', 'true');
                document.cookie = 'GODWIN_LOGGED_IN_USER=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
              } catch {}
              if (typeof window !== 'undefined') {
                window.location.href = '/admin/login?deactivated=true';
              }
            }
          } else if (event.data?.type === 'LOGIN' && event.data?.user) {
            setUser(event.data.user);
          }
        };
      }
    } catch {}

    // 3. Real-time active status verification across the platform
    const verifyUserActiveStatus = async () => {
      const currentSaved = localStorage.getItem('GODWIN_LOGGED_IN_USER') || sessionStorage.getItem('GODWIN_LOGGED_IN_USER');
      if (!currentSaved) return;
      try {
        const u = JSON.parse(currentSaved);
        if (!u?.id) return;
        const res = await fetch(
          `/api/auth/session-check?userId=${encodeURIComponent(u.id)}&email=${encodeURIComponent(u.email || '')}&username=${encodeURIComponent(u.username || '')}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.active === false && (data.reason === 'USER_INACTIVE' || data.reason === 'EMPLOYEE_INACTIVE' || data.reason === 'SESSION_REVOKED')) {
            setUser(null);
            try {
              sessionStorage.clear();
              localStorage.removeItem('GODWIN_LOGGED_IN_USER');
              localStorage.removeItem('kiosk_employee');
              localStorage.setItem('GODWIN_LOGGED_OUT', 'true');
              document.cookie = 'GODWIN_LOGGED_IN_USER=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            } catch {}
            if (typeof window !== 'undefined') {
              window.location.href = '/admin/login?deactivated=true';
            }
          }
        }
      } catch {}
    };

    // Check immediately on route change & on window focus
    verifyUserActiveStatus();
    const handleFocus = () => verifyUserActiveStatus();
    window.addEventListener('focus', handleFocus);

    // Periodic heartbeat every 10 seconds
    const statusTimer = setInterval(verifyUserActiveStatus, 10000);

    // 4. Native window 'storage' event listener (fires in all other windows/tabs of this browser)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'GODWIN_DEACTIVATED_USER' && e.newValue) {
        try {
          const target = JSON.parse(e.newValue);
          const currentSaved = localStorage.getItem('GODWIN_LOGGED_IN_USER') || sessionStorage.getItem('GODWIN_LOGGED_IN_USER');
          if (currentSaved) {
            const u = JSON.parse(currentSaved);
            if (u.id === target.id || u.email?.toLowerCase() === target.email?.toLowerCase() || u.username?.toLowerCase() === target.username?.toLowerCase()) {
              setUser(null);
              sessionStorage.clear();
              localStorage.removeItem('GODWIN_LOGGED_IN_USER');
              localStorage.removeItem('kiosk_employee');
              localStorage.setItem('GODWIN_LOGGED_OUT', 'true');
              window.location.href = '/admin/login?deactivated=true';
            }
          }
        } catch {}
      } else if (e.key === 'GODWIN_LOGOUT_EVENT' || e.key === 'GODWIN_LOGGED_OUT') {
        setUser(null);
        try {
          sessionStorage.clear();
          localStorage.removeItem('GODWIN_LOGGED_IN_USER');
          localStorage.removeItem('kiosk_employee');
        } catch {}
        if (!isPublic) redirectToLogin();
      } else if (e.key === 'GODWIN_LOGGED_IN_USER') {
        if (!e.newValue) {
          setUser(null);
          if (!isPublic) redirectToLogin();
        } else {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed && parsed.username) {
              setUser(parsed);
            }
          } catch {}
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(statusTimer);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, [pathname, router]);


  // Check if current user is an authorized Master Admin
  const isMasterAdmin = !!(
    user &&
    (
      user.role === 'Master Admin' ||
      user.role === 'ADMIN' ||
      user.id === 'admin-001' ||
      user.id === 'admin-002' ||
      user.id === 'admin-003' ||
      user.id === 'admin-004' ||
      ['mail@godwinhotels.com', 'generalmanager@godwinhotels.com', 'ksareen@godwinhotels.com', 'vsareen@godwinhotels.com'].includes((user.email || '').toLowerCase())
    )
  );

  // Strict RBAC route enforcement: ONLY Master Admins can access administrative ERP routes
  useEffect(() => {
    if (!authChecked) return;
    const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    const cleanPath = (currentPath || '').split('?')[0].replace(/\/$/, '') || '/';

    const isAdminRoute = 
      cleanPath.startsWith('/hr') || 
      cleanPath.startsWith('/users') || 
      cleanPath.startsWith('/settings') || 
      cleanPath.startsWith('/operations');

    if (isAdminRoute) {
      if (!user || !isMasterAdmin) {
        if (typeof window !== 'undefined') {
          window.location.href = '/admin/login';
        } else {
          router.push('/admin/login');
        }
      }
    } else if (user && !isMasterAdmin) {
      // Non-admin logged in trying to access non-kiosk pages
      if (!cleanPath.startsWith('/kiosk') && !cleanPath.startsWith('/login') && !cleanPath.startsWith('/logout') && cleanPath !== '/') {
        if (typeof window !== 'undefined') {
          window.location.href = '/kiosk';
        } else {
          router.push('/kiosk');
        }
      }
    }
  }, [user, pathname, router, authChecked, isMasterAdmin]);

  const hasPermission = useCallback((module: string, action?: string): boolean => {
    if (isMasterAdmin) return true;
    return false;
  }, [isMasterAdmin]);

  const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  const cleanPath = (currentPath || '').split('?')[0].replace(/\/$/, '') || '/';
  const isPublicRoute = 
    cleanPath === '/' ||
    cleanPath === '/login' || 
    cleanPath.startsWith('/login') || 
    cleanPath === '/admin/login' || 
    cleanPath.startsWith('/admin/login') || 
    cleanPath === '/logout' || 
    cleanPath.startsWith('/logout') || 
    cleanPath === '/kiosk' || 
    cleanPath.startsWith('/kiosk');

  const defaultRedirectUrl = '/admin/login';

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, isMasterAdmin }}>
      {/* Public routes (/, login, logout, kiosk) are always rendered instantly without blocking */}
      {isPublicRoute ? (
        children
      ) : !authChecked ? (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
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
            <p style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em' }}>VERIFYING SESSION...</p>
          </div>
          <style jsx>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      ) : !user || !isMasterAdmin ? (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '2.5rem' }}>🔒</span>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Administrative Access Required</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', maxWidth: '360px' }}>
            This section is restricted to authorized Executive Administrators only. Employees can only access the Punch Terminal.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem', width: '100%', maxWidth: '280px' }}>
            <a
              href="/admin/login"
              style={{
                display: 'block',
                padding: '0.75rem 1.25rem',
                background: '#d97706',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)'
              }}
            >
              Executive Admin Login ➔
            </a>
            <a
              href="/kiosk"
              style={{
                display: 'block',
                padding: '0.65rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.88rem',
                textDecoration: 'none',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              Staff Punch Terminal ➔
            </a>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
