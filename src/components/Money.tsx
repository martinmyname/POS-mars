import { formatUGX } from '@/lib/formatUGX';

interface MoneyProps {
  value: number;
  size?: 'large' | 'medium' | 'body' | 'small';
  className?: string;
}

const sizeClasses = {
  // Hero/dashboard stat cards — scale from 20px on mobile to 28px on desktop
  large: 'font-mono font-semibold tabular-nums text-[20px] sm:text-[24px] lg:text-[28px] leading-tight tracking-tight',
  // Section totals, card amounts — scale from 17px to 22px
  medium: 'font-mono font-medium tabular-nums text-[17px] sm:text-[20px] leading-snug',
  // Table rows, list items — always body size, never clip
  body: 'font-mono tabular-nums text-[15px] sm:text-[17px] leading-normal',
  // Sub-labels, badges — fixed small
  small: 'font-mono tabular-nums text-[13px] leading-normal',
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
