import { useMemo } from 'react';
import {
  getStartOfDayAppTzAsUTC,
  getEndOfDayAppTzAsUTC,
  addDaysToDateStr,
  getWeekRangeInAppTz,
  getMonthRangeInAppTz,
  getYearRangeInAppTz,
} from '@/lib/appTimezone';
import { isRestockPurpose } from '@/lib/reportHelpers';
import type { PeriodType } from '@/hooks/usePeriodRange';

interface OrderLike {
  createdAt: string;
  orderType?: string;
  total?: number;
  grossProfit?: number;
  items?: Array<{ costPrice?: number; qty?: number }>;
}

interface ExpenseLike {
  date: string;
  purpose?: string;
  amount?: number;
}

interface SupplierLedgerLike {
  type?: string;
  date?: string;
  amount?: number;
}

export type TimeSeriesRow = {
  date: string;
  revenue: number;
  profit: number;
  expenses: number;
  orders: number;
  marginPct: number;
};

export type GrossProfitHistoryRow = {
  periodLabel: string;
  revenue: number;
  grossProfit: number;
  marginPct: number;
  orders: number;
  vsPreviousPct: number | null;
};

export interface PeriodMetricsCoreResult {
  grossIncome: number;
  cogs: number;
  restockExpenses: number;
  operatingExpenses: number;
  netOperatingProfit: number;
  netProfit: number;
  netCashPosition: number;
  cashFlowWaterfall: Array<{ label: string; value: number; type: 'inflow' | 'outflow' | 'subtotal' }>;
  avgOrderValue: number;
  profitMargin: number;
  netProfitMargin: number;
  costToRevenueRatio: number;
  revenueGrowth: number;
  profitGrowth: number;
  ordersGrowth: number;
  expenseGrowth: number;
  netProfitGrowth: number;
  operatingExpensesGrowth: number;
  restockExpensesGrowth: number;
  timeSeriesData: TimeSeriesRow[];
  grossProfitHistory: GrossProfitHistoryRow[];
  bestProfitPeriodLabel: string | null;
  worstProfitPeriodLabel: string | null;
}

