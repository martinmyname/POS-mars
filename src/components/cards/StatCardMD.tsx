import { DeltaBadge } from './DeltaBadge';

interface StatCardMDProps {
  label: string;
  value: string;
  sub?: string;
  fullValue?: string;
  delta?: string;
  deltaUp?: boolean;
}

export function StatCardMD({
  label,
  value,
  sub,
  fullValue,
  delta,
  deltaUp = true,
}: StatCardMDProps) {
  return (
    <div className="bg-white dark:bg-[#020617] rounded-lg p-3 min-w-0 border border-border/50">
      <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground mb-1">
        {label}
      </div>
      <div
        className="font-mono text-[19px] font-medium leading-tight tracking-[-0.015em] tabular-nums"
        title={fullValue}
      >
        {value}
      </div>
      {delta && (
        <div className="mt-1">
          <DeltaBadge value={delta} up={deltaUp} />
        </div>
      )}
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-1">
          {sub}
        </div>
      )}
    </div>
  );
}

