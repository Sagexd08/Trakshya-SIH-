import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';

// Keyboard navigation constants
export const KEYBOARD_SHORTCUTS = {
  // Global shortcuts
  TOGGLE_MENU: 'Alt+M',
  SEARCH: 'Ctrl+K',
  HELP: 'F1',
  REFRESH: 'F5',
  
  // Map controls
  MAP_FOCUS: 'Ctrl+M',
  ZOOM_IN: 'Plus',
  ZOOM_OUT: 'Minus',
  PAN_UP: 'ArrowUp',
  PAN_DOWN: 'ArrowDown',
  PAN_LEFT: 'ArrowLeft',
  PAN_RIGHT: 'ArrowRight',
  
  // Dashboard navigation
  NEXT_WIDGET: 'Tab',
  PREV_WIDGET: 'Shift+Tab',
  ACTIVATE_WIDGET: 'Enter',
  CLOSE_MODAL: 'Escape',
  
  // AI Assistant
  VOICE_INPUT: 'Ctrl+Shift+V',
  SEND_MESSAGE: 'Ctrl+Enter',
  
  // Scenarios
  RUN_SCENARIO: 'Ctrl+R',
  SAVE_SCENARIO: 'Ctrl+S',
  
  // Accessibility
  TOGGLE_HIGH_CONTRAST: 'Ctrl+Alt+H',
  TOGGLE_SCREEN_READER: 'Ctrl+Alt+S',
  INCREASE_FONT_SIZE: 'Ctrl+Plus',
  DECREASE_FONT_SIZE: 'Ctrl+Minus',
  RESET_FONT_SIZE: 'Ctrl+0'
} as const;

// Screen reader announcements
export class ScreenReaderAnnouncer {
  private static instance: ScreenReaderAnnouncer;
  private announceElement: HTMLElement | null = null;

  static getInstance(): ScreenReaderAnnouncer {
    if (!ScreenReaderAnnouncer.instance) {
      ScreenReaderAnnouncer.instance = new ScreenReaderAnnouncer();
    }
    return ScreenReaderAnnouncer.instance;
  }

  constructor() {
    this.createAnnounceElement();
  }

  private createAnnounceElement() {
    if (typeof window === 'undefined') return;
    
    this.announceElement = document.createElement('div');
    this.announceElement.setAttribute('aria-live', 'polite');
    this.announceElement.setAttribute('aria-atomic', 'true');
    this.announceElement.setAttribute('aria-relevant', 'text');
    this.announceElement.style.position = 'absolute';
    this.announceElement.style.left = '-10000px';
    this.announceElement.style.width = '1px';
    this.announceElement.style.height = '1px';
    this.announceElement.style.overflow = 'hidden';
    document.body.appendChild(this.announceElement);
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.announceElement) return;
    
    this.announceElement.setAttribute('aria-live', priority);
    this.announceElement.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      if (this.announceElement) {
        this.announceElement.textContent = '';
      }
    }, 1000);
  }

  announceTrainUpdate(trainId: string, status: string, delay?: number) {
    const delayText = delay ? ` with ${delay} minute delay` : '';
    this.announce(`Train ${trainId} is now ${status}${delayText}`, 'polite');
  }

  announceConflictDetected(location: string, severity: string) {
    this.announce(`${severity} conflict detected at ${location}`, 'assertive');
  }

  announceRecommendation(title: string, confidence: number) {
    this.announce(`New AI recommendation: ${title} with ${confidence}% confidence`, 'polite');
  }
}

// Keyboard navigation hook
export function useKeyboardNavigation() {
  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  const announcer = ScreenReaderAnnouncer.getInstance();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, ctrlKey, altKey, shiftKey, metaKey } = event;
    const combo = [
      ctrlKey && 'Ctrl',
      altKey && 'Alt',
      shiftKey && 'Shift',
      metaKey && 'Meta',
      key
    ].filter(Boolean).join('+');

    switch (combo) {
      case KEYBOARD_SHORTCUTS.TOGGLE_MENU:
        event.preventDefault();
        announcer.announce('Menu toggled');
        // Implement menu toggle
        break;
        
      case KEYBOARD_SHORTCUTS.SEARCH:
        event.preventDefault();
        announcer.announce('Search activated');
        // Focus search input
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
        break;
        
      case KEYBOARD_SHORTCUTS.MAP_FOCUS:
        event.preventDefault();
        announcer.announce('Map focused. Use arrow keys to pan, plus and minus to zoom');
        setFocusedElement('map');
        break;
        
      case KEYBOARD_SHORTCUTS.VOICE_INPUT:
        event.preventDefault();
        announcer.announce('Voice input activated');
        // Trigger voice input
        const voiceButton = document.querySelector('[data-voice-button]') as HTMLButtonElement;
        if (voiceButton) {
          voiceButton.click();
        }
        break;
        
      case KEYBOARD_SHORTCUTS.HELP:
        event.preventDefault();
        announcer.announce('Help dialog opened');
        // Show help modal
        break;
        
      case 'Escape':
        event.preventDefault();
        announcer.announce('Dialog closed');
        setFocusedElement(null);
        // Close any open modals
        break;
    }
  }, [announcer]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { focusedElement, setFocusedElement };
}

