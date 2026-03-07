import { useMemo } from 'react';
import { getStartOfDayAppTzAsUTC, getEndOfDayAppTzAsUTC, addDaysToDateStr } from '@/lib/appTimezone';
import { getMonthRangeInAppTz } from '@/lib/appTimezone';
import type { PeriodType } from '@/hooks/usePeriodRange';

interface ExpenseLike {
  date: string;
  purpose?: string;
  amount?: number;
}

interface OrderLike {
  createdAt: string;
  total?: number;
}

const FIXED_COST_PURPOSES = new Set(['rent', 'labour', 'utility', 'utilities', 'maintenance']);

export interface BreakEvenMetricsResult {
  fixedCosts: number;
  breakEvenRevenue: number;
  breakEvenProgress: number;
  breakEvenReached: boolean;
  breakEvenDay: string | null;
}

export function useBreakEvenMetrics(
  allOrders: OrderLike[],
  periodExpList: ExpenseLike[],
  period: PeriodType,
  currentDateStr: { from: string; to: string },
  periodEndDateStr: string,
  revenuePeriod: number,
  profitPeriod: number
): BreakEvenMetricsResult {
  return useMemo(() => {
    const fixedCosts = periodExpList
      .filter((e) => FIXED_COST_PURPOSES.has((e.purpose || '').trim().toLowerCase()))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const grossIncome = Number(revenuePeriod) || 0;
    const grossMarginPct = grossIncome > 0 ? (Number(profitPeriod) || 0) / grossIncome : 0;
    const breakEvenRevenue = grossMarginPct > 0 ? fixedCosts / grossMarginPct : 0;
    const breakEvenProgress = breakEvenRevenue > 0 ? (grossIncome / breakEvenRevenue) * 100 : 0;
    const breakEvenReached = breakEvenRevenue > 0 && grossIncome >= breakEvenRevenue;

    let breakEvenDay: string | null = null;
    const periodSubBuckets: Array<{ label: string; revenue: number }> = [];
    const periodStartDateStr = currentDateStr.from;

    if (period === 'daily') {
      const dayStr = periodStartDateStr;
      const dayStart = getStartOfDayAppTzAsUTC(dayStr).toISOString();
      const dayEnd = getEndOfDayAppTzAsUTC(dayStr).toISOString();
      const dayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
      const rev = dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      periodSubBuckets.push({ label: dayStr, revenue: rev });
    } else if (period === 'weekly') {
      for (let d = 0; d < 7; d++) {
        const dayStr = addDaysToDateStr(periodStartDateStr, d);
        if (dayStr > periodEndDateStr) break;
        const dayStart = getStartOfDayAppTzAsUTC(dayStr).toISOString();
        const dayEnd = getEndOfDayAppTzAsUTC(dayStr).toISOString();
        const dayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
        const rev = dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        periodSubBuckets.push({ label: dayStr, revenue: rev });
      }
    } else if (period === 'monthly') {
      const [y, m] = periodStartDateStr.split('-').map(Number);
      const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (let d = 1; d <= lastD; d++) {
        const dayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (dayStr > periodEndDateStr) break;
        const dayStart = getStartOfDayAppTzAsUTC(dayStr).toISOString();
        const dayEnd = getEndOfDayAppTzAsUTC(dayStr).toISOString();
        const dayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
        const rev = dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        periodSubBuckets.push({ label: dayStr, revenue: rev });
      }
    } else {
      for (let mo = 1; mo <= 12; mo++) {
        const monthStr = `${periodStartDateStr.slice(0, 4)}-${String(mo).padStart(2, '0')}-01`;
        const monthRange = getMonthRangeInAppTz(monthStr);
        const monthOrders = allOrders.filter((o) => o.createdAt >= monthRange.start && o.createdAt < monthRange.end);
        const rev = monthOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        periodSubBuckets.push({ label: monthStr.slice(0, 7), revenue: rev });
      }
    }
    let cum = 0;
    for (const b of periodSubBuckets) {
      cum += b.revenue;
      if (breakEvenRevenue > 0 && cum >= breakEvenRevenue && breakEvenDay == null) {
        breakEvenDay = b.label;
        break;
      }
    }

    return {
      fixedCosts,
      breakEvenRevenue,
      breakEvenProgress,
      breakEvenReached,
      breakEvenDay,
    };
  }, [
    allOrders,
    periodExpList,
    period,
    currentDateStr.from,
    currentDateStr.to,
    periodEndDateStr,
    revenuePeriod,
    profitPeriod,
  ]);
}
