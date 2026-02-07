import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { triggerReSync } from '@/lib/rxdb';

export function SyncStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncErrors, setSyncErrors] = useState<Record<string, { message: string; timestamp: string }>>({});
  const [initError, setInitError] = useState<string | null>(null);
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
    triggerReSync();
    // Sync errors are cleared in rxdb when received$ fires (successful sync)
    // Init error requires full reload to re-init DB
    if (initError) {
      localStorage.removeItem('rxdb_init_error');
      setInitError(null);
      window.location.reload();
    }
  };

  const handleClearSyncIssues = () => {
    triggerReSync();
    localStorage.removeItem('rxdb_sync_errors');
    setSyncErrors({});
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
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
        <AlertCircle className="h-4 w-4" />
        <span>Sync Issues ({errorCount})</span>
        <button
          onClick={handleClearSyncIssues}
          className="ml-2 rounded px-1.5 py-0.5 hover:bg-amber-100"
          title="Retry sync"
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
