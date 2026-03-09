/**
 * Supabase-only data layer (no offline/local DB).
 * All tables use camelCase columns per supabase-schema.sql.
 */
import { supabase } from '@/lib/supabase';

export type Product = {
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
  restockCycleDays?: number;
  imageUrl?: string;
  barcode?: string;
  supplierId?: string;
  _deleted?: boolean;
  _modified?: string;
};

export type Order = {
  id: string;
  orderNumber?: number;
  channel: string;
  type: string;
  status: string;
  createdAt: string;
  scheduledFor?: string;
  items: unknown[];
  total: number;
  grossProfit: number;
  paymentMethod: string;
  paymentSplits?: unknown[];
  customer?: Record<string, unknown>;
  customerId?: string;
  depositAmount?: number;
  numberOfDeposits?: number;
  notes?: string;
  promotionId?: string;
  orderType?: string;
  linkedOrderId?: string;
  _deleted?: boolean;
  _modified?: string;
};

export type Expense = {
  id: string;
  date: string;
  itemBought: string;
  purpose: string;
  amount: number;
  paidBy: string;
  receiptAttached: boolean;
  paidByWho: string;
  notes?: string;
  _deleted?: boolean;
  _modified?: string;
};

export type StockAdjustment = {
  id: string;
  productId: string;
  type: string;
  quantity: number;
  reason?: string;
  date: string;
  _deleted?: boolean;
  _modified?: string;
};

export type ReportNote = {
  id: string;
  periodType: string;
  periodStart: string;
  comment: string;
  _deleted?: boolean;
  _modified?: string;
};

export type Promotion = {
  id: string;
  name: string;
  type: string;
  value: number;
  startDate: string;
  endDate?: string;
  minPurchase?: number;
  active: boolean;
  _deleted?: boolean;
  _modified?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
  _deleted?: boolean;
  _modified?: string;
};

export type Delivery = {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  amountToCollect: number;
  paymentStatus: string;
  deliveryStatus: string;
  orderId?: string;
  riderName?: string;
  motorcycleId?: string;
  paymentReceivedAt?: string;
  paymentReceivedAmount?: number;
  paymentReceivedBy?: string;
  notes?: string;
  createdAt: string;
  deliveredAt?: string;
  _deleted?: boolean;
  _modified?: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  _deleted?: boolean;
  _modified?: string;
};

export type SupplierLedgerEntry = {
  id: string;
  supplierId: string;
  type: string;
  amount: number;
  date: string;
  dueDate?: string;
  note?: string;
  _deleted?: boolean;
  _modified?: string;
};

export type Layaway = {
  id: string;
  orderId?: string;
  customerName: string;
  customerPhone: string;
  items: unknown[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
  _deleted?: boolean;
  _modified?: string;
};

export type CashSession = {
  id: string;
  date: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  notes?: string;
  _deleted?: boolean;
  _modified?: string;
};

const TABLES = {
  products: 'products',
  orders: 'orders',
  expenses: 'expenses',
  stock_adjustments: 'stock_adjustments',
  report_notes: 'report_notes',
  promotions: 'promotions',
  customers: 'customers',
  deliveries: 'deliveries',
  suppliers: 'suppliers',
  supplier_ledger: 'supplier_ledger',
  layaways: 'layaways',
  cash_sessions: 'cash_sessions',
} as const;

function nowIso() {
  return new Date().toISOString();
}

async function getAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq('_deleted', false);
  if (error) throw error;
  return (data ?? []) as T[];
}

async function getById<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as T | null;
}

async function getOneBy<T>(table: string, column: string, value: unknown): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq(column, value).eq('_deleted', false).limit(1).maybeSingle();
  if (error) throw error;
  return data as T | null;
}

async function insert<T extends Record<string, unknown>>(table: string, row: T): Promise<void> {
  const { error } = await supabase.from(table).insert({ ...row, _modified: nowIso() });
  if (error) throw error;
}

async function updateById<T extends Record<string, unknown>>(table: string, id: string, partial: Partial<T>): Promise<void> {
  const { error } = await supabase.from(table).update({ ...partial, _modified: nowIso() }).eq('id', id);
  if (error) throw error;
}

async function softDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).update({ _deleted: true, _modified: nowIso() }).eq('id', id);
  if (error) throw error;
}

function subscribe(table: string, callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void): () => void {
  const channel = supabase.channel(`${table}-realtime`).on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
    callback({
      eventType: payload.eventType,
      new: (payload.new ?? {}) as Record<string, unknown>,
      old: (payload.old ?? {}) as Record<string, unknown>,
    });
  }).subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export const productsApi = {
  getAll: () => getAll<Product>(TABLES.products),
  getById: (id: string) => getById<Product>(TABLES.products, id),
  getBySku: (sku: string) => getOneBy<Product>(TABLES.products, 'sku', sku),
  insert: (row: Omit<Product, '_deleted' | '_modified'>) => insert(TABLES.products, row as Product),
  update: (id: string, partial: Partial<Product>) => updateById(TABLES.products, id, partial),
  remove: (id: string) => softDelete(TABLES.products, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.products, cb),
};

export const ordersApi = {
  getAll: () => getAll<Order>(TABLES.orders),
  getById: (id: string) => getById<Order>(TABLES.orders, id),
  insert: (row: Omit<Order, '_deleted' | '_modified'>) => insert(TABLES.orders, row as Order),
  update: (id: string, partial: Partial<Order>) => updateById(TABLES.orders, id, partial),
  remove: (id: string) => softDelete(TABLES.orders, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.orders, cb),
};

