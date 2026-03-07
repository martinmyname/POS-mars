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
        const table = target.from(tableName);
        const origInsert = table.insert.bind(table);
        // Wrap insert so we normalize 409 → 23505 on the final response; return type matches chainable builder
        (table as { insert: (v: unknown) => unknown }).insert = (values: unknown) => {
          const builder = origInsert(values) as { then?: (onf: (res: unknown) => unknown, onr?: (err: unknown) => unknown) => unknown };
          const origThen = builder.then?.bind(builder);
          if (typeof origThen === 'function') {
            (builder as { then: (onf: (res: unknown) => unknown, onr?: (err: unknown) => unknown) => unknown }).then = function (onfulfilled: (res: unknown) => unknown, onrejected?: (err: unknown) => unknown) {
              return origThen(
                (res: unknown) => {
                  const r = res as { error?: { code?: string; message?: string } | null };
                  if (r?.error && isConflictError(r.error) && r.error.code !== CONFLICT_CODE) {
                    r.error = { ...r.error, code: CONFLICT_CODE };
                  }
                  return onfulfilled ? onfulfilled(res) : res;
                },
                onrejected
              ) as unknown;
            };
          }
          return builder;
        };
        return table;
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});
