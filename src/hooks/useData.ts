/**
 * Hooks for Supabase data (no local DB). Optional realtime subscription.
 */
import { useState, useEffect, useCallback } from 'react';
import type {
  Product,
  Order,
  Expense,
  Promotion,
  Customer,
  Delivery,
  Supplier,
  SupplierLedgerEntry,
  Layaway,
  CashSession,
} from '@/lib/data';
import {
  productsApi,
  ordersApi,
  expensesApi,
  promotionsApi,
  customersApi,
  deliveriesApi,
  suppliersApi,
  supplierLedgerApi,
  layawaysApi,
  cashSessionsApi,
  generateId,
} from '@/lib/data';

function useTable<T>(
  fetchAll: () => Promise<T[]>,
  subscribe: (cb: () => void) => () => void,
  options?: { realtime?: boolean }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchAll();
      setData(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAll()
      .then((list) => {
        if (!cancelled) setData(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  useEffect(() => {
    if (!options?.realtime) return;
    const unsub = subscribe(refetch);
    return unsub;
  }, [options?.realtime, subscribe, refetch]);

  return { data, loading, error, refetch };
}

export function useProducts(opts?: { realtime?: boolean }) {
  return useTable(productsApi.getAll, productsApi.subscribe, opts);
}

export function useOrders(opts?: { realtime?: boolean }) {
  return useTable(ordersApi.getAll, ordersApi.subscribe, opts);
}

export function useExpenses(opts?: { realtime?: boolean }) {
  return useTable(expensesApi.getAll, expensesApi.subscribe, opts);
}

export function usePromotions(opts?: { realtime?: boolean }) {
  return useTable(promotionsApi.getAll, promotionsApi.subscribe, opts);
}

export function useCustomers(opts?: { realtime?: boolean }) {
  return useTable(customersApi.getAll, customersApi.subscribe, opts);
}

export function useDeliveries(opts?: { realtime?: boolean }) {
  return useTable(deliveriesApi.getAll, deliveriesApi.subscribe, opts);
}

export function useSuppliers(opts?: { realtime?: boolean }) {
  return useTable(suppliersApi.getAll, suppliersApi.subscribe, opts);
}

export function useSupplierLedger(opts?: { realtime?: boolean }) {
  return useTable(supplierLedgerApi.getAll, supplierLedgerApi.subscribe, opts);
}

export function useLayaways(opts?: { realtime?: boolean }) {
  return useTable(layawaysApi.getAll, layawaysApi.subscribe, opts);
}

export function useCashSessions(opts?: { realtime?: boolean }) {
  return useTable(cashSessionsApi.getAll, cashSessionsApi.subscribe, opts);
}

export {
  productsApi,
  ordersApi,
  expensesApi,
  promotionsApi,
  customersApi,
  deliveriesApi,
  suppliersApi,
  supplierLedgerApi,
  layawaysApi,
  cashSessionsApi,
  generateId,
};
export type { Product, Order, Expense, Promotion, Customer, Delivery, Supplier, SupplierLedgerEntry, Layaway, CashSession };
