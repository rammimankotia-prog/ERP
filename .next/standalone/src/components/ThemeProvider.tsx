'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem('GODWIN_ERP_THEME') as Theme;
      let initialTheme: Theme = 'light';
      if (savedTheme === 'light' || savedTheme === 'dark') {
        initialTheme = savedTheme;
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const hour = new Date().getHours();
        const isNightTime = hour >= 19 || hour < 6;
        initialTheme = (prefersDark || isNightTime) ? 'dark' : 'light';
      }
      setTheme(initialTheme);
      document.documentElement.classList.toggle('dark', initialTheme === 'dark');
      document.documentElement.classList.toggle('light', initialTheme === 'light');
      document.body.classList.toggle('dark', initialTheme === 'dark');
      document.body.classList.toggle('light', initialTheme === 'light');
    } catch (e) {
      console.warn('Could not read theme from storage', e);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      localStorage.setItem('GODWIN_ERP_THEME', newTheme);
      localStorage.setItem('GODWIN_THEME', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      document.documentElement.classList.toggle('light', newTheme === 'light');
      document.body.classList.toggle('dark', newTheme === 'dark');
      document.body.classList.toggle('light', newTheme === 'light');
    } catch (e) {
      console.warn('Could not save theme to storage', e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
