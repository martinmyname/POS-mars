import { useMemo } from 'react';
import { getStartOfDayAppTzAsUTC, getEndOfDayAppTzAsUTC, addDaysToDateStr } from '@/lib/appTimezone';
import { isRestockPurpose } from '@/lib/reportHelpers';
import type { PeriodBounds } from '@/hooks/usePeriodRange';

interface ExpenseLike {
  date: string;
  purpose?: string;
  amount?: number;
}

interface OrderLike {
  createdAt: string;
  status?: string;
  total?: number;
  grossProfit?: number;
}

export interface ReportPeriodDataResult {
  ordersToday: number;
  revenueToday: number;
  profitToday: number;
  expensesToday: number;
  ordersYesterday: number;
  revenueYesterday: number;
  profitYesterday: number;
  ordersTodayPct: number;
  revenueTodayPct: number;
  profitTodayPct: number;
  expensesTodayPct: number;
  last7DaysSparkline: Array<{ day: string; orders: number; revenue: number; profit: number; expenses: number }>;
  ordersPeriod: number;
  revenuePeriod: number;
  profitPeriod: number;
  expensesPeriod: number;
  previousPeriodOrders: number;
  previousPeriodRevenue: number;
  previousPeriodProfit: number;
  previousPeriodExpenses: number;
  allOrders: OrderLike[];
  allExpenses: ExpenseLike[];
  periodExpList: ExpenseLike[];
  prevPeriodExpList: ExpenseLike[];
}

export function useReportPeriodData(
  ordersList: OrderLike[] | null | undefined,
  expensesList: ExpenseLike[] | null | undefined,
  productsList: unknown[],
  current: PeriodBounds,
  previous: PeriodBounds,
  currentDateStr: { from: string; to: string },
  previousDateStr: { from: string; to: string },
  todayStr: string
): ReportPeriodDataResult & { allProducts: unknown[] } {
  return useMemo(() => {
    const todayStart = getStartOfDayAppTzAsUTC(todayStr).toISOString();
    const todayEnd = getEndOfDayAppTzAsUTC(todayStr).toISOString();
    const yesterdayStr = addDaysToDateStr(todayStr, -1);
    const yesterdayStart = getStartOfDayAppTzAsUTC(yesterdayStr).toISOString();
    const yesterdayEnd = getEndOfDayAppTzAsUTC(yesterdayStr).toISOString();
    const list = (ordersList || []).filter((o) => (o.status ?? '') !== 'cancelled');
    const todayList = list.filter((o) => o.createdAt >= todayStart && o.createdAt < todayEnd);
    const yesterdayList = list.filter((o) => o.createdAt >= yesterdayStart && o.createdAt < yesterdayEnd);
    const periodList = list.filter((o) => o.createdAt >= current.from && o.createdAt < current.to);
    const prevPeriodList = list.filter((o) => o.createdAt >= previous.from && o.createdAt < previous.to);

    const ordersToday = todayList.length;
    const revenueToday = todayList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const profitToday = todayList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
    const ordersYesterday = yesterdayList.length;
    const revenueYesterday = yesterdayList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const profitYesterday = yesterdayList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
    const ordersPeriod = periodList.length;
    const revenuePeriod = periodList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const profitPeriod = periodList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
    const previousPeriodOrders = prevPeriodList.length;
    const previousPeriodRevenue = prevPeriodList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const previousPeriodProfit = prevPeriodList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);

    const expList = expensesList || [];
    const isOperatingExpense = (p: string) => !isRestockPurpose(p);
    const todayExpList = expList.filter((e) => e.date.slice(0, 10) === todayStr);
    const todayOperatingExpenses = todayExpList
      .filter((e) => isOperatingExpense((e.purpose as string) ?? ''))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const periodExpList = expList.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= currentDateStr.from && d <= currentDateStr.to;
    });
    const prevPeriodExpList = expList.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= previousDateStr.from && d <= previousDateStr.to;
    });
    const expensesPeriod = periodExpList.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const previousPeriodExpenses = prevPeriodExpList.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const sameDayLastWeekStr = addDaysToDateStr(todayStr, -7);
    const sameDayLastWeekStart = getStartOfDayAppTzAsUTC(sameDayLastWeekStr).toISOString();
    const sameDayLastWeekEnd = getEndOfDayAppTzAsUTC(sameDayLastWeekStr).toISOString();
    const lastWeekDayList = list.filter((o) => o.createdAt >= sameDayLastWeekStart && o.createdAt < sameDayLastWeekEnd);
    const lastWeekExpList = expList.filter((e) => e.date.slice(0, 10) === sameDayLastWeekStr);
    const ordersSameDayLastWeek = lastWeekDayList.length;
    const revenueSameDayLastWeek = lastWeekDayList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const profitSameDayLastWeek = lastWeekDayList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
    const expensesSameDayLastWeek = lastWeekExpList
      .filter((e) => isOperatingExpense((e.purpose as string) ?? ''))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const pctChange = (curr: number, prev: number) =>
      prev !== 0 ? ((curr - prev) / prev) * 100 : curr !== 0 ? 100 : 0;
    const ordersTodayPct = pctChange(ordersToday, ordersSameDayLastWeek);
    const revenueTodayPct = pctChange(revenueToday, revenueSameDayLastWeek);
    const profitTodayPct = pctChange(profitToday, profitSameDayLastWeek);
    const expensesTodayPct = pctChange(todayOperatingExpenses, expensesSameDayLastWeek);

    const last7DaysSparkline: Array<{ day: string; orders: number; revenue: number; profit: number; expenses: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStrI = addDaysToDateStr(todayStr, -i);
      const dayStart = getStartOfDayAppTzAsUTC(dayStrI).toISOString();
      const dayEnd = getEndOfDayAppTzAsUTC(dayStrI).toISOString();
      const dayOrders = list.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
      const dayExp = expList
        .filter((e) => e.date.slice(0, 10) === dayStrI)
        .filter((e) => isOperatingExpense((e.purpose as string) ?? ''));
      last7DaysSparkline.push({
        day: new Date(getStartOfDayAppTzAsUTC(dayStrI).getTime()).toLocaleDateString('en-GB', {
          timeZone: 'Africa/Kampala',
          weekday: 'short',
        }),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
        profit: dayOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0),
        expenses: dayExp.reduce((s, e) => s + (Number(e.amount) || 0), 0),
      });
    }

    return {
      ordersToday,
      revenueToday,
      profitToday,
      ordersYesterday,
      revenueYesterday,
      profitYesterday,
      expensesToday: todayOperatingExpenses,
      ordersTodayPct,
      revenueTodayPct,
      profitTodayPct,
      expensesTodayPct,
      last7DaysSparkline,
      ordersPeriod,
      revenuePeriod,
      profitPeriod,
      expensesPeriod,
      previousPeriodOrders,
      previousPeriodRevenue,
      previousPeriodProfit,
      previousPeriodExpenses,
      allOrders: list,
      allExpenses: expList,
      allProducts: productsList || [],
      periodExpList,
      prevPeriodExpList,
    };
  }, [
    ordersList,
    expensesList,
    productsList,
    current.from,
    current.to,
    previous.from,
    previous.to,
    currentDateStr.from,
    currentDateStr.to,
    previousDateStr.from,
    previousDateStr.to,
    todayStr,
  ]);
}
