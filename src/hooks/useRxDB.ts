import { useEffect, useState } from 'react';
import type { MarsDatabase } from '@/lib/rxdb';
import { getRxDB } from '@/lib/rxdb';

/**
 * Returns the RxDB instance (null until init). Use in components that need DB access.
 * AuthContext now initializes RxDB in parallel with auth, so DB is usually ready when protected pages render.
 */
export function useRxDB(): MarsDatabase | null {
  const [db, setDb] = useState<MarsDatabase | null>(() => getRxDB());

  useEffect(() => {
    const current = getRxDB();
    if (current) {
      setDb(current);
      return;
    }
    const interval = setInterval(() => {
      const d = getRxDB();
      if (d) {
        setDb(d);
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return db;
}
