import { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { Receipt, type ReceiptData } from '@/components/Receipt';
import { getSettings } from '@/lib/settings';
import type { OrderItem, PaymentMethod, PaymentSplit } from '@/types';

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  sellingPrice: number;
  costPrice: number;
  /** Original unit price (e.g. retail); used for discount display on receipt */
  originalPrice: number;
}

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  barcode?: string;
  retailPrice: number;
  costPrice: number;
  stock: number;
};

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money (MTN/Airtel)' },
  { value: 'card', label: 'Card' },
  { value: 'qr', label: 'QR Payment' },
  { value: 'credit', label: 'Credit' },
  { value: 'deposit', label: 'Deposit' },
];

export default function POSPage() {
  const db = useRxDB();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingPriceFor, setEditingPriceFor] = useState<string | null>(null);
  const [editPriceInput, setEditPriceInput] = useState('');
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [promotions, setPromotions] = useState<Array<{ id: string; name: string; type: string; value: number; minPurchase?: number }>>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [sendForDelivery, setSendForDelivery] = useState(false);
  const [deliveryCustomerName, setDeliveryCustomerName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryAmountToCollect, setDeliveryAmountToCollect] = useState('');

  useEffect(() => {
    if (!db) return;
    const sub = db.products.find().$.subscribe((docs) => {
      setProducts(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted)
          .map((d) => ({
            id: d.id,
            name: d.name,
            sku: d.sku ?? '',
            category: d.category ?? '',
            barcode: (d as { barcode?: string }).barcode,
            retailPrice: d.retailPrice,
            costPrice: d.costPrice,
            stock: d.stock,
          }))
      );
    });
    return () => sub.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const sub = db.promotions.find().$.subscribe((docs) => {
      const now = new Date().toISOString().slice(0, 10);
      setPromotions(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted && d.active && d.startDate <= now && d.endDate >= now)
          .map((d) => ({ id: d.id, name: d.name, type: d.type, value: d.value, minPurchase: d.minPurchase }))
      );
    });
    return () => sub.unsubscribe();
  }, [db]);

  const filteredProducts = useMemo(() => {
    if (!quickSearch.trim()) return products;
    const q = quickSearch.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, quickSearch]);

  const lookupByBarcodeOrSku = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return null;
    const byBarcode = products.find((p) => p.barcode && p.barcode === trimmed);
    if (byBarcode) return byBarcode;
    const bySku = products.find((p) => p.sku.toLowerCase() === trimmed.toLowerCase());
    return bySku ?? null;
  };

  const addToCart = (id: string, name: string, price: number, costPrice: number, qty = 1) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { productId: id, name, qty, sellingPrice: price, costPrice, originalPrice: price }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === productId);
      if (i < 0) return prev;
      const next = [...prev];
      const newQty = next[i].qty + delta;
      if (newQty <= 0) return prev.filter((l) => l.productId !== productId);
      next[i] = { ...next[i], qty: newQty };
      return next;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
    if (editingPriceFor === productId) {
      setEditingPriceFor(null);
      setEditPriceInput('');
    }
  };

  const startEditPrice = (line: CartLine) => {
    setEditingPriceFor(line.productId);
    setEditPriceInput(String(line.sellingPrice));
  };

  const applyEditPrice = (productId: string) => {
    const num = parseFloat(editPriceInput);
    if (!Number.isNaN(num) && num >= 0) {
      setCart((prev) => {
        const i = prev.findIndex((l) => l.productId === productId);
        if (i < 0) return prev;
        const next = [...prev];
        next[i] = { ...next[i], sellingPrice: Math.round(num) };
        return next;
      });
    }
    setEditingPriceFor(null);
    setEditPriceInput('');
  };

  const cancelEditPrice = () => {
    setEditingPriceFor(null);
    setEditPriceInput('');
  };

  const subtotalBeforePromo = cart.reduce((s, l) => s + l.sellingPrice * l.qty, 0);
  const selectedPromo = selectedPromoId ? promotions.find((p) => p.id === selectedPromoId) : null;
  const promoDiscount =
    selectedPromo && (selectedPromo.minPurchase == null || subtotalBeforePromo >= selectedPromo.minPurchase)
      ? selectedPromo.type === 'percent_off'
        ? Math.round((subtotalBeforePromo * selectedPromo.value) / 100)
        : Math.min(selectedPromo.value, subtotalBeforePromo)
      : 0;
  const subtotal = subtotalBeforePromo - promoDiscount;
  const grossProfit = cart.reduce((s, l) => s + (l.sellingPrice - l.costPrice) * l.qty, 0);

  const splitTotal = paymentSplits.reduce((s, x) => s + x.amount, 0);
  const splitOk = !useSplitPayment || (paymentSplits.length > 0 && splitTotal === subtotal);
  const deliveryOk = !sendForDelivery || (deliveryCustomerName.trim() && deliveryPhone.trim() && deliveryAddress.trim());

  const addSplit = () => {
    const remaining = subtotal - paymentSplits.reduce((s, x) => s + x.amount, 0);
    setPaymentSplits((prev) => [...prev, { method: 'cash', amount: remaining > 0 ? remaining : 0 }]);
  };
  const updateSplit = (index: number, method: PaymentMethod, amount: number) => {
    setPaymentSplits((prev) => {
      const next = [...prev];
      next[index] = { method, amount: Math.max(0, Math.round(amount)) };
      return next;
    });
  };
  const removeSplit = (index: number) => {
    setPaymentSplits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = lookupByBarcodeOrSku(barcodeInput);
    if (product && product.stock > 0) {
      addToCart(product.id, product.name, product.retailPrice, product.costPrice, 1);
      setBarcodeInput('');
    } else {
      setMessage('Product not found or out of stock');
      setTimeout(() => setMessage(null), 2000);
    }
    barcodeInputRef.current?.focus();
  };

  const placeOrder = async () => {
    if (!db || cart.length === 0) return;
    if (useSplitPayment && !splitOk) {
      setMessage('Split total must equal order total.');
      return;
    }
    if (sendForDelivery && (!deliveryCustomerName.trim() || !deliveryPhone.trim() || !deliveryAddress.trim())) {
      setMessage('Fill customer name, phone and address for delivery.');
      return;
    }
    setPlacing(true);
    setMessage(null);
    try {
      const now = new Date().toISOString();
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const items: OrderItem[] = cart.map((l) => {
        const discounted = l.originalPrice > l.sellingPrice;
        return {
          productId: l.productId,
          qty: l.qty,
          sellingPrice: l.sellingPrice,
          costPrice: l.costPrice,
          ...(discounted && {
            originalPrice: l.originalPrice,
            discount: l.originalPrice - l.sellingPrice,
          }),
        };
      });

      const orderPayload = {
        id: orderId,
        channel: 'physical',
        type: 'retail',
        status: 'paid',
        createdAt: now,
        items,
        total: subtotal,
        grossProfit,
        paymentMethod: useSplitPayment ? paymentSplits[0]?.method ?? 'cash' : paymentMethod,
        ...(useSplitPayment && paymentSplits.length > 0 && { paymentSplits }),
        ...(selectedPromoId && { promotionId: selectedPromoId }),
      };

      await db.orders.insert(orderPayload);

      for (const line of cart) {
        const doc = await db.products.findOne(line.productId).exec();
        if (doc) {
          const newStock = doc.stock - line.qty;
          await doc.patch({ stock: Math.max(0, newStock) });
        }
      }

      const paymentLabel = useSplitPayment
        ? paymentSplits.map((s) => `${PAYMENT_OPTIONS.find((o) => o.value === s.method)?.label ?? s.method}: ${formatUGX(s.amount)}`).join(', ')
        : PAYMENT_OPTIONS.find((o) => o.value === paymentMethod)?.label ?? paymentMethod;

      const settings = getSettings();
      setLastReceipt({
        orderId,
        createdAt: now,
        paymentMethod: paymentLabel,
        total: subtotal,
        businessName: settings.businessName,
        address: settings.address,
        items: cart.map((l) => ({
          name: l.name,
          qty: l.qty,
          unitPrice: l.sellingPrice,
          originalPrice: l.originalPrice > l.sellingPrice ? l.originalPrice : undefined,
          lineTotal: l.sellingPrice * l.qty,
        })),
      });
      if (sendForDelivery && deliveryCustomerName.trim() && deliveryPhone.trim() && deliveryAddress.trim()) {
        const amountToCollect = (() => {
          const v = parseFloat(deliveryAmountToCollect);
          return Number.isNaN(v) || v < 0 ? subtotal : v;
        })();
        const deliveryId = `del_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await db.deliveries.insert({
          id: deliveryId,
          orderId,
          customerName: deliveryCustomerName.trim(),
          customerPhone: deliveryPhone.trim(),
          address: deliveryAddress.trim(),
          amountToCollect,
          paymentStatus: 'unpaid',
          deliveryStatus: 'pending',
          createdAt: now,
        });
      }

      setCart([]);
      setPaymentSplits([]);
      setUseSplitPayment(false);
      setSelectedPromoId(null);
      setSendForDelivery(false);
      setDeliveryCustomerName('');
      setDeliveryPhone('');
      setDeliveryAddress('');
      setDeliveryAmountToCollect('');
      setMessage('Order placed successfully.' + (sendForDelivery ? ' Delivery created.' : '') + ' Print receipt below.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading database…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black">POS Checkout</h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">
          ← Dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold text-smoky-black">Products</h2>
          <form onSubmit={handleBarcodeSubmit} className="mb-3">
            <label className="sr-only">Scan barcode or enter SKU</label>
            <div className="flex gap-2">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan barcode or type SKU → Enter"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="input-base flex-1 py-2 text-sm"
                autoComplete="off"
              />
              <button type="submit" className="btn-secondary shrink-0 text-sm">
                Add
              </button>
            </div>
          </form>
          <input
            type="text"
            placeholder="Quick search: SKU, name, category"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            className="input-base mb-3 py-2 text-sm"
          />
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/50 p-2">
            {filteredProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                {products.length === 0 ? 'No products. Add some in Inventory.' : 'No matches. Try another search.'}
              </p>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p.id, p.name, p.retailPrice, p.costPrice)}
                  disabled={p.stock <= 0}
                  className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2.5 text-left shadow-card transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="font-medium text-smoky-black">{p.name}</span>
                  <span className="text-sm text-slate-600">
                    {formatUGX(p.retailPrice)} · Stock: {p.stock}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold text-smoky-black">Cart</h2>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4">
            {cart.length === 0 ? (
              <p className="py-4 text-center text-slate-500">Cart is empty</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {cart.map((l) => (
                    <li key={l.productId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 p-2">
                      <span className="flex-1 truncate font-medium">{l.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(l.productId, -1)}
                          className="rounded border border-slate-300 px-2 py-0.5 text-sm"
                        >
                          −
                        </button>
                        <span className="w-8 text-center">{l.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(l.productId, 1)}
                          className="rounded border border-slate-300 px-2 py-0.5 text-sm"
                        >
                          +
                        </button>
                      </div>
                      {editingPriceFor === l.productId ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">UGX</span>
                          <input
                            type="number"
                            value={editPriceInput}
                            onChange={(e) => setEditPriceInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') applyEditPrice(l.productId);
                              if (e.key === 'Escape') cancelEditPrice();
                            }}
                            min="0"
                            step="1"
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => applyEditPrice(l.productId)}
                            className="rounded bg-tufts-blue px-2 py-1 text-xs text-white"
                          >
                            OK
                          </button>
                          <button type="button" onClick={cancelEditPrice} className="text-slate-500">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="w-24 text-right">
                            {l.originalPrice > l.sellingPrice ? (
                              <span>
                                <span className="line-through text-slate-500">{formatUGX(l.originalPrice)}</span>
                                <span className="ml-1">{formatUGX(l.sellingPrice)}</span>
                              </span>
                            ) : (
                              formatUGX(l.sellingPrice)
                            )}
                            <span className="text-slate-400"> × {l.qty}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditPrice(l)}
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                            title="Change price (e.g. discount)"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                      <span className="w-24 text-right font-medium">{formatUGX(l.sellingPrice * l.qty)}</span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(l.productId)}
                        className="text-red-600"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={sendForDelivery}
                      onChange={(e) => {
                        setSendForDelivery(e.target.checked);
                        if (e.target.checked) setDeliveryAmountToCollect(String(Math.round(subtotal)));
                        if (!e.target.checked) {
                          setDeliveryCustomerName('');
                          setDeliveryPhone('');
                          setDeliveryAddress('');
                          setDeliveryAmountToCollect('');
                        }
                      }}
                    />
                    Send for motorcycle delivery
                  </label>
                  {sendForDelivery && (
                    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <input
                        type="text"
                        placeholder="Customer name *"
                        value={deliveryCustomerName}
                        onChange={(e) => setDeliveryCustomerName(e.target.value)}
                        className="input-base py-2 text-sm"
                      />
                      <input
                        type="tel"
                        placeholder="Phone *"
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value)}
                        className="input-base py-2 text-sm"
                      />
                      <textarea
                        placeholder="Delivery address *"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        rows={2}
                        className="input-base resize-none py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Amount to collect (UGX)"
                        value={deliveryAmountToCollect}
                        onChange={(e) => setDeliveryAmountToCollect(e.target.value)}
                        min="0"
                        className="input-base py-2 text-sm"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Promotion</label>
                  <select
                    value={selectedPromoId ?? ''}
                    onChange={(e) => setSelectedPromoId(e.target.value || null)}
                    className="input-base mb-3"
                  >
                    <option value="">None</option>
                    {promotions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type === 'percent_off' ? p.value + '% off' : formatUGX(p.value) + ' off'})
                        {p.minPurchase != null ? ` — min ${formatUGX(p.minPurchase)}` : ''}
                      </option>
                    ))}
                  </select>
                  {promoDiscount > 0 && (
                    <p className="mb-2 text-sm text-green-600">
                      Promotion: −{formatUGX(promoDiscount)} → Total: {formatUGX(subtotal)}
                    </p>
                  )}
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={useSplitPayment}
                      onChange={(e) => {
                        setUseSplitPayment(e.target.checked);
                        if (e.target.checked && paymentSplits.length === 0) setPaymentSplits([{ method: 'cash', amount: subtotal }]);
                        if (!e.target.checked) setPaymentSplits([]);
                      }}
                    />
                    Split payment
                  </label>
                  {useSplitPayment ? (
                    <div className="mb-3 space-y-2">
                      {paymentSplits.map((split, i) => (
                        <div key={i} className="flex gap-2">
                          <select
                            value={split.method}
                            onChange={(e) => updateSplit(i, e.target.value as PaymentMethod, split.amount)}
                            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                          >
                            {PAYMENT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={split.amount}
                            onChange={(e) => updateSplit(i, split.method, parseFloat(e.target.value) || 0)}
                            min="0"
                            className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                          />
                          <button type="button" onClick={() => removeSplit(i)} className="text-red-600">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={addSplit} className="text-sm text-tufts-blue underline">
                        + Add payment
                      </button>
                      <p className={`text-sm ${splitTotal === subtotal ? 'text-green-600' : 'text-amber-600'}`}>
                        Split total: {formatUGX(splitTotal)} {splitTotal !== subtotal && `(need ${formatUGX(subtotal - splitTotal)} more)`}
                      </p>
                    </div>
                  ) : (
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="input-base mb-3"
                  >
                      {PAYMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-lg font-semibold">
                    Total: {formatUGX(subtotal)} · Profit: {formatUGX(grossProfit)}
                  </p>
                  <button
                    type="button"
                    onClick={placeOrder}
                    disabled={placing || !splitOk || !deliveryOk}
                    className="btn-primary mt-3 w-full py-3 disabled:opacity-50"
                  >
                    {placing ? 'Placing…' : sendForDelivery ? 'Place order & create delivery' : 'Place order'}
                  </button>
                </div>
              </>
            )}
          </div>
          {message && (
            <p className={`mt-2 text-sm ${message.startsWith('Order') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </section>
      </div>

      {lastReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-soft">
            <Receipt
              data={lastReceipt}
              onClose={() => setLastReceipt(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
