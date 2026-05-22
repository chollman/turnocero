import { createContext, useContext, useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../utils/storageKeys';

const VALID_THEMES = ['dark', 'light'];

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    return VALID_THEMES.includes(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {
      /* ignore quota errors */
    }
  }, [theme]);

  const setTheme = (next) => {
    if (VALID_THEMES.includes(next)) setThemeState(next);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