export const expensesApi = {
  getAll: () => getAll<Expense>(TABLES.expenses),
  getById: (id: string) => getById<Expense>(TABLES.expenses, id),
  insert: (row: Omit<Expense, '_deleted' | '_modified'>) => insert(TABLES.expenses, row as Expense),
  update: (id: string, partial: Partial<Expense>) => updateById(TABLES.expenses, id, partial),
  remove: (id: string) => softDelete(TABLES.expenses, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.expenses, cb),
};

export const stockAdjustmentsApi = {
  getAll: () => getAll<StockAdjustment>(TABLES.stock_adjustments),
  getById: (id: string) => getById<StockAdjustment>(TABLES.stock_adjustments, id),
  insert: (row: Omit<StockAdjustment, '_deleted' | '_modified'>) => insert(TABLES.stock_adjustments, row as StockAdjustment),
  update: (id: string, partial: Partial<StockAdjustment>) => updateById(TABLES.stock_adjustments, id, partial),
  remove: (id: string) => softDelete(TABLES.stock_adjustments, id),
};

export const reportNotesApi = {
  getAll: () => getAll<ReportNote>(TABLES.report_notes),
  getById: (id: string) => getById<ReportNote>(TABLES.report_notes, id),
  insert: (row: Omit<ReportNote, '_deleted' | '_modified'>) => insert(TABLES.report_notes, row as ReportNote),
  update: (id: string, partial: Partial<ReportNote>) => updateById(TABLES.report_notes, id, partial),
  remove: (id: string) => softDelete(TABLES.report_notes, id),
};

export const promotionsApi = {
  getAll: () => getAll<Promotion>(TABLES.promotions),
  getById: (id: string) => getById<Promotion>(TABLES.promotions, id),
  insert: (row: Omit<Promotion, '_deleted' | '_modified'>) => insert(TABLES.promotions, row as Promotion),
  update: (id: string, partial: Partial<Promotion>) => updateById(TABLES.promotions, id, partial),
  remove: (id: string) => softDelete(TABLES.promotions, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.promotions, cb),
};

export const customersApi = {
  getAll: () => getAll<Customer>(TABLES.customers),
  getById: (id: string) => getById<Customer>(TABLES.customers, id),
  getByPhone: (phone: string) => getOneBy<Customer>(TABLES.customers, 'phone', phone),
  insert: (row: Omit<Customer, '_deleted' | '_modified'>) => insert(TABLES.customers, row as Customer),
  update: (id: string, partial: Partial<Customer>) => updateById(TABLES.customers, id, partial),
  remove: (id: string) => softDelete(TABLES.customers, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.customers, cb),
};

export const deliveriesApi = {
  getAll: () => getAll<Delivery>(TABLES.deliveries),
  getById: (id: string) => getById<Delivery>(TABLES.deliveries, id),
  insert: (row: Omit<Delivery, '_deleted' | '_modified'>) => insert(TABLES.deliveries, row as Delivery),
  update: (id: string, partial: Partial<Delivery>) => updateById(TABLES.deliveries, id, partial),
  remove: (id: string) => softDelete(TABLES.deliveries, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.deliveries, cb),
};

export const suppliersApi = {
  getAll: () => getAll<Supplier>(TABLES.suppliers),
  getById: (id: string) => getById<Supplier>(TABLES.suppliers, id),
  insert: (row: Omit<Supplier, '_deleted' | '_modified'>) => insert(TABLES.suppliers, row as Supplier),
  update: (id: string, partial: Partial<Supplier>) => updateById(TABLES.suppliers, id, partial),
  remove: (id: string) => softDelete(TABLES.suppliers, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.suppliers, cb),
};

export const supplierLedgerApi = {
  getAll: () => getAll<SupplierLedgerEntry>(TABLES.supplier_ledger),
  getById: (id: string) => getById<SupplierLedgerEntry>(TABLES.supplier_ledger, id),
  insert: (row: Omit<SupplierLedgerEntry, '_deleted' | '_modified'>) => insert(TABLES.supplier_ledger, row as SupplierLedgerEntry),
  update: (id: string, partial: Partial<SupplierLedgerEntry>) => updateById(TABLES.supplier_ledger, id, partial),
  remove: (id: string) => softDelete(TABLES.supplier_ledger, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.supplier_ledger, cb),
};

export const layawaysApi = {
  getAll: () => getAll<Layaway>(TABLES.layaways),
  getById: (id: string) => getById<Layaway>(TABLES.layaways, id),
  insert: (row: Omit<Layaway, '_deleted' | '_modified'>) => insert(TABLES.layaways, row as Layaway),
  update: (id: string, partial: Partial<Layaway>) => updateById(TABLES.layaways, id, partial),
  remove: (id: string) => softDelete(TABLES.layaways, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.layaways, cb),
};

export const cashSessionsApi = {
  getAll: () => getAll<CashSession>(TABLES.cash_sessions),
  getById: (id: string) => getById<CashSession>(TABLES.cash_sessions, id),
  getByDate: (date: string) => getOneBy<CashSession>(TABLES.cash_sessions, 'date', date),
  insert: (row: Omit<CashSession, '_deleted' | '_modified'>) => insert(TABLES.cash_sessions, row as CashSession),
  update: (id: string, partial: Partial<CashSession>) => updateById(TABLES.cash_sessions, id, partial),
  remove: (id: string) => softDelete(TABLES.cash_sessions, id),
  subscribe: (cb: (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) => subscribe(TABLES.cash_sessions, cb),
};

/** Generate a simple id (same style as before; no nanoid dependency). */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
