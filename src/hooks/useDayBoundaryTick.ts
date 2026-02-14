import { useEffect, useState } from 'react';
import { getNextMidnightAppTzMs } from '@/lib/appTimezone';

/** Returns a tick that updates every 30s and at midnight Uganda/EAT so "today" boundaries refresh. */
export function useDayBoundaryTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const tickOnce = () => setTick((t) => t + 1);

    const intervalId = setInterval(tickOnce, 30 * 1000);

    const scheduleNextMidnight = () => {
      const nextMidnightMs = getNextMidnightAppTzMs();
      const msUntilMidnight = nextMidnightMs - Date.now();
      return window.setTimeout(() => {
        tickOnce();
        midnightId = scheduleNextMidnight();
      }, Math.max(0, msUntilMidnight));
    };
    let midnightId = scheduleNextMidnight();

    return () => {
      clearInterval(intervalId);
      clearTimeout(midnightId);
    };
  }, []);
  return tick;
}
