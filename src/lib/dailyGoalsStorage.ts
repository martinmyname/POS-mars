/**
 * Daily goals for Reports page (Revenue, Orders, Profit targets).
 * Persisted in localStorage.
 */

const STORAGE_KEY = 'pos-reports-daily-goals';

export interface DailyGoals {
  revenueTarget: number;
  ordersTarget: number;
  profitTarget: number;
}

const DEFAULT_GOALS: DailyGoals = {
  revenueTarget: 0,
  ordersTarget: 0,
  profitTarget: 0,
};

export function getDailyGoals(): DailyGoals {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GOALS };
    const parsed = JSON.parse(raw) as Partial<DailyGoals>;
    return {
      revenueTarget: Number(parsed.revenueTarget) || 0,
      ordersTarget: Number(parsed.ordersTarget) || 0,
      profitTarget: Number(parsed.profitTarget) || 0,
    };
  } catch {
    return { ...DEFAULT_GOALS };
  }
}

export function setDailyGoals(goals: DailyGoals): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // ignore
  }
}

/** Yesterday's actuals (revenue, orders, profit) for the previous calendar day in app timezone. */
export interface YesterdayActuals {
  revenue: number;
  orders: number;
  profit: number;
}

/**
 * Effective goals for today: your general (base) goals, but if yesterday did better
 * than the base goal, use yesterday's actual as the target so you aim to match or beat it.
 */
export function getEffectiveDailyGoals(
  base: DailyGoals,
  yesterday: YesterdayActuals
): DailyGoals {
  return {
    revenueTarget: Math.max(base.revenueTarget, yesterday.revenue),
    ordersTarget: Math.max(base.ordersTarget, yesterday.orders),
    profitTarget: Math.max(base.profitTarget, yesterday.profit),
  };
}
