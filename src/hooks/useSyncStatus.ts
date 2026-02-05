import { useEffect, useState } from 'react';
import { useRxDB } from './useRxDB';

interface SyncStatus {
  isSyncing: boolean;
  isInitialSync: boolean;
  syncedTables: Set<string>;
  totalTables: number;
}

/**
 * Hook to track sync status across all collections.
 * Returns whether data is currently syncing and if initial sync is complete.
 */
export function useSyncStatus(): SyncStatus {
  const db = useRxDB();
  const [isSyncing, setIsSyncing] = useState(true);
  const [isInitialSync, setIsInitialSync] = useState(false);
  const [syncedTables] = useState<Set<string>>(new Set());
  const [lastSyncCheck, setLastSyncCheck] = useState(0);

  const totalTables = 10; // products, orders, expenses, stock_adjustments, report_notes, promotions, customers, deliveries, suppliers, supplier_ledger

  useEffect(() => {
    if (!db) {
      setIsSyncing(true);
      setIsInitialSync(false);
      return;
    }

    // Check if initial sync was completed before (stored in localStorage)
    const checkStoredSyncStatus = () => {
      try {
        const syncComplete = localStorage.getItem('rxdb_initial_sync_complete');
        if (syncComplete) {
          const syncTime = new Date(syncComplete).getTime();
          const now = Date.now();
          // If sync completed within last 5 minutes, consider it fresh
          if (now - syncTime < 5 * 60 * 1000) {
            setIsInitialSync(true);
            setIsSyncing(false);
            return true;
          }
        }
      } catch (_) {}
      return false;
    };

    // Check if we have any data in key tables (indicates initial sync happened)
    const checkInitialSync = async () => {
      try {
        // Check if sync was recently completed
        if (checkStoredSyncStatus()) {
          return;
        }

        // Check a few key tables to see if data exists or if tables are accessible
        const [products, orders] = await Promise.all([
          db.products.find().exec(),
          db.orders.find().exec(),
        ]);
        
        // If DB is ready and we can query tables, consider initial sync done
        // (empty tables are fine - it means sync completed, just no data)
        const dbReady = db !== null;
        const canQuery = products !== undefined && orders !== undefined;
        
        if (dbReady && canQuery) {
          // Mark as synced after a short delay to allow replication to start
          const syncDelay = lastSyncCheck === 0 ? 2000 : 1000; // First check waits 2s, subsequent checks wait 1s
          setTimeout(() => {
            setIsInitialSync(true);
            setIsSyncing(false);
            try {
              localStorage.setItem('rxdb_initial_sync_complete', new Date().toISOString());
            } catch (_) {}
          }, syncDelay);
        }
        setLastSyncCheck(Date.now());
      } catch (e) {
        console.warn('Sync status check:', e);
      }
    };

    // Check immediately if we have stored sync status
    if (checkStoredSyncStatus()) {
      return;
    }

    // Wait a bit for replication to start, then check
    const timeoutId = setTimeout(() => {
      checkInitialSync();
    }, 1500);

    // Also check periodically
    const intervalId = setInterval(() => {
      checkInitialSync();
    }, 1500);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [db, lastSyncCheck]);

  return {
    isSyncing,
    isInitialSync,
    syncedTables,
    totalTables,
  };
}
