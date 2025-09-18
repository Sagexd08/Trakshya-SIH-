import { createClient } from '@supabase/supabase-js';

let browserClient: ReturnType<typeof createClient> | null = null;

// Browser-side Supabase client (anon key only)
export function createSupabaseBrowser() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn('Supabase env not configured. Falling back to a no-op client.');
    browserClient = createMockSupabaseClient();
    return browserClient as any;
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}

// Minimal mock Supabase client for development when env vars are missing
function createMockSupabaseClient() {
  return {
    from: (_table: string) => ({
      select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      insert: async () => ({ data: null, error: null }),
      update: async () => ({ data: null, error: null }),
      delete: async () => ({ data: null, error: null }),
    }),
    channel: () => ({ on: () => ({ subscribe: async () => {} }), unsubscribe: async () => {} }),
    removeChannel: async () => {},
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  } as any;
}

