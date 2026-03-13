interface DeltaBadgeProps {
  value: string;
  up: boolean;
}

export function DeltaBadge({ value, up }: DeltaBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
        up
          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
          : 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
      }`}
    >
      {up ? (
        <svg width="7" height="8" viewBox="0 0 7 8" fill="none" aria-hidden="true">
          <path d="M3.5 1L6.5 6H0.5L3.5 1Z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="7" height="8" viewBox="0 0 7 8" fill="none" aria-hidden="true">
          <path d="M3.5 7L0.5 2H6.5L3.5 7Z" fill="currentColor" />
        </svg>
      )}
      {value}
    </span>
  );
}

