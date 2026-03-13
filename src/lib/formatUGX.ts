import { formatUGX as formatUGXInternal } from '@/utils/formatUtils';

/**
 * Backwards-compatible wrapper for full UGX formatting.
 * Prefer importing from `@/utils/formatUtils` in new code.
 */
export function formatUGX(value: number): string {
  return formatUGXInternal(value);
}

