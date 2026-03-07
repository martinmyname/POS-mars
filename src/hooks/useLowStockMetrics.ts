import { useMemo } from 'react';

/** Product-like shape used for low-stock calculation (stock, minStockLevel, costPrice). */
export interface ProductForLowStock {
  id: string;
  name?: string;
  stock?: number;
  minStockLevel?: number;
  costPrice?: number;
}

export interface LowStockRow {
  id: string;
  name: string;
  stock: number;
  minStockLevel: number;
  unitsNeeded: number;
  restockCost: number;
}

export interface LowStockMetrics {
  lowStockProducts: ProductForLowStock[];
  lowStockTable: LowStockRow[];
  totalRestockCost: number;
  lowStockCount: number;
  /** Value of current low-stock inventory on hand (stock × costPrice per item). */
  lowStockValue: number;
}

/**
 * Shared low-stock metrics: products at or below min level, restock cost per product,
 * total restock cost. Same formula as Reports: restockCost = (minStockLevel - stock) × costPrice.
 * Use from Inventory and Reports so logic never drifts.
 */
export function useLowStockMetrics(products: ProductForLowStock[]): LowStockMetrics {
  return useMemo(() => {
    const lowStockProducts = products.filter(
      (p) => (Number(p.stock) ?? 0) <= (Number(p.minStockLevel) ?? 0)
    );
    const lowStockTable: LowStockRow[] = lowStockProducts.map((p) => {
      const stock = Number(p.stock) ?? 0;
      const minLevel = Number(p.minStockLevel) ?? 0;
      const costPrice = Number(p.costPrice) ?? 0;
      const unitsNeeded = Math.max(0, minLevel - stock);
      return {
        id: p.id,
        name: (p.name ?? '').trim() || 'Unknown',
        stock,
        minStockLevel: minLevel,
        unitsNeeded,
        restockCost: unitsNeeded * costPrice,
      };
    });
    const totalRestockCost = lowStockTable.reduce((s, r) => s + r.restockCost, 0);
    const lowStockValue = lowStockProducts.reduce(
      (sum, p) => sum + (Number(p.stock) ?? 0) * (Number(p.costPrice) ?? 0),
      0
    );
    return {
      lowStockProducts,
      lowStockTable,
      totalRestockCost,
      lowStockCount: lowStockTable.length,
      lowStockValue,
    };
  }, [products]);
}
