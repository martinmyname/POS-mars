/**
 * RxDB database initialization – offline-first local DB with Supabase replication.
 */
import { createRxDatabase } from 'rxdb/plugins/core';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { replicateSupabase } from 'rxdb/plugins/replication-supabase';
import { supabase } from './supabase';

const DB_NAME = 'mars_pos';

const productSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    sku: { type: 'string' },
    name: { type: 'string' },
    category: { type: 'string' },
    retailPrice: { type: 'number' },
    wholesalePrice: { type: 'number' },
    costPrice: { type: 'number' },
    stock: { type: 'number' },
    minStockLevel: { type: 'number' },
    reorderLevel: { type: 'number' },
    maxStockLevel: { type: 'number' },
    imageUrl: { type: 'string' },
    barcode: { type: 'string' },
    supplierId: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'sku', 'name', 'category', 'retailPrice', 'wholesalePrice', 'costPrice', 'stock', 'minStockLevel'],
};

const orderSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    channel: { type: 'string' },
    type: { type: 'string' },
    status: { type: 'string' },
    createdAt: { type: 'string' },
    items: { type: 'array' },
    total: { type: 'number' },
    grossProfit: { type: 'number' },
    paymentMethod: { type: 'string' },
    paymentSplits: { type: 'array' },
    customer: { type: 'object' },
    customerId: { type: 'string' },
    depositAmount: { type: 'number' },
    numberOfDeposits: { type: 'number' },
    notes: { type: 'string' },
    promotionId: { type: 'string' },
    orderType: { type: 'string' },
    linkedOrderId: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'channel', 'type', 'status', 'createdAt', 'items', 'total', 'grossProfit', 'paymentMethod'],
};

const expenseSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    date: { type: 'string' },
    itemBought: { type: 'string' },
    purpose: { type: 'string' },
    amount: { type: 'number' },
    paidBy: { type: 'string' },
    receiptAttached: { type: 'boolean' },
    paidByWho: { type: 'string' },
    notes: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'date', 'itemBought', 'purpose', 'amount', 'paidBy', 'receiptAttached', 'paidByWho'],
};

const stockAdjustmentSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    productId: { type: 'string' },
    type: { type: 'string' },
    quantity: { type: 'number' },
    reason: { type: 'string' },
    date: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'productId', 'type', 'quantity', 'date'],
};

const reportNoteSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    periodType: { type: 'string' },
    periodStart: { type: 'string' },
    comment: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'periodType', 'periodStart', 'comment'],
};

const promotionSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    type: { type: 'string' },
    value: { type: 'number' },
    productIds: { type: 'array' },
    categoryIds: { type: 'array' },
    startDate: { type: 'string' },
    endDate: { type: 'string' },
    minPurchase: { type: 'number' },
    active: { type: 'boolean' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'name', 'type', 'value', 'startDate', 'endDate', 'active'],
};

const customerSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
    address: { type: 'string' },
    createdAt: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'name', 'phone', 'createdAt'],
};

const deliverySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    orderId: { type: 'string' },
    customerName: { type: 'string' },
    customerPhone: { type: 'string' },
    address: { type: 'string' },
    amountToCollect: { type: 'number' },
    paymentStatus: { type: 'string' },
    deliveryStatus: { type: 'string' },
    riderName: { type: 'string' },
    motorcycleId: { type: 'string' },
    notes: { type: 'string' },
    createdAt: { type: 'string' },
    deliveredAt: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'customerName', 'customerPhone', 'address', 'amountToCollect', 'paymentStatus', 'deliveryStatus', 'createdAt'],
};

const supplierSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    contact: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
    address: { type: 'string' },
    notes: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'name'],
};

const supplierLedgerSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    supplierId: { type: 'string' },
    type: { type: 'string' }, // 'credit' | 'payment'
    amount: { type: 'number' },
    date: { type: 'string' },
    dueDate: { type: 'string' }, // for credit: when to pay; omit = anytime
    note: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'supplierId', 'type', 'amount', 'date'],
};

export type MarsCollections = {
  products: import('rxdb').RxCollection;
  orders: import('rxdb').RxCollection;
  expenses: import('rxdb').RxCollection;
  stock_adjustments: import('rxdb').RxCollection;
  report_notes: import('rxdb').RxCollection;
  promotions: import('rxdb').RxCollection;
  customers: import('rxdb').RxCollection;
  deliveries: import('rxdb').RxCollection;
  suppliers: import('rxdb').RxCollection;
  supplier_ledger: import('rxdb').RxCollection;
};

export type MarsDatabase = import('rxdb').RxDatabase<MarsCollections>;

let dbInstance: MarsDatabase | null = null;
const replications: unknown[] = [];

export async function initRxDB(supabaseUrl?: string, supabaseKey?: string): Promise<MarsDatabase> {
  if (dbInstance) return dbInstance;

  const storage = getRxStorageDexie();
  const db = await createRxDatabase<MarsCollections>({
    name: DB_NAME,
    storage,
    multiInstance: false,
  });

  await db.addCollections({
    products: { schema: productSchema },
    orders: { schema: orderSchema },
    expenses: { schema: expenseSchema },
    stock_adjustments: { schema: stockAdjustmentSchema },
    report_notes: { schema: reportNoteSchema },
    promotions: { schema: promotionSchema },
    customers: { schema: customerSchema },
    deliveries: { schema: deliverySchema },
    suppliers: { schema: supplierSchema },
    supplier_ledger: { schema: supplierLedgerSchema },
  });

  dbInstance = db;

  const url = supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
  const key = supabaseKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key && supabase) {
    try {
      const tables = [
        { name: 'products', collection: db.products },
        { name: 'orders', collection: db.orders },
        { name: 'expenses', collection: db.expenses },
        { name: 'stock_adjustments', collection: db.stock_adjustments },
        { name: 'report_notes', collection: db.report_notes },
        { name: 'promotions', collection: db.promotions },
        { name: 'customers', collection: db.customers },
        { name: 'deliveries', collection: db.deliveries },
        { name: 'suppliers', collection: db.suppliers },
        { name: 'supplier_ledger', collection: db.supplier_ledger },
      ] as const;

      for (const { name, collection } of tables) {
        const rep = replicateSupabase({
          collection,
          client: supabase,
          tableName: name,
          replicationIdentifier: `${DB_NAME}-${name}`,
          live: true,
          pull: {
            batchSize: 50,
            modifier: (doc: Record<string, unknown>) => {
              if (doc._deleted === null) delete doc._deleted;
              if (doc._modified === null) delete doc._modified;
              return doc;
            },
          },
          push: { batchSize: 50 },
        });
        replications.push(rep);
        rep.error$.subscribe((err) => console.error(`[replication ${name}]`, err));
      }
    } catch (e) {
      console.warn('Supabase replication start failed (tables may not exist yet):', e);
    }
  }

  return db;
}

export function getRxDB(): MarsDatabase | null {
  return dbInstance;
}

export function getReplications() {
  return replications;
}

export async function destroyRxDB(): Promise<void> {
  for (const rep of replications) {
    try {
      await (rep as { cancel: () => Promise<void> }).cancel();
    } catch (_) {}
  }
  replications.length = 0;
  if (dbInstance) {
    try {
      await (dbInstance as unknown as { destroy: () => Promise<void> }).destroy();
    } catch (_) {
      // destroy may not be available in all RxDB versions
    }
    dbInstance = null;
  }
}
