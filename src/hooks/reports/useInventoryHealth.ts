import { useMemo } from 'react';

interface OrderLike {
  createdAt: string;
  status?: string;
  orderType?: string;
  items?: Array<{ productId?: string; qty?: number }>;
}

interface ProductLike {
  id: string;
  stock?: number;
}

function notCancelled(status: string) {
  return status !== 'cancelled';
}

export interface InventoryHealthResult {
  deadStockCount: number;
  avgTurnover: number;
  inventoryHealthScore: number;
}

export function useInventoryHealth(
  allOrders: OrderLike[],
  allProducts: ProductLike[],
  lowStockCount: number
): InventoryHealthResult {
  return useMemo(() => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const productIdsSoldLast60 = new Set<string>();
    allOrders
      .filter(
        (o) =>
          o.createdAt >= sixtyDaysAgo &&
          notCancelled(o.status ?? '') &&
          o.orderType !== 'return'
      )
      .forEach((o) => {
        (o.items || []).forEach((item) => {
          if (item.productId) productIdsSoldLast60.add(item.productId);
        });
      });
    const deadStockCount = allProducts.filter(
      (p) => (Number(p.stock) || 0) > 0 && !productIdsSoldLast60.has(p.id)
    ).length;
    const productUnitsSoldInPeriod = new Map<string, number>();
    allOrders
      .filter((o) => o.createdAt >= sixtyDaysAgo && notCancelled(o.status ?? '') && o.orderType !== 'return')
      .forEach((o) => {
        (o.items || []).forEach((item) => {
          const id = item.productId;
          if (!id) return;
          const qty = Number(item.qty) || 0;
          productUnitsSoldInPeriod.set(
            id,
            (productUnitsSoldInPeriod.get(id) || 0) + qty
          );
        });
      });
    let turnoverSum = 0;
    let turnoverCount = 0;
    productUnitsSoldInPeriod.forEach((sold, productId) => {
      const p = allProducts.find((x) => x.id === productId);
      if (!p) return;
      const stock = Number(p.stock) || 0;
      if (stock > 0) {
        turnoverSum += sold / stock;
        turnoverCount++;
      }
    });
    const avgTurnover = turnoverCount > 0 ? turnoverSum / turnoverCount : 0;
    const totalProducts = allProducts.length || 1;
    const inStockPct =
      totalProducts > 0 ? ((totalProducts - lowStockCount) / totalProducts) * 100 : 100;
    const turnoverScore = Math.min(100, avgTurnover * 20);
    const inventoryHealthScore = Math.round(0.6 * inStockPct + 0.4 * turnoverScore);
    return {
      deadStockCount,
      avgTurnover,
      inventoryHealthScore,
    };
  }, [allOrders, allProducts, lowStockCount]);
}
