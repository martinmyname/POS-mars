import { useMemo } from 'react';
import type { ProductSales } from './types';

interface OrderLike {
  status?: string;
  orderType?: string;
  items?: Array<{
    productId?: string;
    sellingPrice?: number;
    costPrice?: number;
    qty?: number;
  }>;
}

interface ProductLike {
  id: string;
  name?: string;
}

export function useProductMetrics(
  periodOrders: OrderLike[],
  allProducts: ProductLike[]
): ProductSales[] {
  return useMemo(() => {
    const returnedQtyByProduct = new Map<string, number>();
    periodOrders
      .filter((o) => o.orderType === 'return')
      .forEach((o) => {
        (o.items || []).forEach((item) => {
          const id = item.productId;
          if (!id) return;
          const qty = Number(item.qty) || 0;
          returnedQtyByProduct.set(id, (returnedQtyByProduct.get(id) || 0) + qty);
        });
      });

    const productSalesMap = new Map<
      string,
      Omit<ProductSales, 'marginPct' | 'totalReturns'>
    >();
    periodOrders
      .filter((order) => order.status === 'paid')
      .forEach((order) => {
        const isReturn = order.orderType === 'return';
        const sign = isReturn ? -1 : 1;
        (order.items || []).forEach((item) => {
          const product = allProducts.find((p) => p.id === item.productId);
          if (product) {
            const existing = productSalesMap.get(item.productId!) || {
              productId: item.productId!,
              name: product.name ?? '',
              qty: 0,
              revenue: 0,
              profit: 0,
            };
            const qty = Number(item.qty) || 0;
            const sellingPrice = Number(item.sellingPrice) || 0;
            const costPrice = Number(item.costPrice) || 0;
            existing.qty += sign * qty;
            existing.revenue += sign * sellingPrice * qty;
            existing.profit += sign * (sellingPrice - costPrice) * qty;
            productSalesMap.set(item.productId!, existing);
          }
        });
      });
    return Array.from(productSalesMap.values())
      .filter((p) => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        marginPct: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
        totalReturns: returnedQtyByProduct.get(p.productId) || 0,
      }));
  }, [periodOrders, allProducts]);
}
