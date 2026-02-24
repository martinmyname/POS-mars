import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { triggerReSync } from '@/lib/rxdb';

export function SyncStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncErrors, setSyncErrors] = useState<Record<string, { message: string; timestamp: string }>>({});
  const [initError, setInitError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        triggerReSync();
      }
    };
    const onOffline = () => {
      wasOffline.current = true;
      setOnline(false);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        triggerReSync();
      }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibilityChange);

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
    const interval = setInterval(checkErrors, 5000);
    // When online and we have sync errors, auto-retry periodically so sync recovers without user action
    const retryInterval = setInterval(() => {
      try {
        const errors = JSON.parse(localStorage.getItem('rxdb_sync_errors') || '{}');
        if (navigator.onLine && Object.keys(errors).length > 0) {
          triggerReSync();
        }
      } catch (_) {}
    }, 20000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
      clearInterval(retryInterval);
    };
  }, []);

  const hasErrors = Object.keys(syncErrors).length > 0 || initError;
  const errorCount = Object.keys(syncErrors).length;

  const handleRetrySync = () => {
    setIsRetrying(true);
    triggerReSync();
    // Sync errors are cleared in rxdb when received$ fires (successful sync)
    // Init error requires full reload to re-init DB
    if (initError) {
      localStorage.removeItem('rxdb_init_error');
      setInitError(null);
      window.location.reload();
    } else {
      setTimeout(() => setIsRetrying(false), 8000);
    }
  };

  const handleClearSyncIssues = () => {
    setIsRetrying(true);
    triggerReSync();
    // Do NOT clear localStorage/state here: errors are cleared in rxdb when received$ fires (successful sync).
    // If we clear here and sync fails again, error$ writes back and the badge reappears ("issues come back").
    setTimeout(() => setIsRetrying(false), 8000);
  };

  if (initError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
        <AlertCircle className="h-4 w-4" />
        <span>Sync Error</span>
        <button
          onClick={handleRetrySync}
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
    const firstError = Object.entries(syncErrors)[0];
    const firstErrorMsg = firstError ? firstError[1].message : null;
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700"
        title={firstErrorMsg ? `${firstError[0]}: ${firstErrorMsg}` : 'Retry sync'}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{isRetrying ? 'Retrying…' : `Sync Issues (${errorCount})`}</span>
        {firstErrorMsg && !isRetrying && (
          <span className="max-w-[120px] truncate text-amber-600" title={firstErrorMsg}>
            — {firstErrorMsg}
          </span>
        )}
        <button
          onClick={handleClearSyncIssues}
          disabled={isRetrying}
          className="ml-2 rounded px-1.5 py-0.5 hover:bg-amber-100 disabled:opacity-70"
          title="Retry sync"
        >
          <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
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