export function usePeriodMetricsCore(
  allOrders: OrderLike[],
  allExpenses: ExpenseLike[],
  periodOrders: OrderLike[],
  periodExpList: ExpenseLike[],
  prevPeriodExpList: ExpenseLike[],
  period: PeriodType,
  currentDateStr: { from: string; to: string },
  todayStr: string,
  revenuePeriod: number,
  profitPeriod: number,
  expensesPeriod: number,
  ordersPeriod: number,
  previousPeriodRevenue: number,
  previousPeriodProfit: number,
  previousPeriodOrders: number,
  previousPeriodExpenses: number,
  supplierLedgerList: SupplierLedgerLike[] | null | undefined
): PeriodMetricsCoreResult {
  return useMemo(() => {
    const periodStartDateStr = currentDateStr.from;
    const periodEndDateStr = currentDateStr.to;
    const grossIncome = Number(revenuePeriod) || 0;
    const restockExpenses = periodExpList
      .filter((e) => isRestockPurpose((e.purpose as string) ?? ''))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const operatingExpenses = periodExpList
      .filter((e) => !isRestockPurpose((e.purpose as string) ?? ''))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expenses = Number(expensesPeriod) || 0;

    let cogs = 0;
    periodOrders.forEach((order) => {
      const sign = order.orderType === 'return' ? -1 : 1;
      (order.items || []).forEach((item) => {
        cogs += sign * (Number(item.costPrice) || 0) * (Number(item.qty) || 0);
      });
    });
    const supplierLedger = supplierLedgerList || [];
    const supplierPayments = supplierLedger
      .filter(
        (e) =>
          (e.type || '').toLowerCase() === 'payment' &&
          (e.date ?? '') >= periodStartDateStr &&
          (e.date ?? '') <= periodEndDateStr
      )
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const netOperatingProfit = (Number(profitPeriod) || 0) - operatingExpenses;
    const netCashPosition = netOperatingProfit - restockExpenses - supplierPayments;
    const cashFlowWaterfall: Array<{
      label: string;
      value: number;
      type: 'inflow' | 'outflow' | 'subtotal';
    }> = [
      { label: 'Revenue', value: grossIncome, type: 'inflow' },
      { label: 'COGS', value: -cogs, type: 'outflow' },
      { label: 'Gross Profit', value: Number(profitPeriod) || 0, type: 'subtotal' },
      { label: 'Operating Expenses', value: -operatingExpenses, type: 'outflow' },
      { label: 'Net Operating Profit', value: netOperatingProfit, type: 'subtotal' },
      { label: 'Restock / Stock', value: -restockExpenses, type: 'outflow' },
      { label: 'Supplier Payments', value: -supplierPayments, type: 'outflow' },
      { label: 'Net Cash Position', value: netCashPosition, type: 'subtotal' },
    ];
    const netProfit = (Number(profitPeriod) || 0) - operatingExpenses;
    const avgOrderValue = ordersPeriod > 0 ? grossIncome / ordersPeriod : 0;
    const profitMargin = grossIncome > 0 ? (profitPeriod / grossIncome) * 100 : 0;
    const netProfitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;
    const costToRevenueRatio =
      grossIncome > 0 ? ((cogs + operatingExpenses) / grossIncome) * 100 : 0;

    const formatDayLabel = (dayStr: string) =>
      new Date(getStartOfDayAppTzAsUTC(dayStr).getTime()).toLocaleDateString('en-GB', {
        timeZone: 'Africa/Kampala',
        month: 'short',
        day: '2-digit',
      });

    const timeSeriesData: TimeSeriesRow[] = [];
    if (period === 'daily') {
      for (let i = 13; i >= 0; i--) {
        const dayStr = addDaysToDateStr(todayStr, -i);
        const dayStart = getStartOfDayAppTzAsUTC(dayStr).toISOString();
        const dayEnd = getEndOfDayAppTzAsUTC(dayStr).toISOString();
        const dayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
        const dayExpenses = allExpenses.filter((e) => (e.date ?? '').slice(0, 10) === dayStr);
        const dayOperatingExpenses = dayExpenses
          .filter((e) => !isRestockPurpose((e.purpose as string) ?? ''))
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const dayRevenue = dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const dayProfit = dayOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
        timeSeriesData.push({
          date: formatDayLabel(dayStr),
          revenue: dayRevenue,
          profit: dayProfit,
          expenses: dayOperatingExpenses,
          orders: dayOrders.length,
          marginPct: dayRevenue > 0 ? (dayProfit / dayRevenue) * 100 : 0,
        });
      }
    } else if (period === 'weekly') {
      const mondayStr = new Date(getWeekRangeInAppTz(todayStr).start).toLocaleDateString('en-CA', {
        timeZone: 'Africa/Kampala',
      });
      for (let i = 11; i >= 0; i--) {
        const weekMondayStr = addDaysToDateStr(mondayStr, -7 * i);
        const weekRange = getWeekRangeInAppTz(weekMondayStr);
        const weekOrders = allOrders.filter(
          (o) => o.createdAt >= weekRange.start && o.createdAt < weekRange.end
        );
        const weekEndDateStr = addDaysToDateStr(weekMondayStr, 6);
        const weekExpenses = allExpenses.filter((e) => {
          const d = (e.date ?? '').slice(0, 10);
          return d >= weekMondayStr && d <= weekEndDateStr;
        });
        const weekOperatingExpenses = weekExpenses
          .filter((e) => !isRestockPurpose((e.purpose as string) ?? ''))
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const weekRevenue = weekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const weekProfit = weekOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
        timeSeriesData.push({
          date: formatDayLabel(weekMondayStr),
          revenue: weekRevenue,
          profit: weekProfit,
          expenses: weekOperatingExpenses,
          orders: weekOrders.length,
          marginPct: weekRevenue > 0 ? (weekProfit / weekRevenue) * 100 : 0,
        });
      }
    } else if (period === 'monthly') {
      const [y, m] = todayStr.split('-').map(Number);
      for (let i = 11; i >= 0; i--) {
        const month = m - i <= 0 ? m - i + 12 : m - i;
        const year = m - i <= 0 ? y - 1 : y;
        const monthFirstStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const monthRange = getMonthRangeInAppTz(monthFirstStr);
        const monthOrders = allOrders.filter(
          (o) => o.createdAt >= monthRange.start && o.createdAt < monthRange.end
        );
        const lastD = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const monthLastStr = `${year}-${String(month).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const monthExpenses = allExpenses.filter((e) => {
          const d = (e.date ?? '').slice(0, 10);
          return d >= monthFirstStr && d <= monthLastStr;
        });
        const monthOperatingExpenses = monthExpenses
          .filter((e) => !isRestockPurpose((e.purpose as string) ?? ''))
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const monthRevenue = monthOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const monthProfit = monthOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
        timeSeriesData.push({
          date: new Date(getStartOfDayAppTzAsUTC(monthFirstStr).getTime()).toLocaleDateString(
            'en-GB',
            { timeZone: 'Africa/Kampala', month: 'short', year: 'numeric' }
          ),
          revenue: monthRevenue,
          profit: monthProfit,
          expenses: monthOperatingExpenses,
          orders: monthOrders.length,
          marginPct: monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0,
        });
      }
    } else {
      const [y] = todayStr.split('-').map(Number);
      for (let i = 5; i >= 0; i--) {
        const yearStr = `${y - i}-01-01`;
        const yearRange = getYearRangeInAppTz(yearStr);
        const yearOrders = allOrders.filter(
          (o) => o.createdAt >= yearRange.start && o.createdAt < yearRange.end
        );
        const yearEndStr = `${y - i}-12-31`;
        const yearExpenses = allExpenses.filter((e) => {
          const d = (e.date ?? '').slice(0, 10);
          return d >= yearStr && d <= yearEndStr;
        });
        const yearOperatingExpenses = yearExpenses
          .filter((e) => !isRestockPurpose((e.purpose as string) ?? ''))
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const yearRevenue = yearOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const yearProfit = yearOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
        timeSeriesData.push({
          date: String(y - i),
          revenue: yearRevenue,
          profit: yearProfit,
          expenses: yearOperatingExpenses,
          orders: yearOrders.length,
          marginPct: yearRevenue > 0 ? (yearProfit / yearRevenue) * 100 : 0,
        });
      }
    }

    const grossProfitHistoryWithVs = timeSeriesData.map((row, i) => {
      const prev = timeSeriesData[i - 1];
      const vsPreviousPct =
        prev != null && prev.profit !== 0 ? ((row.profit - prev.profit) / prev.profit) * 100 : null;
      return {
        periodLabel: row.date,
        revenue: row.revenue,
        grossProfit: row.profit,
        marginPct: row.marginPct,
        orders: row.orders,
        vsPreviousPct,
      };
    });
    const grossProfitHistory = [...grossProfitHistoryWithVs].reverse();
    const bestProfitRow =
      grossProfitHistory.length > 0
        ? grossProfitHistory.reduce((best, row) =>
            row.grossProfit > best.grossProfit ? row : best
          , grossProfitHistory[0])
        : null;
    const worstProfitRow =
      grossProfitHistory.length > 0
        ? grossProfitHistory.reduce((worst, row) =>
            row.grossProfit < worst.grossProfit ? row : worst
          , grossProfitHistory[0])
        : null;

    const revenueGrowth =
      previousPeriodRevenue > 0
        ? ((grossIncome - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : grossIncome > 0
          ? 100
          : 0;
    const profitGrowth =
      previousPeriodProfit > 0
        ? ((profitPeriod - previousPeriodProfit) / previousPeriodProfit) * 100
        : profitPeriod > 0
          ? 100
          : 0;
    const ordersGrowth =
      previousPeriodOrders > 0
        ? ((ordersPeriod - previousPeriodOrders) / previousPeriodOrders) * 100
        : ordersPeriod > 0
          ? 100
          : 0;
    const prevOperatingExpenses = prevPeriodExpList
      .filter((e) => !isRestockPurpose((e.purpose as string) ?? ''))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const prevRestockExpenses = prevPeriodExpList
      .filter((e) => isRestockPurpose((e.purpose as string) ?? ''))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const operatingExpensesGrowth =
      prevOperatingExpenses !== 0
        ? ((operatingExpenses - prevOperatingExpenses) / prevOperatingExpenses) * 100
        : operatingExpenses !== 0
          ? 100
          : 0;
    const restockExpensesGrowth =
      prevRestockExpenses !== 0
        ? ((restockExpenses - prevRestockExpenses) / prevRestockExpenses) * 100
        : restockExpenses !== 0
          ? 100
          : 0;
    const expenseGrowth =
      previousPeriodExpenses > 0
        ? ((expenses - previousPeriodExpenses) / previousPeriodExpenses) * 100
        : expenses > 0
          ? 100
          : 0;
    const prevNetProfit = (Number(previousPeriodProfit) || 0) - prevOperatingExpenses;
    const netProfitGrowth =
      prevNetProfit !== 0
        ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100
        : netProfit !== 0
          ? 100
          : 0;

    return {
      grossIncome,
      cogs,
      restockExpenses,
      operatingExpenses,
      netOperatingProfit,
      netProfit,
      netCashPosition,
      cashFlowWaterfall,
      avgOrderValue,
      profitMargin,
      netProfitMargin,
      costToRevenueRatio,
      revenueGrowth,
      profitGrowth,
      ordersGrowth,
      expenseGrowth,
      netProfitGrowth,
      operatingExpensesGrowth,
      restockExpensesGrowth,
      timeSeriesData,
      grossProfitHistory,
      bestProfitPeriodLabel: bestProfitRow?.periodLabel ?? null,
      worstProfitPeriodLabel: worstProfitRow?.periodLabel ?? null,
    };
  }, [
    allOrders,
    allExpenses,
    periodOrders,
    periodExpList,
    prevPeriodExpList,
    period,
    currentDateStr.from,
    currentDateStr.to,
    todayStr,
    revenuePeriod,
    profitPeriod,
    expensesPeriod,
    ordersPeriod,
    previousPeriodRevenue,
    previousPeriodProfit,
    previousPeriodOrders,
    previousPeriodExpenses,
    supplierLedgerList,
  ]);
}
