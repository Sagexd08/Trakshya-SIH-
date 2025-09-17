import { createClient } from '@supabase/supabase-js';
import { useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';

// Security configuration
export const SECURITY_CONFIG = {
  // Password requirements
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90, // days
  },
  
  // Session configuration
  session: {
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000, // 5 minutes before timeout
    maxConcurrentSessions: 3,
  },
  
  // Rate limiting
  rateLimit: {
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
    },
  },
  
  // Content Security Policy
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://vercel.live"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    connectSrc: ["'self'", "https://api.mapbox.com", "wss://"],
  },
};

// Encryption utilities using Web Crypto API
export class CryptoUtils {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  // Generate a random key
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data
  static async encrypt(data: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = this.encoder.encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encodedData
    );

    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  // Decrypt data
  static async decrypt(encryptedData: string, iv: string, key: CryptoKey): Promise<string> {
    const encrypted = this.base64ToArrayBuffer(encryptedData);
    const ivArray = this.base64ToArrayBuffer(iv);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivArray,
      },
      key,
      encrypted
    );

    return this.decoder.decode(decrypted);
  }

  // Hash data
  static async hash(data: string): Promise<string> {
    const encodedData = this.encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
    return this.arrayBufferToBase64(hashBuffer);
  }

  // Utility functions
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Input sanitization
export class InputSanitizer {
  // Sanitize HTML to prevent XSS
  static sanitizeHtml(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  // Sanitize SQL input
  static sanitizeSql(input: string): string {
    return input.replace(/['"\\;]/g, '');
  }

  // Validate email
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
    score: number;
  } {
    const errors: string[] = [];
    let score = 0;

    if (password.length < SECURITY_CONFIG.password.minLength) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.password.minLength} characters long`);
    } else {
      score += 1;
    }

    if (SECURITY_CONFIG.password.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    if (SECURITY_CONFIG.password.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    if (SECURITY_CONFIG.password.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    if (SECURITY_CONFIG.password.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    return {
      isValid: errors.length === 0,
      errors,
      score: (score / 5) * 100,
    };
  }

  // Sanitize file uploads
  static validateFileUpload(file: File): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      errors.push('File type not allowed');
    }

    if (file.size > maxSize) {
      errors.push('File size too large (max 10MB)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Session management
export class SessionManager {
  private static instance: SessionManager;
  private sessionTimeout: NodeJS.Timeout | null = null;
  private warningTimeout: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Start session monitoring
  startSession(onWarning: () => void, onTimeout: () => void) {
    this.resetSession();
    
    // Set up activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, this.updateActivity.bind(this), { passive: true });
    });

    // Set warning timeout
    this.warningTimeout = setTimeout(() => {
      onWarning();
    }, SECURITY_CONFIG.session.timeout - SECURITY_CONFIG.session.warningTime);

    // Set session timeout
    this.sessionTimeout = setTimeout(() => {
      onTimeout();
      this.endSession();
    }, SECURITY_CONFIG.session.timeout);
  }

  // Update activity timestamp
  private updateActivity() {
    this.lastActivity = Date.now();
    this.resetSession();
  }

  // Reset session timers
  private resetSession() {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }
    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout);
    }
  }

  // End session
  endSession() {
    this.resetSession();
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.removeEventListener(event, this.updateActivity.bind(this));
    });
  }

  // Get time until session expires
  getTimeUntilExpiry(): number {
    return Math.max(0, SECURITY_CONFIG.session.timeout - (Date.now() - this.lastActivity));
  }
}

// Audit logging
export class AuditLogger {
  private static supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  static async log(action: string, details: any, userId?: string) {
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert({
          user_id: userId,
          action,
          details,
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to log audit event:', error);
      }
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  private static async getClientIP(): Promise<string> {
    try {
      const response = await fetch('/api/client-ip');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

// React hooks for security
export function useSecurityContext() {
  const { user } = useUser();
  const [userRole, setUserRole] = useState<string>('viewer');
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      // Fetch user role and permissions from Supabase
      fetchUserPermissions(user.id);
    }
  }, [user]);

  const fetchUserPermissions = async (userId: string) => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from('profiles')
        .select('role, permissions')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setUserRole(data.role || 'viewer');
      setPermissions(data.permissions || []);
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
    }
  };

  const hasPermission = useCallback((permission: string): boolean => {
    return permissions.includes(permission) || userRole === 'admin';
  }, [permissions, userRole]);

  const canAccess = useCallback((resource: string, action: string): boolean => {
    const permissionKey = `${resource}:${action}`;
    return hasPermission(permissionKey);
  }, [hasPermission]);

  return {
    user,
    userRole,
    permissions,
    hasPermission,
    canAccess,
  };
}

// Hook for session management
export function useSessionSecurity() {
  const [sessionWarning, setSessionWarning] = useState(false);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState(0);

  useEffect(() => {
    const sessionManager = SessionManager.getInstance();
    
    sessionManager.startSession(
      () => setSessionWarning(true),
      () => {
        // Handle session timeout
        window.location.href = '/sign-in?reason=session-expired';
      }
    );

    // Update time until expiry every second
    const interval = setInterval(() => {
      setTimeUntilExpiry(sessionManager.getTimeUntilExpiry());
    }, 1000);

    return () => {
      clearInterval(interval);
      sessionManager.endSession();
    };
  }, []);

  const extendSession = useCallback(() => {
    setSessionWarning(false);
    const sessionManager = SessionManager.getInstance();
    sessionManager.startSession(
      () => setSessionWarning(true),
      () => {
        window.location.href = '/sign-in?reason=session-expired';
      }
    );
  }, []);

  return {
    sessionWarning,
    timeUntilExpiry,
    extendSession,
  };
}

// Initialize security features
export function initializeSecurity() {
  // Set up CSP
  if (typeof document !== 'undefined') {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = Object.entries(SECURITY_CONFIG.csp)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()} ${value.join(' ')}`)
      .join('; ');
    document.head.appendChild(meta);
  }

  console.log('🔒 Security features initialized');
}
