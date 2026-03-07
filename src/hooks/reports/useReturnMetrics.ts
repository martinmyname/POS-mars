import { useMemo } from 'react';

interface OrderLike {
  orderType?: string;
  total?: number;
  notes?: string;
  items?: Array<{ productId?: string; qty?: number }>;
}

interface ProductLike {
  id: string;
  name?: string;
}

export interface TopReturnedProduct {
  productId: string;
  name: string;
  qtyReturned: number;
  reason: string;
}

export interface ReturnMetricsResult {
  returnRate: number;
  returnOrders: number;
  totalRefunded: number;
  topReturnedProducts: TopReturnedProduct[];
}

export function useReturnMetrics(
  periodOrders: OrderLike[],
  allProducts: ProductLike[],
  ordersPeriod: number
): ReturnMetricsResult {
  return useMemo(() => {
    const returnOrdersList = periodOrders.filter((o) => o.orderType === 'return');
    const returnOrders = returnOrdersList.length;
    const returnRate = ordersPeriod > 0 ? (returnOrders / ordersPeriod) * 100 : 0;
    const totalRefunded = returnOrdersList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const returnedByProduct = new Map<string, { qty: number; reason: string }>();
    returnOrdersList.forEach((o) => {
      const reason = (o.notes || '—').slice(0, 50);
      (o.items || []).forEach((item) => {
        const id = item.productId;
        if (!id) return;
        const qty = Number(item.qty) || 0;
        const existing = returnedByProduct.get(id);
        if (!existing) returnedByProduct.set(id, { qty, reason });
        else {
          existing.qty += qty;
          if (reason && reason !== '—') existing.reason = reason;
        }
      });
    });
    const topReturnedProducts = Array.from(returnedByProduct.entries())
      .map(([productId, { qty, reason }]) => ({
        productId,
        name: allProducts.find((p) => p.id === productId)?.name ?? 'Unknown',
        qtyReturned: qty,
        reason,
      }))
      .sort((a, b) => b.qtyReturned - a.qtyReturned)
      .slice(0, 10);
    return {
      returnRate,
      returnOrders,
      totalRefunded,
      topReturnedProducts,
    };
  }, [periodOrders, allProducts, ordersPeriod]);
}
