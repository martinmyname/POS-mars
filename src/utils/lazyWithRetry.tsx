import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const isChunkLoadError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('ChunkLoadError')
  );
};

/**
 * Wraps React.lazy with retry logic for dynamic imports.
 * Handles transient network failures and deployment cache mismatches
 * (e.g. old chunk URLs 404 after a new deploy).
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = 2,
  retryDelay = 1000
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (err) {
        lastError = err;
        if (!isChunkLoadError(err)) {
          throw err;
        }
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, retryDelay));
        }
      }
    }
    // All retries failed – likely deployment cache mismatch. Reload to fetch fresh chunks.
    if (isChunkLoadError(lastError)) {
      window.location.reload();
    }
    throw lastError;
  }) as LazyExoticComponent<T>;
}