// High contrast mode
export function useHighContrastMode() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('trakshya-high-contrast');
    if (saved === 'true') {
      setIsHighContrast(true);
      document.documentElement.classList.add('high-contrast');
    }
  }, []);

  const toggleHighContrast = useCallback(() => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    localStorage.setItem('trakshya-high-contrast', newValue.toString());
    
    if (newValue) {
      document.documentElement.classList.add('high-contrast');
      toast.success('High contrast mode enabled');
    } else {
      document.documentElement.classList.remove('high-contrast');
      toast.success('High contrast mode disabled');
    }
    
    ScreenReaderAnnouncer.getInstance().announce(
      `High contrast mode ${newValue ? 'enabled' : 'disabled'}`
    );
  }, [isHighContrast]);

  return { isHighContrast, toggleHighContrast };
}

// Font size control
export function useFontSizeControl() {
  const [fontSize, setFontSize] = useState(100); // percentage

  useEffect(() => {
    const saved = localStorage.getItem('trakshya-font-size');
    if (saved) {
      const size = parseInt(saved, 10);
      setFontSize(size);
      document.documentElement.style.fontSize = `${size}%`;
    }
  }, []);

  const changeFontSize = useCallback((delta: number) => {
    const newSize = Math.max(75, Math.min(150, fontSize + delta));
    setFontSize(newSize);
    localStorage.setItem('trakshya-font-size', newSize.toString());
    document.documentElement.style.fontSize = `${newSize}%`;
    
    ScreenReaderAnnouncer.getInstance().announce(`Font size set to ${newSize}%`);
    toast.success(`Font size: ${newSize}%`);
  }, [fontSize]);

  const resetFontSize = useCallback(() => {
    setFontSize(100);
    localStorage.setItem('trakshya-font-size', '100');
    document.documentElement.style.fontSize = '100%';
    
    ScreenReaderAnnouncer.getInstance().announce('Font size reset to default');
    toast.success('Font size reset');
  }, []);

  return { fontSize, changeFontSize, resetFontSize };
}

// Focus management
export function useFocusManagement() {
  const [focusHistory, setFocusHistory] = useState<HTMLElement[]>([]);

  const pushFocus = useCallback((element: HTMLElement) => {
    setFocusHistory(prev => [...prev, element]);
  }, []);

  const popFocus = useCallback(() => {
    setFocusHistory(prev => {
      const newHistory = [...prev];
      const element = newHistory.pop();
      if (element && document.contains(element)) {
        element.focus();
      }
      return newHistory;
    });
  }, []);

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, []);

  return { pushFocus, popFocus, trapFocus };
}

// ARIA live regions for dynamic content
export function useAriaLiveRegion() {
  const announcer = ScreenReaderAnnouncer.getInstance();

  const announceUpdate = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announcer.announce(message, priority);
  }, [announcer]);

  return { announceUpdate };
}

// React component moved to TSX to avoid JSX-in-TS parsing issues
export { SkipLinks } from './SkipLinks';

// Accessibility preferences
export interface AccessibilityPreferences {
  highContrast: boolean;
  fontSize: number;
  reducedMotion: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
}

export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    highContrast: false,
    fontSize: 100,
    reducedMotion: false,
    screenReaderMode: false,
    keyboardNavigation: true
  });

  useEffect(() => {
    const saved = localStorage.getItem('trakshya-accessibility-preferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences(parsed);
        applyPreferences(parsed);
      } catch (error) {
        console.error('Failed to load accessibility preferences:', error);
      }
    }
  }, []);

  const updatePreferences = useCallback((updates: Partial<AccessibilityPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    localStorage.setItem('trakshya-accessibility-preferences', JSON.stringify(newPreferences));
    applyPreferences(newPreferences);
  }, [preferences]);

  const applyPreferences = useCallback((prefs: AccessibilityPreferences) => {
    // Apply high contrast
    if (prefs.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    // Apply font size
    document.documentElement.style.fontSize = `${prefs.fontSize}%`;

    // Apply reduced motion
    if (prefs.reducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }

    // Apply screen reader mode
    if (prefs.screenReaderMode) {
      document.documentElement.classList.add('screen-reader-mode');
    } else {
      document.documentElement.classList.remove('screen-reader-mode');
    }
  }, []);

  return { preferences, updatePreferences };
}
