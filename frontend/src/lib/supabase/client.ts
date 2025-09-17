import { createClient } from '@supabase/supabase-js';

// Browser-side Supabase client (anon key only)
export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn('Supabase environment variables not found. Using mock client for development.');
    // Return a mock client that doesn't make real requests
    return createMockSupabaseClient();
  }

  return createClient(url, anonKey);
}

// Mock Supabase client for development without environment variables
function createMockSupabaseClient() {
  return {
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null })
        })
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null })
    }),
    channel: () => ({
      on: () => ({ subscribe: () => Promise.resolve() }),
      unsubscribe: () => Promise.resolve()
    }),
    removeChannel: () => Promise.resolve(),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null })
    }
  } as any;
}

