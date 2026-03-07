/**
 * Supabase client for Auth and data (no offline replication).
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV && (!url || !anonKey)) {
  console.warn(
    'Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for auth and data.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
