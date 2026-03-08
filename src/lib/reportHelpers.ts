/** Order status that excludes from report metrics. */
export const CANCELLED = 'cancelled';

export function notCancelled(status: string): boolean {
  return status !== CANCELLED;
}

import { RESTOCK_PURPOSES } from '@/lib/expenseConstants';

/** Legacy purpose strings that were historically treated as restock (before RESTOCK_PURPOSES). */
const LEGACY_RESTOCK_TERMS = ['restock', 'inventory', 'inventory purchase'];

/** Purpose counts as restock/stock (case-insensitive, trimmed) for Restock Expenses. */
export function isRestockPurpose(purpose: string): boolean {
  const p = (purpose || '').trim().toLowerCase();
  if ((RESTOCK_PURPOSES as readonly string[]).some((r) => r.toLowerCase() === p)) return true;
  return LEGACY_RESTOCK_TERMS.some((term) => term === p);
}
