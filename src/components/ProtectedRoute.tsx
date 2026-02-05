import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useRxDB } from '@/hooks/useRxDB';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const db = useRxDB();
  const location = useLocation();

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

  // Wait for DB to initialize (but don't block forever)
  if (!db) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-background-grey">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-tufts-blue border-t-slate-200" />
        <p className="text-sm font-medium text-slate-600">Initializing database…</p>
      </div>
    );
  }

  return <>{children}</>;
}
