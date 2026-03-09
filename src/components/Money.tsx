import { formatUGX } from '@/lib/formatUGX';

interface MoneyProps {
  value: number;
  className?: string;
}

/**
 * Renders a UGX amount with Apple typography: SF Mono + tabular-nums for aligned columns.
 * Use for all currency display (stat cards, tables, cart totals, etc.).
 */
export function Money({ value, className = '' }: MoneyProps) {
  return (
    <span data-money className={`font-mono tabular-nums ${className}`.trim()}>
      {formatUGX(value)}
    </span>
  );
}
