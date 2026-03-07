/** Product sales row for Reports. */
export interface ProductSales {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  profit: number;
  marginPct: number;
  totalReturns: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  amount: number;
}
