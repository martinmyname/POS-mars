/**
 * Supabase client for Auth and (via RxDB plugin) replication.
 *
 * For replication we export supabaseForReplication: a wrapped client that normalizes
 * 409 Conflict (duplicate key) so RxDB's plugin treats it as conflict and resolves
 * instead of throwing. Use the raw supabase for auth and other non-replication calls.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV && (!url || !anonKey)) {
  console.warn(
    'Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for sync and auth.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** PostgreSQL unique_violation; when present the RxDB Supabase plugin treats the error as conflict. */
const CONFLICT_CODE = '23505';

function isConflictError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === CONFLICT_CODE) return true;
  const msg = String(err.message ?? '').toLowerCase();
  return msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505');
}

/**
 * Wrapped Supabase client for RxDB replication. Normalizes 409 duplicate-key
 * errors so the replication plugin sees code '23505' and resolves the conflict
 * instead of throwing (avoids "POST .../orders 409 Conflict" breaking sync).
 * Uses a Proxy so all client methods (e.g. channel for Realtime) are forwarded.
 */
export const supabaseForReplication = new Proxy(supabase, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (tableName: string) => {
        const table = target.from(tableName) as ReturnType<typeof target.from> & {
          insert: (v: unknown) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
        };
        const origInsert = table.insert.bind(table);
        (table as { insert: typeof origInsert }).insert = async (values: unknown) => {
          const result = await origInsert(values);
          if (result.error && isConflictError(result.error) && result.error.code !== CONFLICT_CODE) {
            result.error = { ...result.error, code: CONFLICT_CODE };
          }
          return result;
        };
        return table;
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});
