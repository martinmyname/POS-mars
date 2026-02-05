import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

export function SyncStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncErrors, setSyncErrors] = useState<Record<string, { message: string; timestamp: string }>>({});
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Check for sync errors
    const checkErrors = () => {
      try {
        const errors = JSON.parse(localStorage.getItem('rxdb_sync_errors') || '{}');
        setSyncErrors(errors);
        const initErr = localStorage.getItem('rxdb_init_error');
        if (initErr) {
          const parsed = JSON.parse(initErr);
          setInitError(parsed.message || 'Database sync initialization failed');
        }
      } catch (_) {
        // Ignore parse errors
      }
    };

    checkErrors();
    const interval = setInterval(checkErrors, 5000); // Check every 5 seconds

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, []);

  const hasErrors = Object.keys(syncErrors).length > 0 || initError;
  const errorCount = Object.keys(syncErrors).length;

  if (initError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
        <AlertCircle className="h-4 w-4" />
        <span>Sync Error</span>
        <button
          onClick={() => {
            localStorage.removeItem('rxdb_init_error');
            setInitError(null);
            window.location.reload();
          }}
          className="ml-2 rounded px-1.5 py-0.5 hover:bg-red-100"
          title="Reload to retry"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        Offline
      </div>
    );
  }

  if (hasErrors) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
        <AlertCircle className="h-4 w-4" />
        <span>Sync Issues ({errorCount})</span>
        <button
          onClick={() => {
            localStorage.removeItem('rxdb_sync_errors');
            setSyncErrors({});
          }}
          className="ml-2 rounded px-1.5 py-0.5 hover:bg-amber-100"
          title="Clear errors"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-4 w-4" />
      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
      Synced
    </div>
  );
}
