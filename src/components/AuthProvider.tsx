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
  userAccess: { view: true, edit: true },
  settings: { view: true, edit: true },
};

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  hasPermission: (module: string, action?: string) => boolean;
  isMasterAdmin: boolean;
}

export const DEFAULT_USER: User = {
  id: 'admin-001',
  username: 'Godwinhotels',
  name: 'Raman Mankotia',
  email: 'mail@godwinhotels.com',
  role: 'Master Admin',
  status: 'Active',
  permissions: MASTER_ADMIN_PERMISSIONS,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  hasPermission: () => true,
  isMasterAdmin: true,
});

export const useAuth = () => useContext(AuthContext);

const BROADCAST_AUTH_CHANNEL = 'GODWIN_AUTH_BROADCAST_CHANNEL';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Multi-window & multi-tab logout function
  const logout = useCallback(() => {
    // 1. Immediately terminate user state in this window
    setUser(null);

    const now = Date.now().toString();

    // 2. Clear all local/session storages and set cross-window event keys
    try {
      localStorage.setItem('GODWIN_LOGGED_OUT', 'true');
      localStorage.setItem('GODWIN_LOGOUT_EVENT', now);
      localStorage.removeItem('GODWIN_LOGGED_IN_USER');
      localStorage.removeItem('kiosk_employee');
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

    // 4. Redirect current window to login
    router.push('/login');
  }, [router]);

  // Login function
  const login = useCallback((newUser: User) => {
    const userWithPerms = newUser.id === 'admin-001' || newUser.role === 'Master Admin'
      ? { ...newUser, permissions: MASTER_ADMIN_PERMISSIONS }
      : newUser;

    setUser(userWithPerms);

    try {
      localStorage.removeItem('GODWIN_LOGGED_OUT');
      localStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(userWithPerms));
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
    // 1. Initial storage check on load / refresh
    try {
      const isExplicitlyLoggedOut = localStorage.getItem('GODWIN_LOGGED_OUT') === 'true';

      if (isExplicitlyLoggedOut) {
        setUser(null);
        if (pathname && !['/login', '/logout'].includes(pathname) && !pathname.startsWith('/kiosk')) {
          router.push('/login');
        }
      } else {
        const saved = localStorage.getItem('GODWIN_LOGGED_IN_USER') || sessionStorage.getItem('GODWIN_LOGGED_IN_USER');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.username) {
              setUser(parsed);
            } else {
              setUser(null);
            }
          } catch {
            setUser(null);
          }
        } else {
          // If no user is logged in, redirect if on protected route
          setUser(null);
          if (pathname && !['/login', '/logout'].includes(pathname) && !pathname.startsWith('/kiosk')) {
            router.push('/login');
          }
        }
      }
    } catch (err) {
      console.warn('Storage access warning', err);
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
            if (pathname && pathname !== '/login') {
              router.push('/login');
            }
          } else if (event.data?.type === 'LOGIN' && event.data?.user) {
            setUser(event.data.user);
          }
        };
      }
    } catch {}

    // 3. Native window 'storage' event listener (fires in all other windows/tabs of this browser)
    const handleStorageChange = (e: StorageEvent) => {
      // If logout event triggered in another window/tab
      if (e.key === 'GODWIN_LOGOUT_EVENT' || e.key === 'GODWIN_LOGGED_OUT') {
        setUser(null);
        try {
          sessionStorage.clear();
          localStorage.removeItem('GODWIN_LOGGED_IN_USER');
          localStorage.removeItem('kiosk_employee');
        } catch {}
        if (pathname && pathname !== '/login') {
          router.push('/login');
        }
      } else if (e.key === 'GODWIN_LOGGED_IN_USER') {
        if (!e.newValue) {
          // User was logged out in another tab
          setUser(null);
          if (pathname && pathname !== '/login') {
            router.push('/login');
          }
        } else {
          // User logged in in another tab
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
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
    };
  }, [pathname, router]);

  // Check if current user is Master Admin
  const isMasterAdmin = !!(
    user &&
    (user.id === 'admin-001' || user.role === 'Master Admin' || user.role === 'ADMIN')
  );

  const hasPermission = useCallback((module: string, action?: string): boolean => {
    if (isMasterAdmin) return true;
    if (!user?.permissions) return false;

    const parts = module.split('.');
    let current: any = user.permissions;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') return false;
      current = current[part];
    }

    if (action) {
      return current?.[action] === true;
    }

    if (current && typeof current === 'object') {
      return Object.values(current).some(v => v === true);
    }

    return current === true;
  }, [user, isMasterAdmin]);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, isMasterAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
