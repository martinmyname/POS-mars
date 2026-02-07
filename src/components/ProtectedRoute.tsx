import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useRxDB } from '@/hooks/useRxDB';
import { initRxDB } from '@/lib/rxdb';

const DB_WAIT_TIMEOUT_MS = 12000;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const db = useRxDB();
  const location = useLocation();
  const [dbWaitTimedOut, setDbWaitTimedOut] = useState(false);

  useEffect(() => {
    if (db || !user) return;
    const t = setTimeout(() => setDbWaitTimedOut(true), DB_WAIT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [db, user]);

  useEffect(() => {
    if (db) setDbWaitTimedOut(false);
  }, [db]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-background-grey">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-tufts-blue border-t-slate-200" />
        <p className="text-sm font-medium text-slate-600">Authenticating…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!db) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-background-grey px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-tufts-blue border-t-slate-200" />
        <p className="text-sm font-medium text-slate-600">
          {dbWaitTimedOut ? 'Database is taking longer than usual' : 'Initializing database…'}
        </p>
        {dbWaitTimedOut && (
          <button
            type="button"
            onClick={() => {
              setDbWaitTimedOut(false);
              initRxDB().catch(() => {});
            }}
            className="rounded-lg bg-tufts-blue px-4 py-2 text-sm font-medium text-white hover:bg-tufts-blue-hover"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
