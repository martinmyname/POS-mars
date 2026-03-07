import { useMemo } from 'react';

interface OrderLike {
  customerId?: string | null;
  createdAt: string;
  total?: number;
  customer?: { name?: string; phone?: string };
}

export interface TopCustomerRow {
  customerId: string;
  name: string;
  phone: string;
  visits: number;
  totalSpent: number;
  avgPerVisit: number;
  lastVisit: string;
}

export interface CustomerMetricsResult {
  topCustomersBySpend: TopCustomerRow[];
  newCustomersCount: number;
  returningCustomersCount: number;
  revenuePerCustomer: number;
  avgVisitsPerCustomer: number;
}

export function useCustomerMetrics(
  periodOrders: OrderLike[],
  allOrders: OrderLike[],
  current: { from: string; to: string },
  uniqueCustomers: number,
  ordersPeriod: number,
  grossIncome: number
): CustomerMetricsResult {
  return useMemo(() => {
    const start = current.from;
    const end = current.to;
    const firstOrderByCustomer = new Map<string, string>();
    allOrders.forEach((o) => {
      if (!o.customerId) return;
      const created = o.createdAt;
      const existing = firstOrderByCustomer.get(o.customerId);
      if (!existing || created < existing) firstOrderByCustomer.set(o.customerId, created);
    });
    const periodCustomerIds = new Set(
      periodOrders.filter((o) => o.customerId).map((o) => o.customerId as string)
    );
    let newCustomersCount = 0;
    let returningCustomersCount = 0;
    periodCustomerIds.forEach((cid) => {
      const first = firstOrderByCustomer.get(cid);
      if (!first) return;
      if (first >= start && first < end) newCustomersCount++;
      else returningCustomersCount++;
    });
    const customerAgg = new Map<
      string,
      { totalSpent: number; visits: number; lastVisit: string; name: string; phone: string }
    >();
    periodOrders.forEach((o) => {
      if (!o.customerId) return;
      const name = (o.customer as { name?: string })?.name ?? '';
      const phone = (o.customer as { phone?: string })?.phone ?? '';
      const existing = customerAgg.get(o.customerId);
      const total = Number(o.total) || 0;
      if (!existing) {
        customerAgg.set(o.customerId, {
          totalSpent: total,
          visits: 1,
          lastVisit: o.createdAt,
          name,
          phone,
        });
      } else {
        existing.totalSpent += total;
        existing.visits += 1;
        if (o.createdAt > existing.lastVisit) existing.lastVisit = o.createdAt;
        if (name) existing.name = name;
        if (phone) existing.phone = phone;
      }
    });
    const topCustomersBySpend = Array.from(customerAgg.entries())
      .map(([customerId, ag]) => ({
        customerId,
        name: ag.name || 'Guest',
        phone: ag.phone || '—',
        visits: ag.visits,
        totalSpent: ag.totalSpent,
        avgPerVisit: ag.visits > 0 ? ag.totalSpent / ag.visits : 0,
        lastVisit: ag.lastVisit,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
    const revenuePerCustomer = uniqueCustomers > 0 ? grossIncome / uniqueCustomers : 0;
    const avgVisitsPerCustomer = uniqueCustomers > 0 ? ordersPeriod / uniqueCustomers : 0;
    return {
      topCustomersBySpend,
      newCustomersCount,
      returningCustomersCount,
      revenuePerCustomer,
      avgVisitsPerCustomer,
    };
  }, [
    periodOrders,
    allOrders,
    current.from,
    current.to,
    uniqueCustomers,
    ordersPeriod,
    grossIncome,
  ]);
}
