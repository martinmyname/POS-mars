/**
 * Supabase Auth context – session, login, register, logout.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { initRxDB, destroyRxDB } from '@/lib/rxdb';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  /** Display name from profile, or email, or null */
  displayName: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    error: null,
  });

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const signIn = useCallback(async (email: string, password: string) => {
    clearError();
    setState((s) => ({ ...s, loading: true }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({ ...s, error: error.message, loading: false }));
      throw error;
    }
    if (data.session) {
      setState((s) => ({ ...s, session: data.session, user: data.user, error: null }));
      try {
        // Initialize DB and wait a bit for initial sync to start
        await initRxDB();
        // Give replication a moment to start pulling data
        await new Promise((resolve) => setTimeout(resolve, 500));
        setState((s) => ({ ...s, loading: false }));
      } catch (_e) {
        setState((s) => ({ ...s, loading: false }));
      }
    }
  }, [clearError]);

  const signUp = useCallback(async (email: string, password: string) => {
    clearError();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setState((s) => ({ ...s, error: error.message }));
      throw error;
    }
    // Supabase may require email confirmation; session can be null until confirmed
    if (data.session) {
      setState((s) => ({ ...s, session: data.session, user: data.user, error: null }));
      try {
        await initRxDB();
      } catch (_e) {
        /* init error surfaced in SyncStatus if sync fails */
      }
    } else {
      setState((s) => ({
        ...s,
        error: 'Check your email to confirm your account, then sign in.',
        loading: false,
      }));
    }
  }, [clearError]);

  const signOut = useCallback(async () => {
    await destroyRxDB();
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Start DB init immediately in parallel with auth (so it's ready sooner)
      const dbPromise = initRxDB().catch(() => {
        /* init error surfaced in SyncStatus if sync fails */
      });

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session) {
          await dbPromise;
          if (!mounted) return;
        }
        setState((s) => ({
          ...s,
          session: session ?? null,
          user: session?.user ?? null,
          loading: false,
          error: error?.message ?? s.error,
        }));
      } catch (e) {
        if (!mounted) return;
        console.error('Auth init failed (check .env and VITE_SUPABASE_*):', e);
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load session',
        }));
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        // Wait for DB init so we don't show protected route with null db (stuck "Initializing database")
        initRxDB()
          .then(() => {
            if (mounted) {
              setState((s) => ({ ...s, session, user: session.user, loading: false }));
            }
          })
          .catch(() => {
            if (mounted) {
              setState((s) => ({ ...s, session, user: session.user, loading: false }));
            }
          });
      } else {
        setState((s) => ({ ...s, session: null, user: null, loading: false }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const displayName = useMemo(() => {
    const u = state.user;
    if (!u) return null;
    const meta = u.user_metadata as { full_name?: string; display_name?: string } | undefined;
    return meta?.full_name || meta?.display_name || u.email || null;
  }, [state.user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      displayName,
      signIn,
      signUp,
      signOut,
      clearError,
    }),
    [state, displayName, signIn, signUp, signOut, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
