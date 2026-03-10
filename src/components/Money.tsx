import { formatUGX } from '@/lib/formatUGX';

interface MoneyProps {
  value: number;
  size?: 'large' | 'medium' | 'body' | 'small';
  className?: string;
}

const sizeClasses = {
  large: 'font-mono text-title1 font-semibold tabular-nums tracking-tight',
  medium: 'font-mono text-title3 font-medium tabular-nums',
  body: 'font-mono text-body tabular-nums',
  small: 'font-mono text-footnote tabular-nums',
};

/**
 * Renders a UGX amount with Apple typography: SF Mono + tabular-nums for aligned columns.
 * Use for all currency display (stat cards, tables, cart totals, etc.).
 */
export function Money({ value, size = 'body', className = '' }: MoneyProps) {
  return (
    <span data-money className={`${sizeClasses[size]} ${className}`.trim()}>
      {formatUGX(value)}
    </span>
  );
}
