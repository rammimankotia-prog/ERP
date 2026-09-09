'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Full permissions structure
export interface UserPermissions {
  hr?: {
    employees?: { view?: boolean; edit?: boolean; delete?: boolean };
    attendance?: { view?: boolean; edit?: boolean };
    shifts?: { view?: boolean; edit?: boolean };
    leave?: { view?: boolean; approve?: boolean };
    payroll?: { view?: boolean; edit?: boolean };
    reports?: { view?: boolean };
  };
  quotations?: { view?: boolean; edit?: boolean; delete?: boolean };
  fleet?: { view?: boolean; edit?: boolean };
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

// Full admin permissions for Master Admin
export const MASTER_ADMIN_PERMISSIONS: UserPermissions = {
  hr: {
    employees: { view: true, edit: true, delete: true },
    attendance: { view: true, edit: true },
    shifts: { view: true, edit: true },
    leave: { view: true, approve: true },
    payroll: { view: true, edit: true },
    reports: { view: true },
  },
  quotations: { view: true, edit: true, delete: true },
  fleet: { view: true, edit: true },
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

const DEFAULT_USER: User = {
  id: 'admin-001',
  username: 'Godwinhotels',
  name: 'Raman Mankotia',
  email: 'mail@godwinhotels.com',
  role: 'Master Admin',
  status: 'Active',
  permissions: MASTER_ADMIN_PERMISSIONS,
};

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_USER,
  login: () => {},
  logout: () => {},
  hasPermission: () => true,
  isMasterAdmin: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(DEFAULT_USER);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('GODWIN_LOGGED_IN_USER') || sessionStorage.getItem('GODWIN_LOGGED_IN_USER');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.username) {
            setUser(parsed);
          } else {
            setUser(DEFAULT_USER);
            localStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(DEFAULT_USER));
          }
        } catch {
          setUser(DEFAULT_USER);
          localStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(DEFAULT_USER));
        }
      } else {
        localStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(DEFAULT_USER));
      }
    } catch (err) {
      console.warn('Storage access warning', err);
    }
  }, []);

  const login = (newUser: User) => {
    // Always ensure Master Admin gets full permissions
    const userWithPerms = newUser.id === 'admin-001' || newUser.role === 'Master Admin'
      ? { ...newUser, permissions: MASTER_ADMIN_PERMISSIONS }
      : newUser;
    setUser(userWithPerms);
    try {
      localStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(userWithPerms));
    } catch {}
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('GODWIN_LOGGED_IN_USER');
      sessionStorage.removeItem('GODWIN_LOGGED_IN_USER');
    } catch {}
    router.push('/login');
  };

  // Check if current user is Master Admin
  const isMasterAdmin = !!(
    user &&
    (user.id === 'admin-001' || user.role === 'Master Admin' || user.role === 'ADMIN')
  );

  /**
   * Check permission for a dotted path, e.g.:
   *   hasPermission('hr.employees', 'view')
   *   hasPermission('hr.leave', 'approve')
   *   hasPermission('quotations', 'delete')
   */
  const hasPermission = useCallback((module: string, action?: string): boolean => {
    // Master Admin always has everything
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

    // If no action specified, check if any action is true (i.e., has any access)
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
