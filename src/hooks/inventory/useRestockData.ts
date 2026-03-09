import { useMemo } from 'react';
import { useProducts, useOrders, useSuppliers } from '@/hooks/useData';
import {
  RESTOCK_SAFETY_BUFFER,
  DEAD_STOCK_DAYS,
  DEFAULT_RESTOCK_CYCLE_DAYS,
} from '@/lib/inventoryConstants';
import { subDays, differenceInDays } from 'date-fns';
import type { Product } from '@/lib/data';

type Velocity = 'fast' | 'moderate' | 'slow' | 'none';
type StockStatus = 'out' | 'critical' | 'low' | 'ok';

export interface RestockItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStockLevel: number;
  costPrice: number;
  retailPrice: number;
  supplierId?: string;
  supplierName: string;
  restockCycleDays: number;
  avgDailySales: number;
  daysUntilStockout: number;
  suggestedQty: number;
  coverageAfterRestock: number;
  revenueAtRisk: number;
  velocity: Velocity;
  lastSoldDaysAgo: number;
  isDead: boolean;
  status: StockStatus;
  priority: number;
  needsRestock: boolean;
  restockCost: number;
  /** Human-readable "why" explanation */
  whyText: string;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function toNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeRestockMetrics(
  product: Product & { supplierName?: string },
  salesByProduct: Record<string, { netSold: number; lastSaleAt: Date | null }>
): RestockItem {
  const stock = toNum(product.stock, 0);
  const minLevel = toNum(product.minStockLevel, 0);
  const costPrice = toNum(product.costPrice, 0);
  const retailPrice = toNum(product.retailPrice, 0);
  const cycleDays = toNum(product.restockCycleDays, DEFAULT_RESTOCK_CYCLE_DAYS);
  const sales = salesByProduct[product.id] ?? { netSold: 0, lastSaleAt: null };

  const netSold = sales.netSold;
  const avgDailySales = round(netSold / 30, 2);
  const daysUntilStockout =
    avgDailySales > 0 ? round(stock / avgDailySales, 1) : 999;
  const cycleDemand = Math.ceil(
    avgDailySales * cycleDays * RESTOCK_SAFETY_BUFFER
  );
  const status: StockStatus =
    stock === 0
      ? 'out'
      : minLevel > 0 && stock <= minLevel * 0.5
        ? 'critical'
        : stock <= minLevel
          ? 'low'
          : 'ok';

  const rawSuggested = Math.max(
    cycleDemand - stock,
    minLevel - stock,
    0
  );
  const needsRestock =
    status !== 'ok' || (daysUntilStockout < cycleDays && daysUntilStockout < 999);
  const suggestedQty =
    rawSuggested === 0 && (status === 'out' || stock < minLevel) ? 1 : rawSuggested;
  const coverageAfterRestock =
    avgDailySales > 0
      ? Math.round((stock + suggestedQty) / avgDailySales)
      : 999;
  const marginPerUnit = retailPrice - costPrice;
  const revenueAtRisk =
    avgDailySales > 0 &&
    daysUntilStockout < cycleDays &&
    daysUntilStockout >= 0
      ? round(daysUntilStockout * avgDailySales * marginPerUnit, 0)
      : 0;

  const velocity: Velocity =
    avgDailySales >= 3
      ? 'fast'
      : avgDailySales >= 0.5
        ? 'moderate'
        : avgDailySales > 0
          ? 'slow'
          : 'none';

  const lastSoldDaysAgo = sales.lastSaleAt
    ? differenceInDays(new Date(), sales.lastSaleAt)
    : 999;
  const isDead = stock > 0 && lastSoldDaysAgo >= DEAD_STOCK_DAYS;

  const stockoutScore =
    status === 'out' ? 40 : Math.max(0, 40 - daysUntilStockout * 8);
  const revenueScore = Math.min(30, (revenueAtRisk / 500000) * 30);
  const velocityScore =
    velocity === 'fast' ? 20 : velocity === 'moderate' ? 12 : velocity === 'slow' ? 4 : 0;
  const statusScore =
    status === 'out' ? 10 : status === 'critical' ? 7 : status === 'low' ? 4 : 0;
  const priority = isDead
    ? 0
    : Math.min(
        100,
        Math.round(stockoutScore + revenueScore + velocityScore + statusScore)
      );

  const restockCost = suggestedQty * costPrice;
  const demandRounded = round(avgDailySales * cycleDays, 1);
  const whyText =
    avgDailySales > 0
      ? `Covers ${cycleDays}-day cycle (${demandRounded} units demand) + 25% safety buffer − ${stock} in stock. This gives ~${coverageAfterRestock} days of stock coverage.`
      : `Min stock level ${minLevel}; current stock ${stock}. Suggested order to reach min level.`;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku ?? '',
    category: product.category ?? '',
    stock,
    minStockLevel: minLevel,
    costPrice,
    retailPrice,
    supplierId: product.supplierId,
    supplierName: (product as { supplierName?: string }).supplierName ?? '—',
    restockCycleDays: cycleDays,
    avgDailySales,
    daysUntilStockout,
    suggestedQty,
    coverageAfterRestock,
    revenueAtRisk,
    velocity,
    lastSoldDaysAgo,
    isDead,
    status,
    priority,
    needsRestock,
    restockCost,
    whyText,
  };
}

