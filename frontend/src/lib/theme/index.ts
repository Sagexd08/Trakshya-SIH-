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

// Theme provider component
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    // Add CSS for smooth transitions
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --theme-transition-duration: 300ms;
        --theme-transition-timing: cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .theme-transitioning,
      .theme-transitioning *,
      .theme-transitioning *:before,
      .theme-transitioning *:after {
        transition: 
          background-color var(--theme-transition-duration) var(--theme-transition-timing),
          border-color var(--theme-transition-duration) var(--theme-transition-timing),
          color var(--theme-transition-duration) var(--theme-transition-timing),
          fill var(--theme-transition-duration) var(--theme-transition-timing),
          stroke var(--theme-transition-duration) var(--theme-transition-timing),
          box-shadow var(--theme-transition-duration) var(--theme-transition-timing) !important;
      }
      
      /* High contrast mode overrides */
      .high-contrast {
        --color-background: #000000;
        --color-foreground: #ffffff;
        --color-primary: #ffff00;
        --color-secondary: #ffffff;
        --color-accent: #00ffff;
        --color-muted: #333333;
        --color-border: #ffffff;
        --color-success: #00ff00;
        --color-warning: #ffff00;
        --color-error: #ff0000;
        --color-info: #00ffff;
      }
      
      /* Reduced motion preferences */
      .reduce-motion,
      .reduce-motion *,
      .reduce-motion *:before,
      .reduce-motion *:after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
      
      /* Screen reader mode */
      .screen-reader-mode {
        --color-primary: #0000ff;
        --color-accent: #800080;
      }
      
      .screen-reader-mode a {
        text-decoration: underline !important;
      }
      
      .screen-reader-mode button {
        border: 2px solid var(--color-border) !important;
      }
      
      /* Railway-specific theme styles */
      .railway-theme {
        --gradient-primary: linear-gradient(135deg, #dc2626, #991b1b);
        --gradient-secondary: linear-gradient(135deg, #1f2937, #111827);
        --shadow-primary: 0 4px 14px 0 rgba(220, 38, 38, 0.25);
        --shadow-secondary: 0 2px 8px 0 rgba(0, 0, 0, 0.5);
      }
      
      /* Theme-aware scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: var(--color-muted);
      }
      
      ::-webkit-scrollbar-thumb {
        background: var(--color-border);
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: var(--color-primary);
      }
      
      /* Focus indicators */
      .focus-visible {
        outline: 2px solid var(--color-ring);
        outline-offset: 2px;
      }
      
      /* Print styles */
      @media print {
        * {
          background: white !important;
          color: black !important;
          box-shadow: none !important;
        }
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return <>{children}</>;
}

// Theme selector component
export function ThemeSelector() {
  const { theme, changeTheme, toggleTheme, applyCustomTheme, railwayTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => changeTheme('light')}
        className={`p-2 rounded-lg transition-colors ${
          theme === 'light' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
        aria-label="Light theme"
      >
        ☀️
      </button>
      
      <button
        onClick={() => changeTheme('dark')}
        className={`p-2 rounded-lg transition-colors ${
          theme === 'dark' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
        aria-label="Dark theme"
      >
        🌙
      </button>
      
      <button
        onClick={() => changeTheme('system')}
        className={`p-2 rounded-lg transition-colors ${
          theme === 'system' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
        aria-label="System theme"
      >
        💻
      </button>
      
      <button
        onClick={() => applyCustomTheme(railwayTheme)}
        className="p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Railway theme"
      >
        🚂
      </button>
    </div>
  );
}
