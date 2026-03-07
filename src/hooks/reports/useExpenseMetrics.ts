import { useMemo } from 'react';
import { EXPENSE_PURPOSE_OPTIONS } from '@/lib/expenseConstants';
import { isRestockPurpose } from '@/lib/reportHelpers';

interface ExpenseLike {
  purpose?: string;
  amount?: number;
}

export interface ExpenseByPurposeRow {
  purpose: string;
  count: number;
  amount: number;
  prevAmount?: number;
  pctChange?: number;
}

export interface ExpenseMetricsResult {
  restockExpenses: number;
  operatingExpenses: number;
  expensesByPurpose: ExpenseByPurposeRow[];
}

export function useExpenseMetrics(
  periodExpList: ExpenseLike[],
  prevPeriodExpList: ExpenseLike[]
): ExpenseMetricsResult {
  return useMemo(() => {
    const restockExpenses = periodExpList
      .filter((e) => isRestockPurpose((e.purpose as string) ?? ''))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const operatingExpenses = periodExpList
      .filter((e) => !isRestockPurpose((e.purpose as string) ?? ''))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const expensesByPurposeMap = new Map<
      string,
      { purpose: string; count: number; amount: number }
    >();
    (EXPENSE_PURPOSE_OPTIONS as readonly string[]).forEach((purpose) => {
      if (!isRestockPurpose(purpose)) {
        expensesByPurposeMap.set(purpose, { purpose, count: 0, amount: 0 });
      }
    });
    periodExpList.forEach((e) => {
      const purpose = (e.purpose || '').trim();
      if (isRestockPurpose(purpose)) return;
      const normalizedPurpose = (EXPENSE_PURPOSE_OPTIONS as readonly string[]).includes(purpose)
        ? purpose
        : 'other';
      const amount = Number(e.amount) || 0;
      const existing =
        expensesByPurposeMap.get(normalizedPurpose) ||
        { purpose: normalizedPurpose, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += amount;
      expensesByPurposeMap.set(normalizedPurpose, existing);
    });
    const prevExpensesByPurposeMap = new Map<string, number>();
    prevPeriodExpList.forEach((e) => {
      const purpose = (e.purpose || '').trim();
      if (isRestockPurpose(purpose)) return;
      const normalizedPurpose = (EXPENSE_PURPOSE_OPTIONS as readonly string[]).includes(purpose)
        ? purpose
        : 'other';
      const amount = Number(e.amount) || 0;
      prevExpensesByPurposeMap.set(
        normalizedPurpose,
        (prevExpensesByPurposeMap.get(normalizedPurpose) || 0) + amount
      );
    });
    const expensesByPurpose = Array.from(expensesByPurposeMap.values())
      .filter((ep) => ep.amount > 0 || ep.count > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((ep) => {
        const prevAmount = prevExpensesByPurposeMap.get(ep.purpose) || 0;
        const pctChange =
          prevAmount !== 0
            ? ((ep.amount - prevAmount) / prevAmount) * 100
            : ep.amount !== 0
              ? 100
              : 0;
        return { ...ep, prevAmount, pctChange };
      });
    return {
      restockExpenses,
      operatingExpenses,
      expensesByPurpose,
    };
  }, [periodExpList, prevPeriodExpList]);
}
