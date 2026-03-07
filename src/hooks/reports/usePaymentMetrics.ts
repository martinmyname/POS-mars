import { useMemo } from 'react';
import type { PaymentMethodBreakdown } from './types';

interface OrderLike {
  total?: number;
  paymentMethod?: string;
  paymentSplits?: Array<{ method?: string; amount?: number }>;
}

export function usePaymentMetrics(periodOrders: OrderLike[]): PaymentMethodBreakdown[] {
  return useMemo(() => {
    const paymentMap = new Map<string, PaymentMethodBreakdown>();
    periodOrders.forEach((order) => {
      const splits =
        order.paymentSplits && order.paymentSplits.length > 0 ? order.paymentSplits : null;
      if (splits) {
        (splits as { method: string; amount: number }[]).forEach((split) => {
          const method = split.method || 'cash';
          const amount = Number(split.amount) || 0;
          const existing = paymentMap.get(method) || { method, count: 0, amount: 0 };
          existing.count += 1;
          existing.amount += amount;
          paymentMap.set(method, existing);
        });
      } else {
        const method = order.paymentMethod || 'cash';
        const amount = Number(order.total) || 0;
        const existing = paymentMap.get(method) || { method, count: 0, amount: 0 };
        existing.count += 1;
        existing.amount += amount;
        paymentMap.set(method, existing);
      }
    });
    return Array.from(paymentMap.values()).sort((a, b) => b.amount - a.amount);
  }, [periodOrders]);
}
