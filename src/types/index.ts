/**
 * Mars Kitchen Essentials – shared types for POS, orders, expenses, reports.
 */

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  retailPrice: number;
  wholesalePrice: number;
  costPrice: number;
  stock: number;
  minStockLevel: number;
  reorderLevel?: number;
  maxStockLevel?: number;
  imageUrl?: string;
  /** For barcode scanner lookup */
  barcode?: string;
  /** Supplier you get this product from */
  supplierId?: string;
}

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
}

export type PromotionType = 'percent_off' | 'amount_off' | 'bogo';
export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  value: number; // percent 1-100 or amount in UGX
  productIds?: string[];
  categoryIds?: string[];
  startDate: string; // ISO date
  endDate: string;
  minPurchase?: number;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
}

export type OrderChannel = 'physical' | 'ecommerce' | 'whatsapp' | 'social';
export type OrderType = 'retail' | 'wholesale';
export type OrderStatus = 'pending' | 'paid' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'credit' | 'deposit' | 'qr';

export interface OrderItem {
  productId: string;
  qty: number;
  sellingPrice: number;
  costPrice: number;
  /** Discount amount (original price - selling price) per unit; shown on receipt */
  discount?: number;
  /** Original unit price before discount; shown on receipt when discounted */
  originalPrice?: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address?: string;
}

export interface Order {
  id: string;
  channel: OrderChannel;
  type: OrderType;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
  total: number;
  grossProfit: number;
  paymentMethod: PaymentMethod;
  /** When using split payments */
  paymentSplits?: PaymentSplit[];
  customer?: OrderCustomer;
  customerId?: string;
  depositAmount?: number;
  numberOfDeposits?: number;
  notes?: string;
  promotionId?: string;
  /** For returns/exchanges */
  orderType?: 'sale' | 'return' | 'exchange';
  linkedOrderId?: string;
}

export interface Expense {
  id: string;
  date: string;
  itemBought: string;
  purpose: string;
  amount: number;
  paidBy: string;
  receiptAttached: boolean;
  paidByWho: string;
  notes?: string;
}

export type StockAdjustmentType = 'add' | 'remove' | 'return' | 'damage';

export interface StockAdjustment {
  id: string;
  productId: string;
  type: StockAdjustmentType;
  quantity: number;
  reason?: string;
  date: string;
}

export type ReportPeriodType = 'day' | 'week' | 'month';

export interface ReportNote {
  id: string;
  periodType: ReportPeriodType;
  periodStart: string;
  comment: string;
}

export interface ReplicationMeta {
  _modified?: string;
  _deleted?: boolean;
}

/** Motorcycle delivery tracking */
export type DeliveryStatus =
  | 'pending'      // Not yet dispatched
  | 'dispatched'   // Rider assigned, left
  | 'in_transit'   // On the way
  | 'delivered'    // Completed
  | 'cancelled';

export type DeliveryPaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Delivery {
  id: string;
  orderId?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  amountToCollect: number;
  paymentStatus: DeliveryPaymentStatus;
  deliveryStatus: DeliveryStatus;
  riderName?: string;
  motorcycleId?: string;
  notes?: string;
  createdAt: string;
  deliveredAt?: string;
}
