import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'neon';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kassapro_theme') as ThemeMode;
      if (saved === 'light' || saved === 'neon') return saved;
    }
    return 'light'; // Default to ultra-clean, professional light mode
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kassapro_theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      document.documentElement.className = newTheme === 'neon' ? 'theme-neon' : 'theme-light';
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'neon' : 'light');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.className = theme === 'neon' ? 'theme-neon' : 'theme-light';
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
