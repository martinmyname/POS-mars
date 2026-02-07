import { useEffect, useState } from 'react';

/** Updates every 30s so "today" boundaries refresh soon after midnight (daily stats go to zero). */
export function useDayBoundaryTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  return tick;
}
