import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { format } from 'date-fns';
import type { OrderItem } from '@/types';
import { RefreshCw, Wrench } from 'lucide-react';

interface OrderDoc {
  id: string;
  createdAt: string;
  total: number;
  items: Array<OrderItem & { productId: string; name?: string }>;
}

interface ProductForExchange {
  id: string;
  name: string;
  retailPrice: number;
  costPrice: number;
  stock: number;
}

type ReturnOutcome = 'exchange' | 'repair';

export default function ReturnsPage() {
  const db = useRxDB();
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [products, setProducts] = useState<Map<string, string>>(new Map());
  const [productsForExchange, setProductsForExchange] = useState<ProductForExchange[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [outcomeType, setOutcomeType] = useState<ReturnOutcome>('exchange');
  const [exchangeCart, setExchangeCart] = useState<Array<OrderItem & { name: string }>>([]);
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [repairFee, setRepairFee] = useState('');
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
      const forExchange: ProductForExchange[] = [];
      docs
        .filter((d) => !(d as { _deleted?: boolean })._deleted)
        .forEach((d) => {
          map.set(d.id, d.name);
          forExchange.push({
            id: d.id,
            name: d.name,
            retailPrice: d.retailPrice,
            costPrice: d.costPrice,
            stock: d.stock,
          });
        });
      setProducts(map);
      setProductsForExchange(forExchange);
    });
    return () => {
      subOrders.unsubscribe();
      subProducts.unsubscribe();
    };
  }, [db]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const filteredExchangeProducts = useMemo(() => {
    if (!exchangeSearch.trim()) return productsForExchange.slice(0, 20);
    const q = exchangeSearch.trim().toLowerCase();
    return productsForExchange
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [productsForExchange, exchangeSearch]);

  const setReturnQty = (productId: string, qty: number) => {
    setReturnQtys((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  };

  const addToExchangeCart = (p: ProductForExchange, qty = 1) => {
    if (qty <= 0) return;
    setExchangeCart((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      const next = [...prev];
      if (i >= 0) {
        next[i] = { ...next[i], qty: next[i].qty + qty };
      } else {
        next.push({
          productId: p.id,
          name: p.name,
          qty,
          sellingPrice: p.retailPrice,
          costPrice: p.costPrice,
        });
      }
      return next;
    });
  };

  const updateExchangeCartQty = (productId: string, delta: number) => {
    setExchangeCart((prev) => {
      const i = prev.findIndex((l) => l.productId === productId);
      if (i < 0) return prev;
      const next = [...prev];
      const newQty = next[i].qty + delta;
      if (newQty <= 0) return prev.filter((l) => l.productId !== productId);
      next[i] = { ...next[i], qty: newQty };
      return next;
    });
  };

  const returnValue = selectedOrder
    ? selectedOrder.items.reduce(
        (s, i) => s + (returnQtys[i.productId] ?? 0) * i.sellingPrice,
        0
      )
    : 0;
  const exchangeTotal = exchangeCart.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
  const repairFeeNum = parseFloat(repairFee) || 0;

  const processReturn = async () => {
    if (!db || !selectedOrder) return;
    const toReturn = selectedOrder.items.filter((item) => (returnQtys[item.productId] ?? 0) > 0);
    if (toReturn.length === 0) {
      setMessage('Select quantities to return.');
      return;
    }
    if (outcomeType === 'exchange' && exchangeCart.length === 0) {
      setMessage('Add replacement items for exchange.');
      return;
    }
    if (outcomeType === 'repair' && (Number.isNaN(repairFeeNum) || repairFeeNum < 0)) {
      setMessage('Enter a valid repair fee (UGX).');
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

      // 1) Create return order and restore stock
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

      // 2) Exchange: create new order for replacement items and deduct stock
      if (outcomeType === 'exchange') {
        const exchangeId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const exchangeOrderItems: OrderItem[] = exchangeCart.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          sellingPrice: l.sellingPrice,
          costPrice: l.costPrice,
        }));
        const exchangeOrderTotal = exchangeCart.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
        const exchangeGrossProfit = exchangeCart.reduce(
          (s, i) => s + (i.sellingPrice - i.costPrice) * i.qty,
          0
        );
        await db.orders.insert({
          id: exchangeId,
          channel: 'physical',
          type: 'retail',
          status: 'paid',
          createdAt: now,
          items: exchangeOrderItems,
          total: exchangeOrderTotal,
          grossProfit: exchangeGrossProfit,
          paymentMethod: 'cash',
          orderType: 'exchange',
          linkedOrderId: selectedOrder.id,
        });
        for (const line of exchangeCart) {
          const doc = await db.products.findOne(line.productId).exec();
          if (doc) await doc.patch({ stock: Math.max(0, doc.stock - line.qty) });
        }
      }

      // 3) Repair: create small order for repair fee (no stock change)
      if (outcomeType === 'repair' && repairFeeNum > 0) {
        const repairOrderId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const repairFeeItem: OrderItem = {
          productId: 'repair_fee',
          qty: 1,
          sellingPrice: repairFeeNum,
          costPrice: 0,
        };
        await db.orders.insert({
          id: repairOrderId,
          channel: 'physical',
          type: 'retail',
          status: 'paid',
          createdAt: now,
          items: [repairFeeItem],
          total: repairFeeNum,
          grossProfit: repairFeeNum,
          paymentMethod: 'cash',
          orderType: 'sale',
          linkedOrderId: returnId,
          notes: 'Repair fee (return)',
        });
      }

      setSelectedOrderId(null);
      setReturnQtys({});
      setExchangeCart([]);
      setRepairFee('');
      setMessage(
        outcomeType === 'exchange'
          ? 'Return and exchange processed. Stock updated.'
          : 'Return processed. Repair fee recorded.'
      );
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
      <p className="text-sm text-slate-600">
        Customers either receive <strong>replacement items</strong> (exchange) or the item is <strong>repaired and they pay a fee</strong>.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">Select order to return</h2>
          <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(o.id);
                    setReturnQtys({});
                    setExchangeCart([]);
                    setRepairFee('');
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

              <h2 className="mb-2 font-heading text-lg font-semibold">How is this return handled?</h2>
              <div className="mb-4 flex gap-4">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 has-[:checked]:border-tufts-blue has-[:checked]:bg-blue-50">
                  <input
                    type="radio"
                    name="outcome"
                    checked={outcomeType === 'exchange'}
                    onChange={() => setOutcomeType('exchange')}
                    className="h-4 w-4"
                  />
                  <RefreshCw className="h-4 w-4 text-slate-600" />
                  <span>Exchange (other items)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 has-[:checked]:border-tufts-blue has-[:checked]:bg-blue-50">
                  <input
                    type="radio"
                    name="outcome"
                    checked={outcomeType === 'repair'}
                    onChange={() => setOutcomeType('repair')}
                    className="h-4 w-4"
                  />
                  <Wrench className="h-4 w-4 text-slate-600" />
                  <span>Repair (charge fee)</span>
                </label>
              </div>

              {outcomeType === 'exchange' && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-2 font-medium">Replacement items</h3>
                  <input
                    type="text"
                    placeholder="Search products…"
                    value={exchangeSearch}
                    onChange={(e) => setExchangeSearch(e.target.value)}
                    className="input-base mb-2 w-full"
                  />
                  <ul className="mb-3 max-h-32 space-y-1 overflow-y-auto">
                    {filteredExchangeProducts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between rounded bg-white px-2 py-1">
                        <span className="text-sm">{p.name}</span>
                        <span className="text-sm text-slate-600">{formatUGX(p.retailPrice)}</span>
                        <button
                          type="button"
                          onClick={() => addToExchangeCart(p)}
                          className="rounded bg-tufts-blue px-2 py-0.5 text-xs text-white"
                        >
                          Add
                        </button>
                      </li>
                    ))}
                  </ul>
                  {exchangeCart.length > 0 && (
                    <>
                      <p className="mb-1 text-sm font-medium">Replacement cart</p>
                      <ul className="space-y-1">
                        {exchangeCart.map((l) => (
                          <li key={l.productId} className="flex items-center justify-between text-sm">
                            <span>{l.name} × {l.qty}</span>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => updateExchangeCartQty(l.productId, -1)} className="rounded border px-1.5">−</button>
                              <span>{l.qty}</span>
                              <button type="button" onClick={() => updateExchangeCartQty(l.productId, 1)} className="rounded border px-1.5">+</button>
                              <span className="ml-1">{formatUGX(l.sellingPrice * l.qty)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm font-semibold">Replacement total: {formatUGX(exchangeTotal)}</p>
                      <p className="text-xs text-slate-500">Return value: {formatUGX(returnValue)}. Customer pays difference if replacement &gt; return.</p>
                    </>
                  )}
                </div>
              )}

              {outcomeType === 'repair' && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="block font-medium">Repair fee (UGX)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={repairFee}
                    onChange={(e) => setRepairFee(e.target.value)}
                    className="input-base mt-1 w-full"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={processReturn}
                disabled={processing}
                className="w-full rounded-lg bg-amber-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {processing ? 'Processing…' : outcomeType === 'exchange' ? 'Process return & exchange' : 'Process return & repair fee'}
              </button>
            </>
          ) : (
            <p className="text-slate-500">Select an order from the list.</p>
          )}
          {message && (
            <p className={`mt-2 text-sm ${message.startsWith('Return') || message.startsWith('Repair') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
