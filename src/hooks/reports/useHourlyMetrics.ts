import { useMemo } from 'react';
import { getStartOfDayAppTzAsUTC, getEndOfDayAppTzAsUTC } from '@/lib/appTimezone';
import type { PeriodType } from '@/hooks/usePeriodRange';

interface OrderLike {
  createdAt: string;
  total?: number;
  grossProfit?: number;
}

export type HourlyBucket = {
  hour: number;
  hourLabel: string;
  revenue: number;
  profit: number;
  orders: number;
  avgOrderValue: number;
};

export interface HourlyMetricsResult {
  hourlyBreakdown: HourlyBucket[];
  peakRevenueHour: number | null;
}

export function useHourlyMetrics(
  allOrders: OrderLike[],
  period: PeriodType,
  todayStr: string
): HourlyMetricsResult {
  return useMemo(() => {
    const hourlyBreakdown: HourlyBucket[] = [];
    let peakRevenueHour: number | null = null;
    if (period !== 'daily') {
      return { hourlyBreakdown, peakRevenueHour };
    }
    const dayStart = getStartOfDayAppTzAsUTC(todayStr).toISOString();
    const dayEnd = getEndOfDayAppTzAsUTC(todayStr).toISOString();
    const todayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
    const getHourAppTz = (iso: string) => {
      const h = new Date(iso).toLocaleString('en-GB', {
        timeZone: 'Africa/Kampala',
        hour: '2-digit',
        hour12: false,
      });
      return parseInt(h, 10) || 0;
    };
    for (let h = 0; h < 24; h++) {
      hourlyBreakdown.push({
        hour: h,
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        revenue: 0,
        profit: 0,
        orders: 0,
        avgOrderValue: 0,
      });
    }
    todayOrders.forEach((o) => {
      const hour = getHourAppTz(o.createdAt);
      if (hour >= 0 && hour < 24) {
        const b = hourlyBreakdown[hour];
        b.revenue += Number(o.total) || 0;
        b.profit += Number(o.grossProfit) || 0;
        b.orders += 1;
      }
    });
    hourlyBreakdown.forEach((b) => {
      b.avgOrderValue = b.orders > 0 ? b.revenue / b.orders : 0;
    });
    const maxRevenue = Math.max(...hourlyBreakdown.map((b) => b.revenue), 0);
    if (maxRevenue > 0) {
      const peak = hourlyBreakdown.find((b) => b.revenue === maxRevenue);
      peakRevenueHour = peak ? peak.hour : null;
    }
    return { hourlyBreakdown, peakRevenueHour };
  }, [allOrders, period, todayStr]);
}
