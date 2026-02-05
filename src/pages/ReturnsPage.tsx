import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { format } from 'date-fns';
import type { OrderItem } from '@/types';

interface OrderDoc {
  id: string;
  createdAt: string;
  total: number;
  items: Array<OrderItem & { productId: string; name?: string }>;
}

export default function ReturnsPage() {
  const db = useRxDB();
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [products, setProducts] = useState<Map<string, string>>(new Map());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const subOrders = db.orders.find().$.subscribe((docs) => {
      const list = docs
        .filter((d) => {
          if ((d as { _deleted?: boolean })._deleted) return false;
          if (d.status !== 'paid') return false;
          const ot = (d as { orderType?: string }).orderType;
          return ot !== 'return';
        })
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
        .slice(0, 100)
        .map((d) => ({
              id: d.id,
              createdAt: d.createdAt,
              total: d.total,
              items: d.items as OrderDoc['items'],
          }));
      setOrders(list);
    });
    const subProducts = db.products.find().$.subscribe((docs) => {
      const map = new Map<string, string>();
      docs.filter((d) => !(d as { _deleted?: boolean })._deleted).forEach((d) => map.set(d.id, d.name));
      setProducts(map);
    });
    return () => {
      subOrders.unsubscribe();
      subProducts.unsubscribe();
    };
  }, [db]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const setReturnQty = (productId: string, qty: number) => {
    setReturnQtys((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  };

  const processReturn = async () => {
    if (!db || !selectedOrder) return;
    const toReturn = selectedOrder.items.filter((item) => (returnQtys[item.productId] ?? 0) > 0);
    if (toReturn.length === 0) {
      setMessage('Select quantities to return.');
      return;
    }
    setProcessing(true);
    setMessage(null);
    try {
      const now = new Date().toISOString();
      const returnId = `ret_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const returnItems: OrderItem[] = toReturn.map((item) => {
        const qty = returnQtys[item.productId] ?? 0;
        return {
          productId: item.productId,
          qty,
          sellingPrice: item.sellingPrice,
          costPrice: item.costPrice,
        };
      });
      const returnTotal = returnItems.reduce((s, i) => s + i.sellingPrice * i.qty, 0);

      await db.orders.insert({
        id: returnId,
        channel: 'physical',
        type: 'retail',
        status: 'paid',
        createdAt: now,
        items: returnItems,
        total: -returnTotal,
        grossProfit: -returnItems.reduce((s, i) => s + (i.sellingPrice - i.costPrice) * i.qty, 0),
        paymentMethod: 'cash',
        orderType: 'return',
        linkedOrderId: selectedOrder.id,
      });

      for (const item of returnItems) {
        const doc = await db.products.findOne(item.productId).exec();
        if (doc) await doc.patch({ stock: doc.stock + item.qty });
      }

      setSelectedOrderId(null);
      setReturnQtys({});
      setMessage('Return processed. Stock updated.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to process return');
    } finally {
      setProcessing(false);
    }
  };

  if (!db) return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-smoky-black">Returns & Exchanges</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">Select order to return</h2>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(o.id);
                    setReturnQtys({});
                  }}
                  className={`w-full rounded-lg border p-3 text-left ${selectedOrderId === o.id ? 'border-tufts-blue bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <span className="font-medium">{o.id}</span>
                  <span className="ml-2 text-slate-600">{format(new Date(o.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                  <span className="block text-sm text-slate-600">{formatUGX(o.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          {selectedOrder ? (
            <>
              <h2 className="mb-3 font-heading text-lg font-semibold">Items to return</h2>
              <ul className="mb-4 space-y-2">
                {selectedOrder.items.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between rounded border border-slate-200 bg-white p-3">
                    <span>{products.get(item.productId) ?? item.productId}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Qty:</span>
                      <input
                        type="number"
                        min={0}
                        max={item.qty}
                        value={returnQtys[item.productId] ?? 0}
                        onChange={(e) => setReturnQty(item.productId, parseInt(e.target.value, 10) || 0)}
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-right"
                      />
                      <span className="text-sm text-slate-500">/ {item.qty}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={processReturn}
                disabled={processing}
                className="w-full rounded-lg bg-amber-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {processing ? 'Processing…' : 'Process return'}
              </button>
            </>
          ) : (
            <p className="text-slate-500">Select an order from the list.</p>
          )}
          {message && <p className={`mt-2 text-sm ${message.startsWith('Return') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
        </section>
      </div>
    </div>
  );
}
