'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const DEFAULT_USER: User = {
  id: 'godwin-admin-1',
  username: 'Godwinhotels',
  name: 'Raman Mankotia',
  email: 'mail@godwinhotels.com',
  role: 'ADMIN',
  status: 'ACTIVE'
};

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_USER,
  login: () => {},
  logout: () => {},
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
      console.warn("Storage access warning", err);
    }
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    try {
      localStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(newUser));
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

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
