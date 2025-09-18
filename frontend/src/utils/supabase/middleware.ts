import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

// Lightweight Supabase client for use in Next.js middleware.
// Uses anon key with no session persistence or auto-refresh.
export function createSupabaseMiddleware(_req?: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

