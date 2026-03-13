import { formatUGXShort } from '@/utils/formatUtils';

interface GoalCardProps {
  label: string;
  current: number;
  target: number;
  formatValue?: (n: number) => string; // defaults to formatUGXShort
}

export function GoalCard({
  label,
  current,
  target,
  formatValue = formatUGXShort,
}: GoalCardProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const color =
    pct >= 100 ? 'bg-success' : pct >= 60 ? 'bg-primary' : 'bg-warning';

  return (
    <div className="bg-secondary rounded-lg p-3 flex items-center justify-between gap-3 min-w-0">
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-muted-foreground mb-1.5 truncate">
          {label}
        </div>
        <div className="h-[3px] bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-[14px] font-medium tabular-nums">
          {formatValue(current)} / {formatValue(target)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {pct}%
        </div>
      </div>
    </div>
  );
}

