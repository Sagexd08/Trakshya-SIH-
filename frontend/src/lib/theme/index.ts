import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export const lightTheme: ThemeColors = {
  primary: '#0ea5e9', // sky-500
  secondary: '#64748b', // slate-500
  accent: '#06b6d4', // cyan-500
  background: '#ffffff',
  foreground: '#0f172a', // slate-900
  muted: '#f1f5f9', // slate-100
  border: '#e2e8f0', // slate-200
  input: '#f8fafc', // slate-50
  ring: '#0ea5e9', // sky-500
  success: '#10b981', // emerald-500
  warning: '#f59e0b', // amber-500
  error: '#ef4444', // red-500
  info: '#3b82f6', // blue-500
};

export const darkTheme: ThemeColors = {
  primary: '#0ea5e9', // sky-500
  secondary: '#64748b', // slate-500
  accent: '#06b6d4', // cyan-500
  background: '#0f172a', // slate-900
  foreground: '#f8fafc', // slate-50
  muted: '#1e293b', // slate-800
  border: '#334155', // slate-700
  input: '#1e293b', // slate-800
  ring: '#0ea5e9', // sky-500
  success: '#10b981', // emerald-500
  warning: '#f59e0b', // amber-500
  error: '#ef4444', // red-500
  info: '#3b82f6', // blue-500
};

export const railwayTheme: ThemeColors = {
  primary: '#dc2626', // red-600 (Indian Railways red)
  secondary: '#1f2937', // gray-800
  accent: '#fbbf24', // amber-400 (signal yellow)
  background: '#111827', // gray-900
  foreground: '#f9fafb', // gray-50
  muted: '#374151', // gray-700
  border: '#4b5563', // gray-600
  input: '#1f2937', // gray-800
  ring: '#dc2626', // red-600
  success: '#10b981', // emerald-500
  warning: '#f59e0b', // amber-500
  error: '#ef4444', // red-500
  info: '#3b82f6', // blue-500
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Get system theme preference
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((themeMode: 'light' | 'dark', colors?: ThemeColors) => {
    const root = document.documentElement;
    const themeColors = colors || (themeMode === 'dark' ? darkTheme : lightTheme);
    
    // Add transition class
    root.classList.add('theme-transitioning');
    setIsTransitioning(true);
    
    // Apply theme class
    root.classList.remove('light', 'dark');
    root.classList.add(themeMode);
    
    // Apply CSS custom properties
    Object.entries(themeColors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Remove transition class after animation
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
      setIsTransitioning(false);
    }, 300);
    
    setResolvedTheme(themeMode);
  }, []);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('trakshya-theme') as Theme;
    const initialTheme = savedTheme || 'system';
    
    setTheme(initialTheme);
    
    const resolvedMode = initialTheme === 'system' ? getSystemTheme() : initialTheme;
    applyTheme(resolvedMode as 'light' | 'dark');
  }, [getSystemTheme, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const systemTheme = getSystemTheme();
      applyTheme(systemTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, getSystemTheme, applyTheme]);

  // Change theme
  const changeTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('trakshya-theme', newTheme);
    
    const resolvedMode = newTheme === 'system' ? getSystemTheme() : newTheme;
    applyTheme(resolvedMode as 'light' | 'dark');
    
    toast.success(`Theme changed to ${newTheme}`);
  }, [getSystemTheme, applyTheme]);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    changeTheme(newTheme);
  }, [resolvedTheme, changeTheme]);

  // Apply custom theme colors
  const applyCustomTheme = useCallback((colors: ThemeColors) => {
    applyTheme(resolvedTheme, colors);
    localStorage.setItem('trakshya-custom-theme', JSON.stringify(colors));
    toast.success('Custom theme applied');
  }, [resolvedTheme, applyTheme]);

  // Reset to default theme
  const resetTheme = useCallback(() => {
    localStorage.removeItem('trakshya-custom-theme');
    applyTheme(resolvedTheme);
    toast.success('Theme reset to default');
  }, [resolvedTheme, applyTheme]);

  return {
    theme,
    resolvedTheme,
    isTransitioning,
    changeTheme,
    toggleTheme,
    applyCustomTheme,
    resetTheme,
    lightTheme,
    darkTheme,
    railwayTheme
  };
}

// React components moved to TSX to avoid JSX-in-TS parsing issues
export { ThemeProvider, ThemeSelector } from './ThemeComponents';
