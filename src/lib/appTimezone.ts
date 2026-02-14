/**
 * Uganda / East Africa (EAT, Africa/Kampala) timezone for "today" and day boundaries.
 * All business-day logic (orders today, expenses today, cash session date) uses this.
 */

export const APP_TIMEZONE = 'Africa/Kampala';

/** Current date as YYYY-MM-DD in Uganda/East Africa. */
export function getTodayInAppTz(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

/**
 * UTC Date for midnight (00:00) on the given date in app timezone.
 * Use for order createdAt range: todayStart <= createdAt < todayEnd.
 */
export function getStartOfDayAppTzAsUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y == null || m == null || d == null) return new Date(NaN);
  // EAT is UTC+3: midnight in Kampala = previous calendar day 21:00 UTC
  return new Date(Date.UTC(y, m - 1, d - 1, 21, 0, 0, 0));
}

/**
 * UTC Date for end of day (start of next day) in app timezone.
 * Use as exclusive end: todayStart <= x < getEndOfDayAppTzAsUTC(todayStr).
 */
export function getEndOfDayAppTzAsUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y == null || m == null || d == null) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d, 21, 0, 0, 0));
}

/** Tomorrow's date (YYYY-MM-DD) in app timezone from a given today string. */
export function getTomorrowDateStr(todayStr: string): string {
  const [y, m, d] = todayStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return (
    next.getUTCFullYear() +
    '-' +
    String(next.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(next.getUTCDate()).padStart(2, '0')
  );
}

/** UTC timestamp (ms) of the next midnight in app timezone (for scheduling). */
export function getNextMidnightAppTzMs(): number {
  const todayStr = getTodayInAppTz();
  const tomorrowStr = getTomorrowDateStr(todayStr);
  return getStartOfDayAppTzAsUTC(tomorrowStr).getTime();
}

/** Day of week (0 = Sunday, 6 = Saturday) for a date in app timezone. */
export function getWeekdayInAppTz(dateStr: string): number {
  const d = getStartOfDayAppTzAsUTC(dateStr);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
  });
  const day = formatter.format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[day] ?? 0;
}

/** Add N days to a YYYY-MM-DD string (in app tz calendar). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return (
    next.getUTCFullYear() +
    '-' +
    String(next.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(next.getUTCDate()).padStart(2, '0')
  );
}

/** Start of week (Monday) in app tz for a given date: { start, end } as ISO strings. */
export function getWeekRangeInAppTz(dateStr: string): { start: string; end: string } {
  const w = getWeekdayInAppTz(dateStr);
  const daysBackToMonday = (w + 6) % 7;
  const mondayStr = addDaysToDateStr(dateStr, -daysBackToMonday);
  const sundayStr = addDaysToDateStr(mondayStr, 6);
  return {
    start: getStartOfDayAppTzAsUTC(mondayStr).toISOString(),
    end: getEndOfDayAppTzAsUTC(sundayStr).toISOString(),
  };
}

/** Start of month in app tz for a given date: { start, end } as ISO strings. */
export function getMonthRangeInAppTz(dateStr: string): { start: string; end: string } {
  const [y, m] = dateStr.split('-').map(Number);
  const firstStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return {
    start: getStartOfDayAppTzAsUTC(firstStr).toISOString(),
    end: getEndOfDayAppTzAsUTC(lastStr).toISOString(),
  };
}

/** Start of year in app tz for a given date: { start, end } as ISO strings. */
export function getYearRangeInAppTz(dateStr: string): { start: string; end: string } {
  const [y] = dateStr.split('-').map(Number);
  const firstStr = `${y}-01-01`;
  const lastStr = `${y}-12-31`;
  return {
    start: getStartOfDayAppTzAsUTC(firstStr).toISOString(),
    end: getEndOfDayAppTzAsUTC(lastStr).toISOString(),
  };
}
