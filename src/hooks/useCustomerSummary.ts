import { useMemo } from 'react';
import { usePeriodRange, type PeriodType } from '@/hooks/usePeriodRange';

/** Order-like shape for customer analytics. */
export interface OrderForCustomerSummary {
  customerId?: string | null;
  createdAt: string;
  orderType?: string;
  status?: string | null;
}

export interface CustomerSummaryResult {
  uniqueCustomers: number;
  returningCustomerRate: number;
  atRiskCount: number;
}

const CANCELLED = 'cancelled';

/**
 * Shared customer summary for Reports and Customers page: unique customers in period,
 * returning customer rate, at-risk count (ordered ever but not in last 30 days).
 * Uses same logic as Reports customer analytics.
 */
export function useCustomerSummary(
  orders: OrderForCustomerSummary[],
  period: PeriodType
): CustomerSummaryResult {
  const { current } = usePeriodRange(period);
  return useMemo(() => {
    const start = current.from;
    const end = current.to;
    const periodOrders = orders.filter(
      (o) => (o.status ?? '') !== CANCELLED && o.createdAt >= start && o.createdAt < end
    );
    const uniqueCustomers = new Set(
      periodOrders.filter((o) => o.customerId).map((o) => o.customerId as string)
    ).size;
    const customerOrderCounts = new Map<string, number>();
    periodOrders.forEach((o) => {
      if (o.customerId) {
        customerOrderCounts.set(o.customerId, (customerOrderCounts.get(o.customerId) ?? 0) + 1);
      }
    });
    const returningCustomers = Array.from(customerOrderCounts.values()).filter((c) => c > 1).length;
    const returningCustomerRate =
      uniqueCustomers > 0 ? (returningCustomers / uniqueCustomers) * 100 : 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const everOrderedIds = new Set(
      orders.filter((o) => o.customerId).map((o) => o.customerId as string)
    );
    const orderedLast30Ids = new Set(
      orders
        .filter((o) => o.createdAt >= thirtyDaysAgo && o.customerId)
        .map((o) => o.customerId as string)
    );
    const atRiskCount = Array.from(everOrderedIds).filter((id) => !orderedLast30Ids.has(id)).length;
    return {
      uniqueCustomers,
      returningCustomerRate,
      atRiskCount,
    };
  }, [orders, current.from, current.to]);
}
