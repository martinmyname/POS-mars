/**
 * Full UGX format — always shows exact value.
 * Use for: ledger entries, invoices, receipts, cart totals, grand totals, inputs.
 * Output: "UGX 1,800,000"
 */
export function formatUGX(amount: number): string {
  const n = Math.round(amount);
  const abs = Math.abs(n);
  const prefix = n < 0 ? '−' : ''; // U+2212 minus
  return `${prefix}UGX ${abs.toLocaleString('en-UG')}`;
}

/**
 * Abbreviated UGX format — uses K / M for large values.
 * Use for: stat cards, chart labels, badges, table revenue columns.
 *
 * Thresholds:
 *   < 1,000          → "UGX 850"          (no abbreviation)
 *   1,000–999,999    → "UGX 850K"         (nearest K, no decimal if clean)
 *   ≥ 1,000,000      → "UGX 28.5M"        (1 decimal place, drop .0 if clean)
 */
export function formatUGXShort(amount: number): string {
  const n = Math.round(amount);
  const abs = Math.abs(n);
  const prefix = n < 0 ? '−' : ''; // U+2212 minus

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const formatted = m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '');
    return `${prefix}UGX ${formatted}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return `${prefix}UGX ${formatted}K`;
  }
  return `${prefix}UGX ${abs.toLocaleString('en-UG')}`;
}

/**
 * Abbreviated number only — no "UGX" prefix.
 * Use for: chart axis labels, sparkline tooltips, compact badges.
 *
 * Output examples:
 *   85000    → "85K"
 *   1200000  → "1.2M"
 */
export function formatAmountShort(amount: number): string {
  const n = Math.round(amount);
  const abs = Math.abs(n);
  const prefix = n < 0 ? '−' : ''; // U+2212 minus

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const formatted = m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '');
    return `${prefix}${formatted}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return `${prefix}${formatted}K`;
  }
  return `${prefix}${abs.toLocaleString('en-UG')}`;
}

/**
 * Smart formatter — chooses full or abbreviated based on amount and context.
 *
 * 'card'    → abbreviated (stat cards, summary tiles)
 * 'table'   → abbreviated if ≥ 100K, full otherwise
 * 'ledger'  → always full
 * 'chart'   → abbreviated, no prefix
 * 'badge'   → abbreviated
 * 'total'   → always full
 */
export function smartUGX(
  amount: number,
  context: 'card' | 'table' | 'ledger' | 'chart' | 'badge' | 'total' = 'total'
): string {
  switch (context) {
    case 'card':
    case 'badge':
      return formatUGXShort(amount);
    case 'table':
      return amount >= 100_000 ? formatUGXShort(amount) : formatUGX(amount);
    case 'chart':
      return formatAmountShort(amount);
    case 'ledger':
    case 'total':
    default:
      return formatUGX(amount);
  }
}

