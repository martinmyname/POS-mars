interface ScrollTableProps {
  children: React.ReactNode;
  minWidth?: number;
}

/**
 * Wraps tables for horizontal scroll on mobile. Prevents table overflow from
 * forcing horizontal scroll on the whole page.
 */
export function ScrollTable({ children, minWidth = 600 }: ScrollTableProps) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth }} className="w-full">
        {children}
      </div>
    </div>
  );
}
