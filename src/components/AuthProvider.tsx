'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface User {
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
          }
        } catch (e) {
          localStorage.removeItem('GODWIN_LOGGED_IN_USER');
          sessionStorage.removeItem('GODWIN_LOGGED_IN_USER');
        }
      }
    } catch (err) {
      console.warn("Storage access failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [loading, user, pathname, router]);

  const login = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('GODWIN_LOGGED_IN_USER', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('GODWIN_LOGGED_IN_USER');
    sessionStorage.removeItem('GODWIN_LOGGED_IN_USER');
    router.push('/login');
  };

  // Prevent hydration mismatch by returning a clean loading state during initial mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: '#020617',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        color: 'white',
        zIndex: 99999
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8', margin: 0 }}>
          Godwin ERP...
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: '#020617',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        color: 'white',
        zIndex: 99999
      }}>
        <div className="auth-spinner" style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#d97706',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>
          Loading...
        </p>
        <style jsx>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    return null; // The useEffect will handle the redirect, no need to show a blocking UI
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
