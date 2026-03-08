/**
 * Date predicates for YYYY-MM-DD strings in app timezone (Africa/Kampala).
 * Used by Expenses page and useExpenseMetrics.
 */
import { getTodayInAppTz, getWeekdayInAppTz, addDaysToDateStr } from '@/lib/appTimezone';

export function isToday(dateStr: string): boolean {
  return dateStr.slice(0, 10) === getTodayInAppTz();
}

export function isThisWeek(dateStr: string): boolean {
  const todayStr = getTodayInAppTz();
  const w = getWeekdayInAppTz(todayStr);
  const daysBackToMonday = (w + 6) % 7;
  const mondayStr = addDaysToDateStr(todayStr, -daysBackToMonday);
  const sundayStr = addDaysToDateStr(mondayStr, 6);
  const d = dateStr.slice(0, 10);
  return d >= mondayStr && d <= sundayStr;
}

export function isThisMonth(dateStr: string): boolean {
  const todayStr = getTodayInAppTz();
  return dateStr.slice(0, 7) === todayStr.slice(0, 7);
}
