/** Order status that excludes from report metrics. */
export const CANCELLED = 'cancelled';

export function notCancelled(status: string): boolean {
  return status !== CANCELLED;
}

/** Purpose counts as restock/stock (case-insensitive, trimmed) for Restock Expenses. */
export function isRestockPurpose(purpose: string): boolean {
  const p = (purpose || '').trim().toLowerCase();
  return p === 'stock' || p === 'inventory purchase' || p === 'restock' || p === 'inventory';
}
