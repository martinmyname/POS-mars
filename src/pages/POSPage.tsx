import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProducts, usePromotions, useSuppliers, productsApi, ordersApi, expensesApi, supplierLedgerApi, layawaysApi, deliveriesApi, customersApi, generateId } from '@/hooks/useData';
import { formatUGX } from '@/lib/formatUGX';
import { Receipt, type ReceiptData } from '@/components/Receipt';
import { getSettings } from '@/lib/settings';
import { getTodayInAppTz } from '@/lib/appTimezone';
import { Bike, Package } from 'lucide-react';
import type { OrderItem, PaymentMethod, PaymentSplit, OrderChannel } from '@/types';
import { CHANNEL_OPTIONS, DEFAULT_ORDER_CHANNEL } from '@/lib/orderConstants';

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  sellingPrice: number;
  costPrice: number;
  /** Original unit price (e.g. retail); used for discount display on receipt */
  originalPrice: number;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; image: string; code?: string }[] = [
  { value: 'cash', label: 'Cash', image: '/cash-icon.svg' },
  { value: 'mtn_momo', label: 'MTN MoMo', image: '/mtn-logo.svg', code: '474072' },
  { value: 'airtel_pay', label: 'Airtel Pay', image: '/airtel-logo.svg', code: '6947435' },
];