export function useRestockData() {
  const { data: productsList, loading: productsLoading } = useProducts({
    realtime: true,
  });
  const { data: ordersList, loading: ordersLoading } = useOrders({
    realtime: true,
  });
  const { data: suppliersList } = useSuppliers({ realtime: true });

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    suppliersList.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [suppliersList]);

  const salesByProduct = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const map: Record<
      string,
      { netSold: number; lastSaleAt: Date | null }
    > = {};
    (ordersList ?? []).forEach((order) => {
      if (order.status === 'cancelled') return;
      const items = (order.items ?? []) as Array<{
        productId?: string;
        qty?: number;
      }>;
      const isReturn = (order.orderType ?? '').toLowerCase() === 'return';
      const orderDate = order.createdAt ? new Date(order.createdAt) : null;
      if (order.createdAt && order.createdAt < thirtyDaysAgo) return;
      items.forEach((item) => {
        const pid = item.productId;
        if (!pid) return;
        const qty = Number(item.qty) ?? 0;
        if (!map[pid]) map[pid] = { netSold: 0, lastSaleAt: null };
        if (isReturn) {
          map[pid].netSold -= qty;
        } else {
          map[pid].netSold += qty;
          if (orderDate && (!map[pid].lastSaleAt || orderDate > map[pid].lastSaleAt!)) {
            map[pid].lastSaleAt = orderDate;
          }
        }
      });
    });
    return map;
  }, [ordersList]);

  const items = useMemo(() => {
    const products = (productsList ?? []).map((p) => ({
      ...p,
      supplierName: p.supplierId ? supplierNames[p.supplierId] ?? '—' : '—',
    }));
    const computed = products.map((p) =>
      computeRestockMetrics(p, salesByProduct)
    );
    return computed.sort((a, b) => b.priority - a.priority);
  }, [productsList, salesByProduct, supplierNames]);

  const summaryStats = useMemo(
    () => ({
      outCount: items.filter((i) => i.status === 'out').length,
      criticalCount: items.filter((i) => i.status === 'critical').length,
      lowCount: items.filter((i) => i.status === 'low').length,
      deadCount: items.filter((i) => i.isDead).length,
      totalRevenueAtRisk: items
        .filter((i) => i.needsRestock)
        .reduce((s, i) => s + i.revenueAtRisk, 0),
      needsRestockCount: items.filter(
        (i) => i.needsRestock && !i.isDead
      ).length,
    }),
    [items]
  );

  return {
    items,
    isLoading: productsLoading || ordersLoading,
    error: null,
    refetch: () => {},
    summaryStats,
  };
}
