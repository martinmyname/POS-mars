/**
 * Supabase Auth context – session, login, register, logout.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { initRxDB } from '@/lib/rxdb';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    error: null,
  });

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const signIn = useCallback(async (email: string, password: string) => {
    clearError();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({ ...s, error: error.message }));
      throw error;
    }
    if (data.session) {
      setState((s) => ({ ...s, session: data.session, user: data.user, error: null }));
      try {
        await initRxDB();
      } catch (e) {
        console.warn('RxDB init after sign-in:', e);
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
      } catch (e) {
        console.warn('RxDB init after sign-up:', e);
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
    const { destroyRxDB } = await import('@/lib/rxdb');
    await destroyRxDB();
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Start DB init immediately in parallel with auth (so it's ready sooner)
      const dbPromise = initRxDB().catch((e) => {
        if (mounted) console.warn('RxDB init:', e);
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
      setState((s) => ({
        ...s,
        session: session ?? null,
        user: session?.user ?? null,
        loading: false,
      }));
      if (session) {
        initRxDB().catch((e) => console.warn('RxDB init on auth change:', e));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      clearError,
    }),
    [state, signIn, signUp, signOut, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
