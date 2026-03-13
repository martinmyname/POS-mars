type StatMetric =
  | 'grossMargin'
  | 'netMargin'
  | 'repeatRate'
  | 'returnRate'
  | string;

interface StatCardSMProps {
  label: string;
  value: string;
  fullValue?: string;
  metric?: StatMetric;
  numericValue?: number;
}

function getValueColor(metric: StatMetric | undefined, value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return 'text-primary';

  switch (metric) {
    case 'grossMargin':
    case 'netMargin':
    case 'repeatRate':
      return value >= 30
        ? 'text-green-600 dark:text-green-400'
        : value >= 15
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
    case 'returnRate':
      return value <= 2
        ? 'text-green-600 dark:text-green-400'
        : value <= 5
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
    default:
      return 'text-primary';
  }
}

export function StatCardSM({
  label,
  value,
  fullValue,
  metric,
  numericValue,
}: StatCardSMProps) {
  const colorClass = getValueColor(metric, numericValue);

  return (
    <div className="bg-white dark:bg-[#020617] rounded-lg p-2.5 min-w-0 border border-border/50">
      <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-0.5">
        {label}
      </div>
      <div
        className={`font-mono text-[16px] font-medium leading-tight tracking-[-0.01em] tabular-nums ${colorClass}`}
        title={fullValue}
      >
        {value}
      </div>
    </div>
  );
}

