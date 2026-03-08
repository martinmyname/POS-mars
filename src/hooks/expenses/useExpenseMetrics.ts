import { useMemo } from 'react';
import {
  EXPENSE_PURPOSE_OPTIONS,
  PURPOSE_COLORS,
  UNCATEGORIZED_LABEL,
} from '@/lib/expenseConstants';
import { isRestockPurpose } from '@/lib/reportHelpers';
import { isToday, isThisWeek, isThisMonth } from '@/utils/dateUtils';
import { getTodayInAppTz, getWeekdayInAppTz, addDaysToDateStr } from '@/lib/appTimezone';

export interface ExpenseLike {
  id: string;
  date: string;
  itemBought: string;
  purpose: string;
  amount: number;
  paidBy: string;
  paidByWho: string;
  notes?: string;
}

export type ExpensePeriod = 'today' | 'week' | 'month' | 'all';

function inPeriod(dateStr: string, period: ExpensePeriod): boolean {
  if (period === 'today') return isToday(dateStr);
  if (period === 'week') return isThisWeek(dateStr);
  if (period === 'month') return isThisMonth(dateStr);
  return true;
}


export interface ByPurposeRow {
  purpose: string;
  total: number;
  count: number;
  color: string;
}

export interface ExpenseMetricsResult {
  todayTotal: number;
  monthTotal: number;
  operatingExpenses: number;
  restockExpenses: number;
  periodTotal: number;
  byPurpose: ByPurposeRow[];
  avgPerDay: number;
  biggestExpense: ExpenseLike | null;
  topPurpose: ByPurposeRow | null;
  topPayer: { who: string; total: number } | null;
  todayCount: number;
  monthCount: number;
  /** Week-over-week change (this week sum vs last week sum), as decimal e.g. 0.1 = +10% */
  weekOverWeekChange: number | null;
  /** Last 6 calendar months: { monthKey: 'YYYY-MM', total } for sparklines */
  last6MonthsByPurpose: Record<string, Record<string, number>>;
}

const PAYER_OPTIONS = ['Staff', 'Owner', 'Manager', 'Accountant'];

export function useExpenseMetrics(
  expenses: ExpenseLike[],
  period: ExpensePeriod = 'month'
): ExpenseMetricsResult {
  return useMemo(() => {
    const periodExp = expenses.filter((e) => inPeriod(e.date, period));
    const monthExp = expenses.filter((e) => isThisMonth(e.date));
    const todayExp = expenses.filter((e) => isToday(e.date));

    const sum = (arr: ExpenseLike[]) =>
      arr.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const todayTotal = sum(todayExp);
    const monthTotal = sum(monthExp);
    const operatingExpenses = sum(
      monthExp.filter((e) => !isRestockPurpose(e.purpose))
    );
    const restockExpenses = sum(monthExp.filter((e) => isRestockPurpose(e.purpose)));
    const periodTotal = sum(periodExp);

    const normPurpose = (p: string) => {
      const t = (p || '').trim();
      return (EXPENSE_PURPOSE_OPTIONS as readonly string[]).includes(t)
        ? t
        : UNCATEGORIZED_LABEL;
    };
    const byPurposeRows = (EXPENSE_PURPOSE_OPTIONS as readonly string[]).map(
      (p) => ({
        purpose: p,
        total: sum(periodExp.filter((e) => normPurpose(e.purpose) === p)),
        count: periodExp.filter((e) => normPurpose(e.purpose) === p).length,
        color: PURPOSE_COLORS[p] ?? '#adb5bd',
      })
    );
    const uncatTotal = sum(periodExp.filter((e) => normPurpose(e.purpose) === UNCATEGORIZED_LABEL));
    const uncatCount = periodExp.filter((e) => normPurpose(e.purpose) === UNCATEGORIZED_LABEL).length;
    const byPurpose = [
      ...byPurposeRows.filter((p) => p.total > 0),
      ...(uncatTotal > 0 ? [{ purpose: UNCATEGORIZED_LABEL, total: uncatTotal, count: uncatCount, color: PURPOSE_COLORS[UNCATEGORIZED_LABEL] ?? '#adb5bd' }] : []),
    ].sort((a, b) => b.total - a.total);

    const todayStr = getTodayInAppTz();
    const dayOfMonth = Math.max(1, parseInt(todayStr.split('-')[2] ?? '1', 10));
    const avgPerDay = monthTotal / dayOfMonth;

    const biggestExpense = monthExp.reduce(
      (mx, e) =>
        (Number(e.amount) || 0) > (mx ? Number(mx.amount) || 0 : 0) ? e : mx,
      null as ExpenseLike | null
    );

    const topPurpose =
      byPurpose.find((p) => p.purpose !== UNCATEGORIZED_LABEL) ?? byPurpose[0] ?? null;
    const topPayer = PAYER_OPTIONS.map((who) => ({
      who,
      total: sum(monthExp.filter((e) => (e.paidByWho || '').trim() === who)),
    }))
      .filter((p) => p.total > 0)
      .sort((a, b) => b.total - a.total)[0] ?? null;

    const daysBackToMonday =
      (getWeekdayInAppTz(todayStr) + 6) % 7;
    const mondayStr = addDaysToDateStr(todayStr, -daysBackToMonday);
    const lastWeekStart = addDaysToDateStr(mondayStr, -7);
    const lastWeekEnd = addDaysToDateStr(mondayStr, -1);
    const thisWeekExp = expenses.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= mondayStr && d <= todayStr;
    });
    const lastWeekExp = expenses.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= lastWeekStart && d <= lastWeekEnd;
    });
    const thisWeekSum = sum(thisWeekExp);
    const lastWeekSum = sum(lastWeekExp);
    const weekOverWeekChange =
      lastWeekSum > 0 ? (thisWeekSum - lastWeekSum) / lastWeekSum : null;

    const last6MonthsByPurpose: Record<string, Record<string, number>> = {};
    const [y, m] = todayStr.split('-').map(Number);
    for (let i = 0; i < 6; i++) {
      let mm = m - i;
      let yy = y;
      if (mm <= 0) {
        mm += 12;
        yy -= 1;
      }
      const monthKey = `${yy}-${String(mm).padStart(2, '0')}`;
      const monthExpList = expenses.filter(
        (e) => e.date.slice(0, 7) === monthKey
      );
      last6MonthsByPurpose[monthKey] = {};
      (EXPENSE_PURPOSE_OPTIONS as readonly string[]).forEach((p) => {
        const total = sum(
          monthExpList.filter((e) => normPurpose(e.purpose) === p)
        );
        if (total > 0) last6MonthsByPurpose[monthKey][p] = total;
      });
      const uncat = sum(monthExpList.filter((e) => normPurpose(e.purpose) === UNCATEGORIZED_LABEL));
      if (uncat > 0) last6MonthsByPurpose[monthKey][UNCATEGORIZED_LABEL] = uncat;
    }

    return {
      todayTotal,
      monthTotal,
      operatingExpenses,
      restockExpenses,
      periodTotal,
      byPurpose,
      avgPerDay,
      biggestExpense,
      topPurpose,
      topPayer,
      todayCount: todayExp.length,
      monthCount: monthExp.length,
      weekOverWeekChange,
      last6MonthsByPurpose,
    };
  }, [expenses, period]);
}