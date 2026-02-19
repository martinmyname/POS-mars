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
    orderNumber: { type: 'number' },
    channel: { type: 'string' },
    type: { type: 'string' },
    status: { type: 'string' },
    createdAt: { type: 'string' },
    scheduledFor: { type: 'string' },
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
    paymentReceivedAt: { type: 'string' },
    paymentReceivedAmount: { type: 'number' },
    paymentReceivedBy: { type: 'string' },
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

const layawaySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    orderId: { type: 'string' },
    customerName: { type: 'string' },
    customerPhone: { type: 'string' },
    items: { type: 'array' }, // Array of { productId, name, qty, unitPrice, totalPrice }
    totalAmount: { type: 'number' },
    paidAmount: { type: 'number' },
    remainingAmount: { type: 'number' },
    status: { type: 'string' }, // 'active' | 'completed' | 'cancelled'
    createdAt: { type: 'string' },
    completedAt: { type: 'string' },
    notes: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'customerName', 'customerPhone', 'items', 'totalAmount', 'paidAmount', 'remainingAmount', 'status', 'createdAt'],
};

const cashSessionSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    date: { type: 'string' }, // YYYY-MM-DD
    openingAmount: { type: 'number' },
    closingAmount: { type: 'number' },
    expectedAmount: { type: 'number' },
    difference: { type: 'number' },
    openedAt: { type: 'string' },
    closedAt: { type: 'string' },
    openedBy: { type: 'string' },
    closedBy: { type: 'string' },
    notes: { type: 'string' },
    _modified: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'date', 'openingAmount', 'openedAt', 'openedBy'],
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
  layaways: import('rxdb').RxCollection;
  cash_sessions: import('rxdb').RxCollection;
};

export type MarsDatabase = import('rxdb').RxDatabase<MarsCollections>;

let dbInstance: MarsDatabase | null = null;
const replications: unknown[] = [];
/** Map of table name to replication instance for targeted sync */
const replicationMap = new Map<string, unknown>();
/** Single in-flight init so logout→login doesn't run two inits at once. Cleared on destroy. */
let initPromise: Promise<MarsDatabase> | null = null;

export async function initRxDB(supabaseUrl?: string, supabaseKey?: string): Promise<MarsDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
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
    layaways: { schema: layawaySchema },
    cash_sessions: { schema: cashSessionSchema },
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
        { name: 'layaways', collection: db.layaways },
        { name: 'cash_sessions', collection: db.cash_sessions },
      ] as const;

      // Critical tables that need immediate sync: deliveries, orders, products
      const criticalTables = new Set(['deliveries', 'orders', 'products']);
      
      for (const { name, collection } of tables) {
        const isCritical = criticalTables.has(name);
        
        const rep = replicateSupabase({
          collection,
          client: supabase,
          tableName: name,
          replicationIdentifier: `${DB_NAME}-${name}`,
          live: true,
          retryTime: isCritical ? 1000 : 2000, // Critical tables retry faster (1s vs 2s)
          pull: {
            batchSize: isCritical ? 20 : 100, // Smaller batches for critical tables = faster sync
            modifier: (doc: Record<string, unknown>) => {
              if (doc._deleted === null) delete doc._deleted;
              if (doc._modified === null) delete doc._modified;
              // Strip nulls so optional schema fields (e.g. orderNumber, scheduledFor) are absent
              // instead of null; RxDB validation rejects null for type 'number'/'string'
              for (const key of Object.keys(doc)) {
                if (doc[key] === null) delete doc[key];
              }
              return doc;
            },
          },
          push: {
            batchSize: isCritical ? 10 : 50, // Smaller batches for critical tables = immediate push
            modifier: (doc: Record<string, unknown>) => {
              if (!doc._modified) {
                doc._modified = new Date().toISOString();
              }
              return doc;
            },
          },
        });
        replications.push(rep);
        replicationMap.set(name, rep);
        
        // Replication starts automatically with live: true
        rep.active$.subscribe(() => {
          /* sync status tracked via error$ / received$ and SyncStatus UI */
        });

        rep.error$.subscribe((err) => {
          try {
            const errors = JSON.parse(localStorage.getItem('rxdb_sync_errors') || '{}');
            errors[name] = {
              message: err?.message || String(err),
              timestamp: new Date().toISOString(),
            };
            localStorage.setItem('rxdb_sync_errors', JSON.stringify(errors));
          } catch (_) {}
        });
        rep.received$.subscribe(() => {
          try {
            const errors = JSON.parse(localStorage.getItem('rxdb_sync_errors') || '{}');
            if (errors[name]) {
              delete errors[name];
              localStorage.setItem('rxdb_sync_errors', JSON.stringify(Object.keys(errors).length > 0 ? errors : '{}'));
            }
          } catch (_) {}
        });
        rep.sent$.subscribe(() => {
          /* success: errors cleared on received$ */
        });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      // Store error for user visibility
      try {
        localStorage.setItem('rxdb_init_error', JSON.stringify({
          message: errorMsg,
          timestamp: new Date().toISOString(),
          details: String(e),
        }));
      } catch (_) {}
      // Don't log to console; error is shown in SyncStatus and stored above
    }
  }

    return db;
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

