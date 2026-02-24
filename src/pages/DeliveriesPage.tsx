import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { useAuth } from '@/context/AuthContext';
import { formatUGX } from '@/lib/formatUGX';
import { getTodayInAppTz, getStartOfDayAppTzAsUTC } from '@/lib/appTimezone';
import { triggerImmediateSync } from '@/lib/rxdb';
import { format } from 'date-fns';
import { Bike, DollarSign, ChevronDown, ChevronRight, Package, MapPin, Phone, Archive, RefreshCw } from 'lucide-react';
import type { Delivery as DeliveryType, DeliveryStatus, DeliveryPaymentStatus, Order, Product } from '@/types';

const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PAYMENT_STATUS_LABELS: Record<DeliveryPaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

export default function DeliveriesPage() {
  const db = useRxDB();
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryType[]>([]);
  const [orders, setOrders] = useState<Map<string, Order>>(new Map());
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'all'>('all');
  const [filterPayment, setFilterPayment] = useState<DeliveryPaymentStatus | 'all'>('all');
  const [quickFilter, setQuickFilter] = useState<'attention' | 'unpaid' | 'in_transit' | 'completed' | 'cancelled' | 'all'>('attention');
  const [hideCompleted, setHideCompleted] = useState(true);
  const [hidePreviousDayCompleted, setHidePreviousDayCompleted] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [riderName, setRiderName] = useState<Record<string, string>>({});
  const [motorcycleId, setMotorcycleId] = useState<Record<string, string>>({});
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});
  const [paymentReceivedBy, setPaymentReceivedBy] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // When Deliveries page is open, periodically pull latest from server so all users see
  // the same state (e.g. when one user records delivery cash received, others see it within ~15s).
  useEffect(() => {
    if (!db) return;
    const interval = setInterval(() => {
      triggerImmediateSync('deliveries');
    }, 15_000);
    return () => clearInterval(interval);
  }, [db]);

  useEffect(() => {
    if (!db) return;
    
    // Load deliveries (only those with orderId)
    const subDeliveries = db.deliveries.find().$.subscribe((docs) => {
      const list = docs
        .filter((d) => !(d as { _deleted?: boolean })._deleted && d.orderId)
        .map((d) => ({
          id: d.id,
          orderId: d.orderId,
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          address: d.address,
          amountToCollect: d.amountToCollect,
          paymentStatus: d.paymentStatus as DeliveryPaymentStatus,
          deliveryStatus: d.deliveryStatus as DeliveryStatus,
          riderName: (d as { riderName?: string }).riderName,
          motorcycleId: (d as { motorcycleId?: string }).motorcycleId,
          paymentReceivedAt: (d as { paymentReceivedAt?: string }).paymentReceivedAt,
          paymentReceivedAmount: (d as { paymentReceivedAmount?: number }).paymentReceivedAmount,
          paymentReceivedBy: (d as { paymentReceivedBy?: string }).paymentReceivedBy,
          notes: d.notes,
          createdAt: d.createdAt,
          deliveredAt: d.deliveredAt,
        }))
        .sort((a, b) => {
          // Sort by: pending/in_transit first, then by date
          const statusPriority: Record<DeliveryStatus, number> = {
            pending: 1,
            in_transit: 2,
            dispatched: 3,
            delivered: 4,
            cancelled: 5,
          };
          const aPriority = statusPriority[a.deliveryStatus] || 6;
          const bPriority = statusPriority[b.deliveryStatus] || 6;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return b.createdAt > a.createdAt ? 1 : -1;
        });
      setDeliveries(list);
    });
    
    // Load orders for display
    const subOrders = db.orders.find().$.subscribe((docs) => {
      const orderMap = new Map<string, Order>();
      docs
        .filter((d) => !(d as { _deleted?: boolean })._deleted)
        .forEach((d) => {
          orderMap.set(d.id, {
            id: d.id,
            orderNumber: (d as { orderNumber?: number }).orderNumber,
            channel: d.channel,
            type: d.type,
            status: d.status,
            createdAt: d.createdAt,
            scheduledFor: (d as { scheduledFor?: string }).scheduledFor,
            items: d.items,
            total: d.total,
            grossProfit: d.grossProfit,
            paymentMethod: d.paymentMethod,
            paymentSplits: d.paymentSplits,
            customer: d.customer,
            customerId: d.customerId,
            depositAmount: d.depositAmount,
            numberOfDeposits: d.numberOfDeposits,
            notes: d.notes,
            promotionId: d.promotionId,
            orderType: d.orderType,
            linkedOrderId: d.linkedOrderId,
          });
        });
      setOrders(orderMap);
    });

    // Load products for item names
    const subProducts = db.products.find().$.subscribe((docs) => {
      const productMap = new Map<string, Product>();
      docs
        .filter((d) => !(d as { _deleted?: boolean })._deleted)
        .forEach((d) => {
          productMap.set(d.id, {
            id: d.id,
            sku: d.sku,
            name: d.name,
            category: d.category,
            retailPrice: d.retailPrice,
            wholesalePrice: d.wholesalePrice,
            costPrice: d.costPrice,
            stock: d.stock,
            minStockLevel: d.minStockLevel,
            reorderLevel: d.reorderLevel,
            maxStockLevel: d.maxStockLevel,
            imageUrl: d.imageUrl,
            barcode: d.barcode,
            supplierId: d.supplierId,
          });
        });
      setProducts(productMap);
    });
    
    return () => {
      subDeliveries.unsubscribe();
      subOrders.unsubscribe();
      subProducts.unsubscribe();
    };
  }, [db]);

  const todayStart = getStartOfDayAppTzAsUTC(getTodayInAppTz()).getTime();
  const isCompleted = (d: DeliveryType) =>
    d.deliveryStatus === 'delivered' && d.paymentStatus === 'paid';
  const isFromPreviousDay = (d: DeliveryType) =>
    new Date(d.createdAt).getTime() < todayStart;
  const needsAttention = (d: DeliveryType) =>
    d.paymentStatus !== 'paid' || (d.deliveryStatus === 'pending' && !d.riderName);

  const filtered = deliveries
    .filter((d) => {
      // Cancelled: only show in "Cancelled" filter; exclude from all other views
      if (d.deliveryStatus === 'cancelled') {
        if (quickFilter === 'cancelled') return true;
        return false;
      }
      if (quickFilter === 'cancelled') return false;
      // Apply quick filter first (overrides dropdowns when not 'all')
      if (quickFilter === 'attention') {
        if (!needsAttention(d)) return false;
      } else if (quickFilter === 'unpaid') {
        if (d.paymentStatus === 'paid') return false;
      } else if (quickFilter === 'in_transit') {
        if (d.deliveryStatus !== 'in_transit' && d.deliveryStatus !== 'dispatched') return false;
      } else if (quickFilter === 'completed') {
        if (!isCompleted(d)) return false;
      }
      // Then apply dropdown filters when quick filter is 'all'
      if (quickFilter === 'all') {
        if (filterStatus !== 'all' && d.deliveryStatus !== filterStatus) return false;
        if (filterPayment !== 'all' && d.paymentStatus !== filterPayment) return false;
      }
      // Hide completed: exclude delivered+paid
      if (hideCompleted && isCompleted(d)) return false;
      // Hide previous day completed: exclude completed deliveries from before today
      if (hidePreviousDayCompleted && isCompleted(d) && isFromPreviousDay(d)) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort: needs attention first, then by status (pending/in_transit before delivered), then newest first
      const attentionA = needsAttention(a) ? 0 : 1;
      const attentionB = needsAttention(b) ? 0 : 1;
      if (attentionA !== attentionB) return attentionA - attentionB;
      const statusOrder: Record<DeliveryStatus, number> = {
        pending: 1,
        in_transit: 2,
        dispatched: 3,
        delivered: 4,
        cancelled: 5,
      };
      const pa = statusOrder[a.deliveryStatus] ?? 6;
      const pb = statusOrder[b.deliveryStatus] ?? 6;
      if (pa !== pb) return pa - pb;
      return b.createdAt > a.createdAt ? 1 : -1;
    });

  const handleUpdateRider = async (id: string) => {
    if (!db) return;
    const doc = await db.deliveries.findOne(id).exec();
    if (!doc) return;
    
    const newRiderName = riderName[id]?.trim() || '';
    const newMotorcycleId = motorcycleId[id]?.trim() || '';
    
    const updates: Record<string, unknown> = {
      riderName: newRiderName || undefined,
      motorcycleId: newMotorcycleId || undefined,
      _modified: new Date().toISOString(), // Ensure sync detects the change
    };
    
    // Auto-update status to "in_transit" when rider is assigned and status is still "pending"
    if (newRiderName && doc.deliveryStatus === 'pending') {
      updates.deliveryStatus = 'in_transit';
    }
    
    await doc.patch(updates);
    
    // Trigger immediate sync so all active users see the rider assignment instantly
    triggerImmediateSync('deliveries');
    
    // Clear form
    setRiderName((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMotorcycleId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    
    setMessage('Rider assigned');
    setTimeout(() => setMessage(null), 3000);
  };

  const recordPayment = async (id: string, amountOverride?: number) => {
    if (!db) return;
    const doc = await db.deliveries.findOne(id).exec();
    if (!doc) return;
    
    const currentAmount = (doc as { paymentReceivedAmount?: number }).paymentReceivedAmount ?? 0;
    const totalToCollect = doc.amountToCollect;
    const remaining = totalToCollect - currentAmount;
    
    // Use override amount if provided, otherwise use paymentAmount state, otherwise use remaining amount
    let amount: number;
    if (amountOverride !== undefined) {
      amount = amountOverride;
    } else {
      const amountStr = paymentAmount[id];
      if (!amountStr) {
        // If no amount entered, use remaining amount
        amount = remaining;
      } else {
        amount = parseFloat(amountStr.replace(/,/g, ''));
        if (Number.isNaN(amount) || amount <= 0) {
          amount = remaining;
        }
      }
    }
    
    const receivedBy = paymentReceivedBy[id] || user?.email || 'Staff';
    const newAmount = currentAmount + amount;
    
    // Determine payment status: if new amount equals or exceeds total, mark as paid
    let newPaymentStatus: DeliveryPaymentStatus;
    if (newAmount >= totalToCollect) {
      newPaymentStatus = 'paid';
    } else if (newAmount > 0) {
      newPaymentStatus = 'partial';
    } else {
      newPaymentStatus = 'unpaid';
    }
    
    const updates: Record<string, unknown> = {
      paymentStatus: newPaymentStatus,
      paymentReceivedAmount: newAmount,
      paymentReceivedAt: new Date().toISOString(),
      paymentReceivedBy: receivedBy.trim(),
      _modified: new Date().toISOString(), // Ensure sync detects the change
    };
    
    // If payment is fully received, also mark as delivered
    if (newPaymentStatus === 'paid' && doc.deliveryStatus !== 'delivered') {
      updates.deliveryStatus = 'delivered';
      updates.deliveredAt = new Date().toISOString();
    }
    
    await doc.patch(updates);
    
    // Trigger immediate sync so all active users see payment updates instantly
    triggerImmediateSync('deliveries');
    
    // Clear form
    setPaymentAmount((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPaymentReceivedBy((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExpandedDelivery(null);
    
    // Show success message
    if (newPaymentStatus === 'paid') {
      setMessage(`✓ Payment fully received! Total: ${formatUGX(newAmount)}. Delivery marked as completed.`);
    } else {
      setMessage(`Payment recorded: ${formatUGX(amount)}. Remaining: ${formatUGX(totalToCollect - newAmount)}`);
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const updateDeliveryStatus = async (id: string, status: DeliveryStatus) => {
    if (!db) return;
    const doc = await db.deliveries.findOne(id).exec();
    if (!doc) return;
    if (status === 'cancelled') {
      const orderId = doc.orderId;
      if (orderId) {
        const orderDoc = await db.orders.findOne(orderId).exec();
        if (orderDoc && orderDoc.items?.length) {
          for (const item of orderDoc.items) {
            const productDoc = await db.products.findOne(item.productId).exec();
            if (productDoc) {
              // Ensure proper number conversion: handle null, undefined, string, or number
              const currentStock = productDoc.stock != null ? Number(productDoc.stock) : 0;
              if (!isNaN(currentStock)) {
                const newStock = currentStock + item.qty;
                await productDoc.patch({ stock: Math.max(0, Math.round(newStock)) });
              }
            }
          }
          await orderDoc.patch({ status: 'cancelled' });
        }
      }
      // Also sync products since stock was returned
      triggerImmediateSync('products');
    }
    const patch: Record<string, unknown> = { 
      deliveryStatus: status,
      _modified: new Date().toISOString(), // Ensure sync detects the change
    };
    if (status === 'delivered' && doc.deliveryStatus !== 'delivered') {
      patch.deliveredAt = new Date().toISOString();
    }
    await doc.patch(patch);
    
    // Trigger immediate sync so all active users see status changes instantly
    triggerImmediateSync('deliveries');
    if (status === 'cancelled') {
      // Also sync orders since cancellation updates order status
      triggerImmediateSync('orders');
      setMessage('Delivery cancelled. Stock has been returned and order marked cancelled.');
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const refreshDeliveriesFromServer = () => {
    setIsRefreshing(true);
    triggerImmediateSync('deliveries');
    setTimeout(() => setIsRefreshing(false), 800);
  };

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="page-subtitle">Manage rider deliveries and payment collection</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshDeliveriesFromServer}
            disabled={isRefreshing}
            className="btn-secondary inline-flex w-fit shrink-0 items-center gap-1.5 text-sm disabled:opacity-70"
            title="Refresh deliveries from server (see updates from other users)"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing…' : 'Refresh'}
          </button>
          <Link to="/pos" className="btn-secondary inline-flex w-fit shrink-0 text-sm">
            ← Create Delivery from POS
          </Link>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${
          message.includes('✓') 
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}>
          {message}
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-4">
          <h2 className="mb-3 font-heading text-lg font-semibold text-smoky-black">
            Deliveries
          </h2>
          {/* Quick filters */}
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                { value: 'attention' as const, label: 'Needs attention', count: deliveries.filter(needsAttention).length },
                { value: 'unpaid' as const, label: 'Unpaid', count: deliveries.filter((d) => d.deliveryStatus !== 'cancelled' && d.paymentStatus !== 'paid').length },
                { value: 'in_transit' as const, label: 'In transit', count: deliveries.filter((d) => (d.deliveryStatus === 'in_transit' || d.deliveryStatus === 'dispatched')).length },
                { value: 'completed' as const, label: 'Completed', count: deliveries.filter(isCompleted).length },
                { value: 'cancelled' as const, label: 'Cancelled', count: deliveries.filter((d) => d.deliveryStatus === 'cancelled').length },
                { value: 'all' as const, label: 'All', count: deliveries.length },
              ] as const
            ).map(({ value, label, count }) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuickFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  quickFilter === value
                    ? 'bg-tufts-blue text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
                <span className={`ml-1.5 ${quickFilter === value ? 'text-white/90' : 'text-slate-500'}`}>
                  ({count})
                </span>
              </button>
            ))}
          </div>
          {/* Hide completed / previous day */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-tufts-blue focus:ring-tufts-blue"
              />
              <span className="flex items-center gap-1.5">
                <Archive className="h-4 w-4 text-slate-500" />
                Hide completed (delivered + paid)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hidePreviousDayCompleted}
                onChange={(e) => setHidePreviousDayCompleted(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-tufts-blue focus:ring-tufts-blue"
              />
              <span>Hide yesterday’s completed</span>
            </label>
          </div>
          {/* Legacy dropdowns when quick filter is All */}
          {quickFilter === 'all' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as DeliveryStatus | 'all')}
                className="input-base w-auto py-1.5 text-sm"
              >
                <option value="all">All status</option>
                {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {DELIVERY_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <select
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value as DeliveryPaymentStatus | 'all')}
                className="input-base w-auto py-1.5 text-sm"
              >
                <option value="all">All payment</option>
                {(Object.keys(PAYMENT_STATUS_LABELS) as DeliveryPaymentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-slate-500">
                {deliveries.length === 0
                  ? 'No deliveries yet. Create a delivery from the POS checkout page.'
                  : quickFilter === 'cancelled'
                    ? 'No cancelled deliveries.'
                    : quickFilter === 'attention' || hideCompleted
                      ? 'No active or unpaid deliveries. All caught up!'
                      : 'No deliveries match the selected filters.'}
              </p>
              {deliveries.length === 0 && (
                <Link to="/pos" className="mt-4 inline-block btn-primary">
                  Go to POS
                </Link>
              )}
              {deliveries.length > 0 && (quickFilter !== 'all' || hideCompleted) && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickFilter('all');
                    setHideCompleted(false);
                    setHidePreviousDayCompleted(false);
                  }}
                  className="mt-4 btn-secondary text-sm"
                >
                  Show all deliveries
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((d) => {
                const isExpanded = expandedDelivery === d.id;
                const receivedAmount = d.paymentReceivedAmount ?? 0;
                const remaining = d.amountToCollect - receivedAmount;
                const order = d.orderId ? orders.get(d.orderId) : null;
                const needsRider = !d.riderName && d.deliveryStatus === 'pending';
                const canRecordPayment = d.deliveryStatus === 'in_transit' || d.deliveryStatus === 'delivered';
                
                return (
                  <li key={d.id} className="border-b border-slate-100 last:border-b-0">
                    <div className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-smoky-black">{d.customerName}</p>
                              {d.orderId && (
                                <span className="shrink-0 rounded bg-tufts-blue/10 px-2 py-0.5 text-xs font-medium text-tufts-blue">
                                  Order #{order?.orderNumber ?? d.orderId.slice(-8)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {d.customerPhone}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[200px]">{d.address}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {order && (
                          <div className="mt-2 rounded-lg bg-slate-50/50 px-2 py-1.5 text-xs">
                            <span className="font-medium text-slate-700">Items: </span>
                            <span className="text-slate-600">
                              {order.items.map((item, idx) => (
                                <span key={idx}>
                                  {products.get(item.productId)?.name ?? (item as { name?: string }).name ?? item.productId} × {item.qty}
                                  {idx < order.items.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                        
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>Created: {format(new Date(d.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                          {d.riderName && (
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Bike className="h-3 w-3" />
                              {d.riderName}
                              {d.motorcycleId && ` (${d.motorcycleId})`}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                        <div className="text-right">
                          <div className="text-lg font-bold text-emerald-700">
                            {formatUGX(d.amountToCollect)}
                          </div>
                          {receivedAmount > 0 && (
                            <div className="text-xs text-slate-500">
                              Paid: {formatUGX(receivedAmount)}
                              {remaining > 0 && (
                                <span className="ml-1 font-medium text-amber-600">
                                  · Remaining: {formatUGX(remaining)}
                                </span>
                              )}
                            </div>
                          )}
                          {receivedAmount === 0 && (
                            <div className="text-xs text-slate-400">Not paid yet</div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <select
                            value={d.deliveryStatus}
                            onChange={(e) => updateDeliveryStatus(d.id, e.target.value as DeliveryStatus)}
                            className={`input-base w-auto py-1.5 text-xs font-medium ${
                              d.deliveryStatus === 'delivered'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : d.deliveryStatus === 'in_transit'
                                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                                  : 'border-slate-300'
                            }`}
                          >
                            {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {DELIVERY_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                          
                          <div className={`rounded px-2 py-1 text-xs font-medium ${
                            d.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : d.paymentStatus === 'partial'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {PAYMENT_STATUS_LABELS[d.paymentStatus]}
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setExpandedDelivery(isExpanded ? null : d.id)}
                            className="rounded p-1.5 text-slate-600 hover:bg-slate-100 touch-target"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50/30 px-4 py-4 space-y-4">
                        {/* Assign Rider Section */}
                        {needsRider && (
                          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                            <h3 className="mb-1 text-sm font-semibold text-blue-900">Assign Rider</h3>
                            <p className="mb-2 text-xs text-slate-600">Only needed when a rider wasn’t set at POS checkout.</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                type="text"
                                placeholder="Rider name *"
                                value={riderName[d.id] || ''}
                                onChange={(e) =>
                                  setRiderName((prev) => ({
                                    ...prev,
                                    [d.id]: e.target.value,
                                  }))
                                }
                                className="input-base text-sm"
                              />
                              <input
                                type="text"
                                placeholder="Motorcycle ID / Plate (optional)"
                                value={motorcycleId[d.id] || ''}
                                onChange={(e) =>
                                  setMotorcycleId((prev) => ({
                                    ...prev,
                                    [d.id]: e.target.value,
                                  }))
                                }
                                className="input-base text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateRider(d.id)}
                              disabled={!riderName[d.id]?.trim()}
                              className="btn-primary mt-2 w-full text-sm disabled:opacity-50"
                            >
                              <Bike className="mr-1 inline h-4 w-4" />
                              Assign Rider
                            </button>
                          </div>
                        )}
                        
                        {/* Rider Info Display */}
                        {d.riderName && (
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <h3 className="mb-2 text-sm font-semibold text-slate-700">Rider Information</h3>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Bike className="h-4 w-4" />
                              <span className="font-medium">{d.riderName}</span>
                              {d.motorcycleId && <span>· {d.motorcycleId}</span>}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Rider is delivering items and collecting cash from customer
                            </p>
                          </div>
                        )}
                        
                        {/* Payment Recording Section */}
                        {canRecordPayment && d.paymentStatus !== 'paid' && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                            <h3 className="mb-2 text-sm font-semibold text-emerald-900">
                              Record Payment Received from Rider
                            </h3>
                            <div className="mb-4 rounded-lg border border-emerald-300 bg-white p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Amount to receive:</span>
                                <span className="text-lg font-bold text-emerald-700">
                                  {formatUGX(remaining > 0 ? remaining : d.amountToCollect)}
                                </span>
                              </div>
                              {remaining > 0 && receivedAmount > 0 && (
                                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                  <span>Already received:</span>
                                  <span>{formatUGX(receivedAmount)}</span>
                                </div>
                              )}
                            </div>
                            <div className="mb-3">
                              <label className="mb-1 block text-xs font-medium text-slate-600">
                                Received by
                              </label>
                              <input
                                type="text"
                                placeholder={user?.user_metadata?.full_name || user?.email || 'Staff name'}
                                value={paymentReceivedBy[d.id] || user?.user_metadata?.full_name || user?.email || ''}
                                onChange={(e) =>
                                  setPaymentReceivedBy((prev) => ({
                                    ...prev,
                                    [d.id]: e.target.value,
                                  }))
                                }
                                className="input-base text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                // Record payment with remaining amount (or full amount if no partial payment)
                                const amountToRecord = remaining > 0 ? remaining : d.amountToCollect;
                                recordPayment(d.id, amountToRecord);
                              }}
                              className="btn-primary w-full text-sm font-semibold"
                            >
                              <DollarSign className="mr-2 inline h-4 w-4" />
                              Confirm Payment Received ({formatUGX(remaining > 0 ? remaining : d.amountToCollect)})
                            </button>
                            <p className="mt-2 text-xs text-slate-500 text-center">
                              Click to confirm rider has returned with the full payment
                            </p>
                          </div>
                        )}
                        
                        {/* Payment Status */}
                        {d.paymentStatus === 'paid' && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                            <p className="text-sm font-semibold text-emerald-700">
                              ✓ Payment Fully Received
                            </p>
                            {d.paymentReceivedAt && (
                              <p className="mt-1 text-xs text-emerald-600">
                                Received: {formatUGX(receivedAmount)} on{' '}
                                {format(new Date(d.paymentReceivedAt), 'dd MMM yyyy, HH:mm')}
                                {d.paymentReceivedBy && ` by ${d.paymentReceivedBy}`}
                              </p>
                            )}
                            {d.deliveryStatus === 'delivered' && (
                              <p className="mt-1 text-xs text-emerald-600">
                                Delivery completed on {d.deliveredAt && format(new Date(d.deliveredAt), 'dd MMM yyyy, HH:mm')}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Order Details */}
                        {order && (
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <h3 className="mb-2 text-sm font-semibold text-slate-700">Order Details</h3>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Order Total:</span>
                                <span className="font-semibold">{formatUGX(order.total)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Amount to Collect:</span>
                                <span className="font-semibold text-emerald-700">{formatUGX(d.amountToCollect)}</span>
                              </div>
                              <div className="mt-2 pt-2 border-t border-slate-100">
                                <span className="text-slate-600">Items:</span>
                                <ul className="mt-1 space-y-0.5">
                                  {order.items.map((item, idx) => (
                                    <li key={idx} className="text-slate-600">
                                      • {products.get(item.productId)?.name ?? (item as { name?: string }).name ?? item.productId} × {item.qty} @ {formatUGX((item as { unitPrice?: number }).unitPrice ?? item.sellingPrice)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {d.notes && (
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-xs text-slate-600">
                              <span className="font-medium">Notes:</span> {d.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
