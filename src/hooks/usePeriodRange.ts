/**
 * Reusable period range for Reports (EAT / Africa/Kampala).
 * Returns current and previous period boundaries as UTC ISO strings for DB filtering.
 */
import { useMemo } from 'react';
import {
  getTodayInAppTz,
  getStartOfDayAppTzAsUTC,
  getEndOfDayAppTzAsUTC,
  addDaysToDateStr,
  getWeekRangeInAppTz,
  getMonthRangeInAppTz,
  getYearRangeInAppTz,
} from '@/lib/appTimezone';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface PeriodBounds {
  from: string;
  to: string;
}

export interface PeriodRangeResult {
  current: PeriodBounds;
  previous: PeriodBounds;
  /** YYYY-MM-DD style strings for expense date filtering (date column is text) */
  currentDateStr: { from: string; to: string };
  previousDateStr: { from: string; to: string };
  periodLabel: string;
  prevPeriodLabel: string;
}

export function usePeriodRange(period: PeriodType): PeriodRangeResult {
  return useMemo(() => {
    const todayStr = getTodayInAppTz();

    let current: PeriodBounds;
    let previous: PeriodBounds;
    let currentDateStr: { from: string; to: string };
    let previousDateStr: { from: string; to: string };
    let periodLabel: string;
    let prevPeriodLabel: string;

    if (period === 'daily') {
      current = {
        from: getStartOfDayAppTzAsUTC(todayStr).toISOString(),
        to: getEndOfDayAppTzAsUTC(todayStr).toISOString(),
      };
      const yesterdayStr = addDaysToDateStr(todayStr, -1);
      previous = {
        from: getStartOfDayAppTzAsUTC(yesterdayStr).toISOString(),
        to: current.from,
      };
      currentDateStr = { from: todayStr, to: todayStr };
      previousDateStr = { from: yesterdayStr, to: yesterdayStr };
      periodLabel = 'Today';
      prevPeriodLabel = 'Yesterday';
    } else if (period === 'weekly') {
      const thisWeek = getWeekRangeInAppTz(todayStr);
      current = { from: thisWeek.start, to: thisWeek.end };
      const mondayStr = new Date(thisWeek.start).toLocaleDateString('en-CA', {
        timeZone: 'Africa/Kampala',
      });
      const lastMondayStr = addDaysToDateStr(mondayStr, -7);
      const prevWeek = getWeekRangeInAppTz(lastMondayStr);
      previous = { from: prevWeek.start, to: thisWeek.start };
      currentDateStr = {
        from: mondayStr,
        to: addDaysToDateStr(mondayStr, 6),
      };
      previousDateStr = {
        from: lastMondayStr,
        to: addDaysToDateStr(lastMondayStr, 6),
      };
      periodLabel = 'This week';
      prevPeriodLabel = 'Last week';
    } else if (period === 'monthly') {
      const thisMonth = getMonthRangeInAppTz(todayStr);
      current = { from: thisMonth.start, to: thisMonth.end };
      const [y, m] = todayStr.split('-').map(Number);
      const lastMonthStr =
        m === 1
          ? `${y - 1}-12-01`
          : `${y}-${String(m - 1).padStart(2, '0')}-01`;
      const prevMonth = getMonthRangeInAppTz(lastMonthStr);
      previous = { from: prevMonth.start, to: thisMonth.start };
      currentDateStr = {
        from: todayStr.slice(0, 7) + '-01',
        to: (() => {
          const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate();
          return `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        })(),
      };
      previousDateStr = {
        from: lastMonthStr,
        to: (() => {
          const [py, pm] = lastMonthStr.split('-').map(Number);
          const lastD = new Date(Date.UTC(py, pm, 0)).getUTCDate();
          return `${py}-${String(pm).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        })(),
      };
      periodLabel = 'This month';
      prevPeriodLabel = 'Last month';
    } else {
      const thisYear = getYearRangeInAppTz(todayStr);
      current = { from: thisYear.start, to: thisYear.end };
      const [y] = todayStr.split('-').map(Number);
      const lastYearStr = `${y - 1}-01-01`;
      const prevYear = getYearRangeInAppTz(lastYearStr);
      previous = { from: prevYear.start, to: thisYear.start };
      currentDateStr = { from: `${y}-01-01`, to: `${y}-12-31` };
      previousDateStr = { from: lastYearStr, to: `${y - 1}-12-31` };
      periodLabel = 'This year';
      prevPeriodLabel = 'Last year';
    }

    return {
      current,
      previous,
      currentDateStr,
      previousDateStr,
      periodLabel,
      prevPeriodLabel,
    };
  }, [period]);
}