export function getRxDB(): MarsDatabase | null {
  return dbInstance;
}

export function getReplications() {
  return replications;
}

/** Call reSync() on all replications (e.g. when coming back online or user clicks Retry). */
export function triggerReSync(): void {
  for (const rep of replications) {
    try {
      const state = rep as { reSync?: () => void };
      if (typeof state.reSync === 'function') {
        state.reSync();
      }
    } catch (_) {
      /* reSync failure: sync status will show errors from error$ if replication fails */
    }
  }
}

/**
 * Immediately sync a specific critical table (deliveries, orders, products).
 * Use this after making critical changes that need to be visible to all users immediately.
 * 
 * @param tableName - Name of the table to sync immediately ('deliveries', 'orders', or 'products')
 */
export function triggerImmediateSync(tableName: 'deliveries' | 'orders' | 'products'): void {
  const rep = replicationMap.get(tableName);
  if (rep) {
    try {
      const state = rep as { reSync?: () => void };
      if (typeof state.reSync === 'function') {
        state.reSync();
      }
    } catch (_) {
      /* reSync failure: sync status will show errors from error$ if replication fails */
    }
  }
}

/**
 * Immediately sync all critical tables (deliveries, orders, products).
 * Use this after making critical changes that need to be visible to all users immediately.
 */
export function triggerImmediateSyncCritical(): void {
  const criticalTables: Array<'deliveries' | 'orders' | 'products'> = ['deliveries', 'orders', 'products'];
  for (const tableName of criticalTables) {
    triggerImmediateSync(tableName);
  }
}

export async function destroyRxDB(): Promise<void> {
  initPromise = null;
  for (const rep of replications) {
    try {
      await (rep as { cancel: () => Promise<void> }).cancel();
    } catch (_) {}
  }
  replications.length = 0;
  replicationMap.clear();
  if (dbInstance) {
    try {
      const db = dbInstance as unknown as { destroy?: () => Promise<void>; close?: () => Promise<void> };
      if (typeof db.destroy === 'function') await db.destroy();
      else if (typeof db.close === 'function') await db.close();
    } catch (_) {
      // destroy/close may not be available in all RxDB versions
    }
    dbInstance = null;
  }
  // Let IndexedDB release so the next init doesn't hang (logout → login)
  await new Promise((r) => setTimeout(r, 150));
}

/** Dexie storage uses one IndexedDB per collection: rxdb-dexie-{dbName}--{schemaVersion}--{collectionName} */
const DEXIE_DB_PREFIX = 'rxdb-dexie-' + DB_NAME + '--';
const COLLECTION_NAMES = [
  'products', 'orders', 'expenses', 'stock_adjustments', 'report_notes',
  'promotions', 'customers', 'deliveries', 'suppliers', 'supplier_ledger',
  'layaways', 'cash_sessions',
] as const;

/**
 * Clear all local RxDB data and reload the app so it re-syncs from Supabase.
 * Run this after clearing Supabase (e.g. supabase-clear-all-data.sql) to test with real data.
 * Requires window (browser only).
 */
export async function clearAllLocalDataAndReload(): Promise<void> {
  await destroyRxDB();
  if (typeof indexedDB === 'undefined') return;
  const schemaVersion = 0;
  for (const name of COLLECTION_NAMES) {
    const idbName = DEXIE_DB_PREFIX + schemaVersion + '--' + name;
    try {
      indexedDB.deleteDatabase(idbName);
    } catch (_) {}
  }
  await new Promise((r) => setTimeout(r, 200));
  if (typeof window !== 'undefined') window.location.reload();
}
