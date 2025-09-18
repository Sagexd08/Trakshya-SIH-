import React, { useEffect } from 'react';
import { useTheme } from './index';

export function ThemeProvider({ children }: { children: React.ReactNode }) {

  useEffect(() => {
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
      .reduce-motion,
      .reduce-motion *,
      .reduce-motion *:before,
      .reduce-motion *:after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
      .screen-reader-mode {
        --color-primary: #0000ff;
        --color-accent: #800080;
      }
      .screen-reader-mode a { text-decoration: underline !important; }
      .screen-reader-mode button { border: 2px solid var(--color-border) !important; }
      .railway-theme {
        --gradient-primary: linear-gradient(135deg, #dc2626, #991b1b);
        --gradient-secondary: linear-gradient(135deg, #1f2937, #111827);
        --shadow-primary: 0 4px 14px 0 rgba(220, 38, 38, 0.25);
        --shadow-secondary: 0 2px 8px 0 rgba(0, 0, 0, 0.5);
      }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: var(--color-muted); }
      ::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: var(--color-primary); }
      .focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }
      @media print { * { background: white !important; color: black !important; box-shadow: none !important; } }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return <>{children}</>;
}

export function ThemeSelector() {
  const { theme, changeTheme, applyCustomTheme, railwayTheme } = useTheme();

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