export default function POSPage() {
  const { data: productsList, loading: productsLoading } = useProducts({ realtime: true });
  const { data: promotionsList } = usePromotions({ realtime: true });
  const { data: suppliersList } = useSuppliers({ realtime: true });
  const products = useMemo(
    () =>
      productsList.map((d) => ({
        id: d.id,
        name: d.name,
        sku: d.sku ?? '',
        category: d.category ?? '',
        barcode: d.barcode,
        retailPrice: d.retailPrice,
        costPrice: d.costPrice,
        stock: d.stock,
        minStockLevel: d.minStockLevel ?? 0,
        supplierId: d.supplierId,
      })),
    [productsList]
  );
  const suppliers = useMemo(() => suppliersList.map((s) => ({ id: s.id, name: s.name })), [suppliersList]);
  const promotions = useMemo(() => {
    const now = getTodayInAppTz();
    return promotionsList
      .filter((p) => p.active && p.startDate <= now && (p.endDate ?? '') >= now)
      .map((p) => ({ id: p.id, name: p.name, type: p.type, value: p.value, minPurchase: p.minPurchase }));
  }, [promotionsList]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingPriceFor, setEditingPriceFor] = useState<string | null>(null);
  const [editPriceInput, setEditPriceInput] = useState('');
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastDeliveryCreated, setLastDeliveryCreated] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [sendForDelivery, setSendForDelivery] = useState(false);
  const [deliveryCustomerName, setDeliveryCustomerName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryRiderName, setDeliveryRiderName] = useState('');
  const [deliveryMotorcycleId, setDeliveryMotorcycleId] = useState('');
  const [isDeposit, setIsDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAmountError, setDepositAmountError] = useState<string | null>(null);
  const [depositCustomerName, setDepositCustomerName] = useState('');
  const [depositCustomerPhone, setDepositCustomerPhone] = useState('');
  const [orderChannel, setOrderChannel] = useState<OrderChannel>(DEFAULT_ORDER_CHANNEL);
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledForDate, setScheduledForDate] = useState('');
  const [backdateOrder, setBackdateOrder] = useState(false);
  const [orderDate, setOrderDate] = useState(() => getTodayInAppTz());
  const [orderTime, setOrderTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [restockProduct, setRestockProduct] = useState<{ id: string; name: string; costPrice: number; retailPrice: number; supplierId?: string } | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockRecordExpense, setRestockRecordExpense] = useState(true);
  const [restockSupplierId, setRestockSupplierId] = useState('');
  const [restockAddToCart, setRestockAddToCart] = useState(true);
  const [restockLoading, setRestockLoading] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!quickSearch.trim()) return products;
    const q = quickSearch.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, quickSearch]);

  const addToCart = (id: string, name: string, price: number, costPrice: number, qty = 1) => {
    const product = products.find((p) => p.id === id);
    const available = product ? Math.max(0, product.stock - (cart.find((l) => l.productId === id)?.qty ?? 0)) : 0;
    const toAdd = Math.min(qty, available);
    if (toAdd <= 0) {
      setMessage(product ? 'Not enough stock.' : 'Product not found.');
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + toAdd };
        return next;
      }
      return [...prev, { productId: id, name, qty: toAdd, sellingPrice: price, costPrice, originalPrice: price }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    const maxStock = product?.stock ?? Infinity;
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === productId);
      if (i < 0) return prev;
      const next = [...prev];
      let newQty = next[i].qty + delta;
      if (delta > 0 && newQty > maxStock) newQty = maxStock;
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

  const openRestock = (p: { id: string; name: string; costPrice: number; retailPrice: number; supplierId?: string }) => {
    setRestockProduct(p);
    setRestockQty('1');
    setRestockRecordExpense(true);
    setRestockSupplierId(p.supplierId ?? '');
    setRestockAddToCart(true);
  };

  const closeRestock = () => {
    setRestockProduct(null);
    setRestockQty('');
    setRestockSupplierId('');
    setRestockLoading(false);
  };

  const confirmRestock = async () => {
    if (!restockProduct) return;
    const qty = parseInt(String(restockQty).trim(), 10);
    if (Number.isNaN(qty) || qty <= 0) {
      setMessage('Enter a quantity (1 or more).');
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setRestockLoading(true);
    setMessage(null);
    try {
      const doc = await productsApi.getById(restockProduct.id);
      if (!doc) {
        setMessage('Product not found.');
        return;
      }
      const currentStock = doc.stock != null ? Number(doc.stock) : 0;
      const newStock = currentStock + qty;
      await productsApi.update(restockProduct.id, { stock: Math.max(0, Math.round(newStock)) });

      const costTotal = (doc.costPrice ?? restockProduct.costPrice) * qty;
      const today = getTodayInAppTz();
      if (restockRecordExpense) {
        await expensesApi.insert({
          id: `exp_${generateId()}`,
          date: today,
          itemBought: restockProduct.name,
          purpose: 'Inventory purchase',
          amount: costTotal,
          paidBy: 'Cash',
          receiptAttached: false,
          paidByWho: 'POS',
        });
      } else {
        const supplierIdForCredit = (restockSupplierId || doc.supplierId || '').trim();
        if (!supplierIdForCredit) {
          setMessage('Select a supplier when adding stock on credit.');
          setRestockLoading(false);
          return;
        }
        await supplierLedgerApi.insert({
          id: `ledger_${generateId()}`,
          supplierId: supplierIdForCredit,
          type: 'credit',
          amount: costTotal,
          date: today,
          note: `Stock: ${restockProduct.name} (×${qty})`,
        });
      }

      if (restockAddToCart) {
        addToCart(restockProduct.id, restockProduct.name, restockProduct.retailPrice, restockProduct.costPrice, qty);
      }
      setMessage(restockAddToCart ? `Stock added. ${qty} added to cart.` : restockRecordExpense ? 'Stock added.' : 'Stock added. Added to supplier credit.');
      setTimeout(() => setMessage(null), 4000);
      closeRestock();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add stock');
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setRestockLoading(false);
    }
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

  const placeOrder = async () => {
    if (cart.length === 0) return;
    for (const l of cart) {
      const p = products.find((x) => x.id === l.productId);
      if (p && l.qty > p.stock) {
        setMessage(`Not enough stock for "${l.name}". Available: ${p.stock}.`);
        return;
      }
    }
    if (isDeposit && useSplitPayment) {
      setMessage('Deposit orders cannot use split payments.');
      return;
    }
    if (useSplitPayment && !splitOk) {
      setMessage('Split total must equal order total.');
      return;
    }
    if (sendForDelivery && (!deliveryCustomerName.trim() || !deliveryPhone.trim() || !deliveryAddress.trim())) {
      setMessage('Fill customer name, phone and address for delivery.');
      return;
    }
    if (isDeposit && (!depositCustomerName.trim() || !depositCustomerPhone.trim())) {
      setMessage('Fill customer name and phone for deposit.');
      return;
    }
    if (scheduleForLater && !scheduledForDate) {
      setMessage('Select a date for scheduled order.');
      return;
    }
    if (isDeposit) {
      if (depositAmountError) {
        setMessage('Please fix deposit amount error before placing order.');
        return;
      }
      const depositAmt = parseFloat(depositAmount.replace(/,/g, ''));
      if (Number.isNaN(depositAmt) || depositAmt <= 0 || depositAmt >= subtotal) {
        setMessage('Enter a valid deposit amount (must be less than total).');
        return;
      }
    }
    setPlacing(true);
    setMessage(null);
    try {
      const now = backdateOrder && orderDate && orderTime
        ? (() => {
            const [y, m, d] = orderDate.split('-').map(Number);
            const [hr, min] = orderTime.split(':').map(Number);
            return new Date(y, m - 1, d, hr, min, 0, 0).toISOString();
          })()
        : new Date().toISOString();
      const orderId = `ord_${generateId()}`;
      const allOrders = await ordersApi.getAll();
      const maxNum = allOrders.reduce((m, o) => Math.max(m, o.orderNumber ?? 0), 0);
      const orderNumber = maxNum >= 1000 ? maxNum + 1 : 1000;
      const scheduledFor = scheduleForLater && scheduledForDate ? scheduledForDate : undefined;
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

      // Handle deposit/layaway
      if (isDeposit) {
        const depositAmt = parseFloat(depositAmount.replace(/,/g, ''));
        const layawayId = `lay_${generateId()}`;
        const layawayItems = cart.map((l) => ({
          productId: l.productId,
          name: l.name,
          qty: l.qty,
          unitPrice: l.sellingPrice,
          totalPrice: l.sellingPrice * l.qty,
        }));
        
        await layawaysApi.insert({
          id: layawayId,
          orderId,
          customerName: depositCustomerName.trim(),
          customerPhone: depositCustomerPhone.trim(),
          items: layawayItems,
          totalAmount: subtotal,
          paidAmount: depositAmt,
          remainingAmount: subtotal - depositAmt,
          status: 'active',
          createdAt: now,
        });

        // Create order with deposit status
        const orderPayload = {
          id: orderId,
          orderNumber,
          channel: orderChannel,
          type: 'retail',
          status: 'paid',
          createdAt: now,
          ...(scheduledFor && { scheduledFor }),
          items,
          total: subtotal,
          grossProfit,
          paymentMethod: paymentMethod, // Use selected payment method for deposit
          depositAmount: depositAmt,
          numberOfDeposits: 1,
          ...(selectedPromoId && { promotionId: selectedPromoId }),
        };
        await ordersApi.insert(orderPayload);

        // Don't reduce stock for layaways - items are held, not sold yet
        setMessage(`Deposit of ${formatUGX(depositAmt)} recorded. Remaining: ${formatUGX(subtotal - depositAmt)}. Items held.`);
      } else {
        // Regular order
        const orderPayload = {
          id: orderId,
          orderNumber,
          channel: orderChannel,
          type: 'retail',
          status: 'paid',
          createdAt: now,
          ...(scheduledFor && { scheduledFor }),
          items,
          total: subtotal,
          grossProfit,
          paymentMethod: useSplitPayment ? paymentSplits[0]?.method ?? 'cash' : paymentMethod,
          ...(useSplitPayment && paymentSplits.length > 0 && { paymentSplits }),
          ...(selectedPromoId && { promotionId: selectedPromoId }),
        };

        await ordersApi.insert(orderPayload);

        // Reduce stock for regular orders
        for (const line of cart) {
          const doc = await productsApi.getById(line.productId);
          if (doc) {
            const currentStock = doc.stock != null ? Number(doc.stock) : 0;
            if (!Number.isNaN(currentStock)) {
              const newStock = currentStock - line.qty;
              await productsApi.update(line.productId, { stock: Math.max(0, Math.round(newStock)) });
            }
          }
        }

        const selectedPaymentOption = PAYMENT_OPTIONS.find((o) => o.value === paymentMethod);
        const paymentLabel = useSplitPayment
          ? paymentSplits.map((s) => {
              const opt = PAYMENT_OPTIONS.find((o) => o.value === s.method);
              return `${opt?.label ?? s.method}: ${formatUGX(s.amount)}`;
            }).join(', ')
          : selectedPaymentOption?.label ?? paymentMethod;
        const paymentCode = useSplitPayment ? undefined : selectedPaymentOption?.code;

        const settings = getSettings();
        // Get customer details from delivery or deposit forms
        const customerName = sendForDelivery ? deliveryCustomerName.trim() : (isDeposit ? depositCustomerName.trim() : '');
        const customerPhone = sendForDelivery ? deliveryPhone.trim() : (isDeposit ? depositCustomerPhone.trim() : '');
        // Resolve item names for receipt (always show product name, never raw ID)
        const receiptItems = cart.map((l) => {
          const displayName =
            (l.name && l.name.trim()) ||
            products.find((p) => p.id === l.productId)?.name ||
            l.productId;
          return {
            name: displayName,
            qty: l.qty,
            unitPrice: l.sellingPrice,
            originalPrice: l.originalPrice > l.sellingPrice ? l.originalPrice : undefined,
            lineTotal: l.sellingPrice * l.qty,
          };
        });
        setLastReceipt({
          orderId,
          orderNumber,
          createdAt: now,
          paymentMethod: paymentLabel,
          paymentCode,
          total: subtotal,
          businessName: settings.businessName,
          address: settings.address,
          businessPhone: settings.phone,
          businessEmail: settings.email,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          items: receiptItems,
        });
        setLastOrderId(orderId);

        if (sendForDelivery && deliveryCustomerName.trim() && deliveryPhone.trim() && deliveryAddress.trim()) {
          const deliveryId = `del_${generateId()}`;
          await deliveriesApi.insert({
            id: deliveryId,
            orderId,
            customerName: deliveryCustomerName.trim(),
            customerPhone: deliveryPhone.trim(),
            address: deliveryAddress.trim(),
            amountToCollect: subtotal, // Always set to order total
            paymentStatus: 'unpaid',
            deliveryStatus: 'pending',
            ...(deliveryRiderName.trim() && { riderName: deliveryRiderName.trim() }),
            ...(deliveryMotorcycleId.trim() && { motorcycleId: deliveryMotorcycleId.trim() }),
            createdAt: now,
          });
          setLastDeliveryCreated(true);
        } else {
          setLastDeliveryCreated(false);
        }
      }

      // Add or update customer in customer list when we have name + phone (delivery or deposit)
      const shouldUpsertCustomer =
        (sendForDelivery && deliveryCustomerName.trim() && deliveryPhone.trim()) ||
        (isDeposit && depositCustomerName.trim() && depositCustomerPhone.trim());
      if (shouldUpsertCustomer) {
        const cName = sendForDelivery ? deliveryCustomerName.trim() : depositCustomerName.trim();
        const cPhone = sendForDelivery ? deliveryPhone.trim() : depositCustomerPhone.trim();
        const cAddress = sendForDelivery ? deliveryAddress.trim() : undefined;
        const existingDoc = await customersApi.getByPhone(cPhone);
        const nowIso = new Date().toISOString();
        if (existingDoc) {
          await customersApi.update(existingDoc.id, {
            name: cName,
            ...(cAddress !== undefined && cAddress !== '' && { address: cAddress }),
          });
        } else {
          await customersApi.insert({
            id: `cust_${generateId()}`,
            name: cName,
            phone: cPhone,
            address: cAddress || undefined,
            createdAt: nowIso,
          });
        }
      }

      setCart([]);
      setPaymentSplits([]);
      setUseSplitPayment(false);
      setSelectedPromoId(null);
      setSendForDelivery(false);
      setDeliveryCustomerName('');
      setDeliveryPhone('');
      setDeliveryAddress('');
      setIsDeposit(false);
      setDepositAmount('');
      setDepositAmountError(null);
      setDepositCustomerName('');
      setDepositCustomerPhone('');
      setOrderChannel(DEFAULT_ORDER_CHANNEL);
      setScheduleForLater(false);
      setScheduledForDate('');
      if (!isDeposit) {
        setMessage('Order placed successfully.' + (sendForDelivery ? ' Delivery created.' : '') + ' Print receipt below.');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  if (productsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading database…
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">POS Checkout</h1>
        <Link to="/" className="btn-secondary inline-flex w-fit shrink-0 text-sm">
          ← Dashboard
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="card p-3 sm:p-4">
          <h2 className="mb-2 sm:mb-3 font-heading text-base font-semibold text-smoky-black sm:text-lg">Products</h2>
          <label htmlFor="pos-quick-search" className="sr-only">Quick search products</label>
          <input
            id="pos-quick-search"
            name="quick_search"
            type="text"
            placeholder="🔍 Quick search: SKU, name, category"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            className="input-base mb-3 w-full py-2.5 text-sm"
            autoComplete="off"
          />
          <div className="max-h-[40vh] space-y-1.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/50 p-2 sm:max-h-[50vh]">
            {filteredProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                {products.length === 0 ? 'No products. Add some in Inventory.' : 'No matches. Try another search.'}
              </p>
            ) : (
              filteredProducts.map((p) =>
                p.stock <= 0 ? (
                  <div
                    key={p.id}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-3 shadow-sm"
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <span className="block font-medium text-smoky-black">{p.name}</span>
                      <span className="text-xs text-slate-500">{p.sku}</span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="block font-semibold text-emerald-700">{formatUGX(p.retailPrice)}</span>
                      <span className="text-xs text-slate-500">Stock: {p.stock}</span>
                      <button
                        type="button"
                        onClick={() => openRestock({ id: p.id, name: p.name, costPrice: p.costPrice, retailPrice: p.retailPrice, supplierId: p.supplierId })}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-200"
                      >
                        <Package className="h-3.5 w-3.5" />
                        Restock
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      addToCart(p.id, p.name, p.retailPrice, p.costPrice);
                      setQuickSearch('');
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-3 text-left shadow-sm transition hover:bg-emerald-50 hover:shadow-md"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="block font-medium text-smoky-black">{p.name}</span>
                      <span className="text-xs text-slate-500">{p.sku}</span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="block font-semibold text-emerald-700">{formatUGX(p.retailPrice)}</span>
                      <span className={`text-xs ${p.minStockLevel != null && p.stock <= p.minStockLevel ? 'text-red-600' : 'text-slate-500'}`}>
                        Stock: {p.stock}
                      </span>
                    </div>
                  </button>
                )
              )
            )}
          </div>
        </section>

        <section className="card p-3 sm:p-4 lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-2 sm:mb-3 font-heading text-base font-semibold text-smoky-black sm:text-lg">Cart</h2>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-3 sm:p-4">
            {cart.length === 0 ? (
              <p className="py-4 text-center text-slate-500">Cart is empty</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {cart.map((l) => {
                    const productStock = products.find((p) => p.id === l.productId)?.stock ?? 0;
                    const atMaxStock = l.qty >= productStock;
                    return (
                    <li key={l.productId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <span className="block font-medium text-smoky-black">{l.name}</span>
                        <span className="text-xs text-slate-500">
                          {l.originalPrice > l.sellingPrice ? (
                            <>
                              <span className="line-through">{formatUGX(l.originalPrice)}</span>
                              <span className="ml-1 text-emerald-600 font-medium">{formatUGX(l.sellingPrice)}</span>
                            </>
                          ) : (
                            formatUGX(l.sellingPrice)
                          )}
                          {' × '}
                          {l.qty}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white">
                          <button
                            type="button"
                            onClick={() => updateQty(l.productId, -1)}
                            className="px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            −
                          </button>
                          <span className="w-10 text-center text-sm font-semibold">{l.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(l.productId, 1)}
                            disabled={atMaxStock}
                            className="px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                        {editingPriceFor === l.productId ? (
                          <div className="flex items-center gap-1">
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
                              className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                              autoFocus
                              placeholder="Price"
                            />
                            <button
                              type="button"
                              onClick={() => applyEditPrice(l.productId)}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              ✓
                            </button>
                            <button type="button" onClick={cancelEditPrice} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="w-24 text-right font-semibold text-emerald-700">{formatUGX(l.sellingPrice * l.qty)}</span>
                            <button
                              type="button"
                              onClick={() => startEditPrice(l)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                              title="Change price"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFromCart(l.productId)}
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              aria-label="Remove"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                  })}
                </ul>
                {/* Summary & Quick Actions */}
                <div className="mt-4 space-y-3 rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-slate-700">Total</span>
                    <span className="text-2xl font-bold text-emerald-700">{formatUGX(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Profit</span>
                    <span className="font-semibold text-emerald-600">{formatUGX(grossProfit)}</span>
                  </div>
                  {promoDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Promotion</span>
                      <span className="font-semibold text-green-600">−{formatUGX(promoDiscount)}</span>
                    </div>
                  )}
                </div>

                {/* Quick Payment Methods */}
                <div className="mt-3 sm:mt-4">
                  <label className="mb-1.5 sm:mb-2 block text-xs font-medium text-slate-600">Quick Payment</label>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {PAYMENT_OPTIONS.map((option) => {
                      const isSelected = !useSplitPayment && paymentMethod === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(option.value as PaymentMethod);
                            setUseSplitPayment(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 py-2.5 text-xs font-medium transition min-h-[3.5rem] sm:min-h-0 sm:gap-1 sm:px-3 sm:py-3 sm:text-sm ${
                            isSelected
                              ? 'border-tufts-blue bg-tufts-blue text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-tufts-blue hover:bg-tufts-blue/5'
                          }`}
                        >
                          <img 
                            src={option.image} 
                            alt={option.label}
                            className={`h-10 w-auto object-contain ${isSelected && option.value === 'cash' ? 'brightness-0 invert' : ''}`}
                            style={isSelected && option.value !== 'cash' ? { filter: 'brightness(0) invert(1)' } : {}}
                          />
                          <span>{option.label}</span>
                          {option.code && (
                            <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                              {option.code}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {useSplitPayment && (
                    <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      {paymentSplits.map((split, i) => (
                        <div key={i} className="flex gap-2">
                          <select
                            value={split.method}
                            onChange={(e) => updateSplit(i, e.target.value as PaymentMethod, split.amount)}
                            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
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
                            className="w-28 rounded border border-slate-300 bg-white px-2 py-1.5 text-right text-sm"
                            placeholder="Amount"
                          />
                          <button type="button" onClick={() => removeSplit(i)} className="rounded px-2 text-red-600 hover:bg-red-50">
                            ×
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={addSplit} className="text-sm font-medium text-tufts-blue underline">
                          + Add payment
                        </button>
                        <p className={`text-sm font-medium ${splitTotal === subtotal ? 'text-green-600' : 'text-amber-600'}`}>
                          {formatUGX(splitTotal)} / {formatUGX(subtotal)}
                        </p>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setUseSplitPayment(!useSplitPayment);
                      if (!useSplitPayment && paymentSplits.length === 0) {
                        setPaymentSplits([{ method: 'cash', amount: subtotal }]);
                      }
                      if (useSplitPayment) setPaymentSplits([]);
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {useSplitPayment ? '✓ Split Payment' : 'Split Payment'}
                  </button>
                </div>

                {/* Promotions - Checkboxes */}
                {promotions.length > 0 && (
                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium text-slate-600">Promotions</label>
                    <div className="space-y-1.5">
                      {promotions.map((promo) => {
                        const isSelected = selectedPromoId === promo.id;
                        const discountText =
                          promo.type === 'percent_off'
                            ? `${promo.value}% off`
                            : `${formatUGX(promo.value)} off`;
                        return (
                          <label
                            key={promo.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 transition ${
                              isSelected
                                ? 'border-emerald-400 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => setSelectedPromoId(e.target.checked ? promo.id : null)}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-slate-900">{promo.name}</span>
                              <span className="ml-2 text-xs text-slate-600">({discountText})</span>
                              {promo.minPurchase && (
                                <span className="ml-1 text-xs text-slate-500">
                                  min {formatUGX(promo.minPurchase)}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sales Channel - Compact */}
                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium text-slate-600">Channel</label>
                  <select
                    value={orderChannel}
                    onChange={(e) => setOrderChannel(e.target.value as OrderChannel)}
                    className="input-base w-full py-2 text-sm"
                  >
                    {CHANNEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Options - Compact Checkboxes */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={sendForDelivery}
                      onChange={(e) => {
                        setSendForDelivery(e.target.checked);
                        // Amount will be automatically set to order total when placing order
                        if (!e.target.checked) {
                          setDeliveryCustomerName('');
                          setDeliveryPhone('');
                          setDeliveryAddress('');
                          setDeliveryRiderName('');
                          setDeliveryMotorcycleId('');
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-tufts-blue focus:ring-tufts-blue"
                    />
                    <span className="text-xs font-medium text-slate-700">Delivery</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isDeposit}
                      disabled={useSplitPayment}
                      onChange={(e) => {
                        setIsDeposit(e.target.checked);
                        if (e.target.checked) {
                          const suggested = String(Math.round(subtotal * 0.3));
                          setDepositAmount(suggested);
                          setDepositAmountError(null);
                          setPaymentMethod('cash');
                        } else {
                          setDepositAmount('');
                          setDepositAmountError(null);
                          setDepositCustomerName('');
                          setDepositCustomerPhone('');
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-tufts-blue focus:ring-tufts-blue disabled:opacity-50"
                    />
                    <span className="text-xs font-medium text-slate-700">Deposit</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={scheduleForLater}
                      onChange={(e) => {
                        setScheduleForLater(e.target.checked);
                        if (!e.target.checked) setScheduledForDate('');
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-tufts-blue focus:ring-tufts-blue"
                    />
                    <span className="text-xs font-medium text-slate-700">Schedule for later</span>
                  </label>
                </div>

                {/* Schedule for later - date picker */}
                {scheduleForLater && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                    <label htmlFor="pos-scheduled-date" className="mb-1 block text-xs font-medium text-slate-600">Scheduled for (reminder on this day)</label>
                    <input
                      id="pos-scheduled-date"
                      name="scheduled_for"
                      type="date"
                      value={scheduledForDate}
                      min={getTodayInAppTz()}
                      onChange={(e) => setScheduledForDate(e.target.value)}
                      className="input-base w-full py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">You’ll see a reminder on the dashboard when this date arrives.</p>
                  </div>
                )}

                {/* Backdate order - for historical data (e.g. January) */}
                <div className="mt-3 flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={backdateOrder}
                      onChange={(e) => {
                        setBackdateOrder(e.target.checked);
                        if (!e.target.checked) {
                          setOrderDate(getTodayInAppTz());
                          const d = new Date();
                          setOrderTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-tufts-blue focus:ring-tufts-blue"
                    />
                    <span className="text-xs font-medium text-slate-700">Record order for a past date</span>
                  </label>
                </div>
                {backdateOrder && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <label htmlFor="pos-order-date" className="mb-1 block text-xs font-medium text-slate-600">Order date & time</label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        id="pos-order-date"
                        name="order_date"
                        type="date"
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                        className="input-base flex-1 min-w-[140px] py-2 text-sm"
                      />
                      <input
                        id="pos-order-time"
                        name="order_time"
                        type="time"
                        value={orderTime}
                        onChange={(e) => setOrderTime(e.target.value)}
                        className="input-base w-[120px] py-2 text-sm"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Use this to enter historical sales (e.g. January).</p>
                  </div>
                )}

                {/* Delivery Form - Collapsible */}
                {sendForDelivery && (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <label htmlFor="pos-delivery-customer" className="sr-only">Customer name</label>
                    <input
                      id="pos-delivery-customer"
                      name="delivery_customer_name"
                      type="text"
                      placeholder="Customer name *"
                      value={deliveryCustomerName}
                      onChange={(e) => setDeliveryCustomerName(e.target.value)}
                      className="input-base w-full py-2 text-sm"
                    />
                    <label htmlFor="pos-delivery-phone" className="sr-only">Phone</label>
                    <input
                      id="pos-delivery-phone"
                      name="delivery_phone"
                      type="tel"
                      placeholder="Phone *"
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      className="input-base w-full py-2 text-sm"
                    />
                    <label htmlFor="pos-delivery-address" className="sr-only">Delivery address</label>
                    <textarea
                      id="pos-delivery-address"
                      name="delivery_address"
                      placeholder="Delivery address *"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={2}
                      className="input-base w-full resize-none py-2 text-sm"
                    />
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Amount to collect</label>
                      <p className="text-lg font-semibold text-emerald-700">{formatUGX(subtotal)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Automatically set from order total</p>
                    </div>
                    <div className="border-t border-slate-200 pt-3 mt-2 space-y-2">
                      <label htmlFor="pos-delivery-rider" className="block text-xs font-medium text-slate-600">Assign rider (optional)</label>
                      <input
                        id="pos-delivery-rider"
                        name="delivery_rider"
                        type="text"
                        placeholder="Rider name"
                        value={deliveryRiderName}
                        onChange={(e) => setDeliveryRiderName(e.target.value)}
                        className="input-base w-full py-2 text-sm"
                      />
                      <label htmlFor="pos-delivery-motorcycle" className="sr-only">Motorcycle ID / Plate</label>
                      <input
                        id="pos-delivery-motorcycle"
                        name="delivery_motorcycle_id"
                        type="text"
                        placeholder="Motorcycle ID / Plate"
                        value={deliveryMotorcycleId}
                        onChange={(e) => setDeliveryMotorcycleId(e.target.value)}
                        className="input-base w-full py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Deposit Form - Collapsible */}
                {isDeposit && (
                  <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <label htmlFor="pos-deposit-customer" className="sr-only">Customer name</label>
                    <input
                      id="pos-deposit-customer"
                      name="deposit_customer_name"
                      type="text"
                      placeholder="Customer name *"
                      value={depositCustomerName}
                      onChange={(e) => setDepositCustomerName(e.target.value)}
                      className="input-base w-full py-2 text-sm"
                    />
                    <label htmlFor="pos-deposit-phone" className="sr-only">Phone</label>
                    <input
                      id="pos-deposit-phone"
                      name="deposit_phone"
                      type="tel"
                      placeholder="Phone *"
                      value={depositCustomerPhone}
                      onChange={(e) => setDepositCustomerPhone(e.target.value)}
                      className="input-base w-full py-2 text-sm"
                    />
                    <div>
                      <label htmlFor="pos-deposit-amount" className="mb-1 block text-xs text-slate-600">Deposit amount (UGX)</label>
                      <input
                        id="pos-deposit-amount"
                        name="deposit_amount"
                        type="text"
                        placeholder={`Total: ${formatUGX(subtotal)}`}
                        value={depositAmount}
                        onChange={(e) => {
                          const val = e.target.value.replace(/,/g, '');
                          setDepositAmount(val);
                          if (!val.trim()) {
                            setDepositAmountError(null);
                            return;
                          }
                          const amt = parseFloat(val);
                          if (isNaN(amt)) {
                            setDepositAmountError('Amount must be a number');
                          } else if (amt <= 0) {
                            setDepositAmountError('Amount must be greater than 0');
                          } else if (amt >= subtotal) {
                            setDepositAmountError('Deposit must be less than total');
                          } else {
                            setDepositAmountError(null);
                          }
                        }}
                        className={`input-base w-full py-2 text-sm ${depositAmountError ? 'border-red-300' : ''}`}
                      />
                      {depositAmountError && <p className="mt-1 text-xs text-red-600">{depositAmountError}</p>}
                      {depositAmount && !depositAmountError && (() => {
                        const amt = parseFloat(depositAmount.replace(/,/g, ''));
                        if (!Number.isNaN(amt) && amt > 0) {
                          const remaining = subtotal - amt;
                          return (
                            <p className="mt-1 text-xs text-slate-600">
                              Remaining: {formatUGX(remaining)} ({((remaining / subtotal) * 100).toFixed(1)}%)
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}

                {/* Place Order Button - Large & Prominent */}
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={placing || cart.length === 0 || !deliveryOk}
                  className="btn-primary mt-3 w-full py-3 text-base font-semibold shadow-lg disabled:opacity-50 sm:mt-4 sm:py-4 sm:text-lg"
                >
                  {placing
                    ? 'Processing…'
                    : isDeposit
                      ? '✓ Record Deposit'
                      : sendForDelivery
                        ? '✓ Place Order & Delivery'
                        : '✓ Complete Order'}
                </button>
              </>
            )}
          </div>
          {message && (
            <p className={`mt-2 text-sm ${message.startsWith('Order') || message.startsWith('Stock added') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </section>
      </div>

      {lastReceipt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-soft sm:max-w-lg sm:rounded-2xl sm:p-6">
            <Receipt
              key={lastOrderId ?? 'receipt'}
              data={lastReceipt}
              onClose={() => {
                setLastReceipt(null);
                setLastOrderId(null);
                setLastDeliveryCreated(false);
              }}
            />
            {lastDeliveryCreated && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 no-print">
                <p className="mb-3 text-sm font-medium text-emerald-900">
                  ✓ Delivery created successfully!
                </p>
                <Link
                  to="/deliveries"
                  onClick={() => {
                    setLastReceipt(null);
                    setLastOrderId(null);
                    setLastDeliveryCreated(false);
                  }}
                  className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
                >
                  <Bike className="h-4 w-4" />
                  Go to Deliveries
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="mb-1 font-heading text-lg font-semibold text-smoky-black">Quick restock</h3>
            <p className="mb-4 text-sm text-slate-600">{restockProduct.name}</p>
            <label className="mb-1 block text-xs font-medium text-slate-600">Quantity</label>
            <input
              type="number"
              min="1"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRestock();
                if (e.key === 'Escape') closeRestock();
              }}
              className="input-base mb-4 w-full py-2"
              autoFocus
            />
            <label className="mb-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={restockRecordExpense}
                onChange={(e) => setRestockRecordExpense(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Record as cash expense (inventory purchase)</span>
            </label>
            {!restockRecordExpense && (
              <div className="mb-4">
                <label htmlFor="restock-supplier" className="mb-1 block text-xs font-medium text-slate-600">Supplier (credit)</label>
                <select
                  id="restock-supplier"
                  value={restockSupplierId}
                  onChange={(e) => setRestockSupplierId(e.target.value)}
                  className="input-base w-full py-2 text-sm"
                  title="Select supplier to put credit on"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <label className="mb-4 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={restockAddToCart}
                onChange={(e) => setRestockAddToCart(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Add to cart after restock</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeRestock}
                disabled={restockLoading}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestock}
                disabled={restockLoading || (!restockRecordExpense && !restockSupplierId.trim())}
                className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
              >
                {restockLoading ? 'Adding…' : 'Add stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
