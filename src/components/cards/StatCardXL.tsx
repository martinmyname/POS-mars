import { DeltaBadge } from './DeltaBadge';

type CardRole =
  | 'revenue'
  | 'profit'
  | 'orders'
  | 'expenses'
  | 'restock'
  | 'customers'
  | 'neutral';

const ROLE_CLASSES: Record<CardRole, string> = {
  revenue:
    'bg-white dark:bg-[#020617] border-l-[2.5px] border-l-blue-500',
  profit:
    'bg-white dark:bg-[#020617] border-l-[2.5px] border-l-green-500',
  orders:
    'bg-white dark:bg-[#020617] border-l-[2.5px] border-l-amber-500',
  expenses:
    'bg-white dark:bg-[#020617] border-l-[2.5px] border-l-red-500',
  restock:
    'bg-white dark:bg-[#020617] border-l-[2.5px] border-l-purple-500',
  customers:
    'bg-white dark:bg-[#020617] border-l-[2.5px] border-l-cyan-500',
  neutral:
    'bg-white dark:bg-[#020617] border-l-[2.5px] border-l-border',
};

interface StatCardXLProps {
  label: string;
  value: string;            // pre-formatted (formatUGXShort or count)
  delta?: string;           // e.g. "+18.4%" — optional
  deltaUp?: boolean;        // true = green, false = red
  sub?: string;             // e.g. "vs yesterday"
  fullValue?: string;       // shown on hover title attr — formatUGX full
  role?: CardRole;
}

export function StatCardXL({
  label,
  value,
  delta,
  deltaUp = true,
  sub,
  fullValue,
  role = 'neutral',
}: StatCardXLProps) {
  return (
    <div
      className={`rounded-xl p-4 min-w-0 border border-border/50 ${ROLE_CLASSES[role]}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground mb-1.5">
        {label}
      </div>
      <div
        className="font-mono text-[26px] font-medium leading-tight tracking-[-0.02em] tabular-nums"
        title={fullValue}
      >
        {value}
      </div>
      {delta && (
        <div className="mt-1.5">
          <DeltaBadge value={delta} up={deltaUp} />
        </div>
      )}
      {sub && (
        <div className="text-[12px] text-muted-foreground mt-1">
          {sub}
        </div>
      )}
    </div>
  );
}

