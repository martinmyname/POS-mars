import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLayaways, useProducts, layawaysApi, productsApi, ordersApi } from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { formatUGX } from '@/lib/formatUGX';
import { Money } from '@/components/Money';
import { format } from 'date-fns';
import { DollarSign, CheckCircle2, XCircle } from 'lucide-react';

interface LayawayItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export default function LayawaysPage() {
  useAuth();
  const { data: layawaysList, loading, refetch: refetchLayaways } = useLayaways({ realtime: true });
  const { data: productsList, refetch: refetchProducts } = useProducts({ realtime: true });
  type LayawayRow = {
    id: string;
    orderId?: string;
    customerName: string;
    customerPhone: string;
    items: LayawayItem[];
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: 'active' | 'completed' | 'cancelled';
    createdAt: string;
    completedAt?: string;
    notes?: string;
  };
  const layaways = useMemo<LayawayRow[]>(
    () =>
      [...layawaysList]
        .map((d) => ({
          id: d.id,
          orderId: d.orderId,
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          items: d.items as LayawayItem[],
          totalAmount: d.totalAmount,
          paidAmount: d.paidAmount,
          remainingAmount: d.remainingAmount,
          status: d.status as 'active' | 'completed' | 'cancelled',
          createdAt: d.createdAt,
          completedAt: d.completedAt,
          notes: d.notes,
        }))
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    [layawaysList]
  );
  const [filterStatus, setFilterStatus] = useState<'active' | 'completed' | 'cancelled' | 'all'>('all');
  const [selectedLayaway, setSelectedLayaway] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const filtered = layaways.filter((l) => filterStatus === 'all' || l.status === filterStatus);

  const recordPayment = async (id: string) => {
    const amountStr = paymentAmount;
    if (!amountStr) {
      setMessage('Enter payment amount');
      return;
    }
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    if (Number.isNaN(amount) || amount <= 0) {
      setMessage('Enter a valid payment amount');
      return;
    }

    const doc = await layawaysApi.getById(id);
    if (!doc) return;

    const currentPaid = doc.paidAmount;
    const newPaid = currentPaid + amount;
    const total = doc.totalAmount;
    const newRemaining = total - newPaid;

    if (newPaid > total) {
      setMessage('Payment amount exceeds remaining balance');
      return;
    }

    const updates: { paidAmount: number; remainingAmount: number; status?: string; completedAt?: string } = {
      paidAmount: newPaid,
      remainingAmount: newRemaining,
    };

    if (newRemaining <= 0) {
      updates.status = 'completed';
      updates.completedAt = new Date().toISOString();

      // When layaway is fully paid, recognise the profit on the original order.
      if (doc.orderId) {
        try {
          const items = (doc.items as LayawayItem[]) || [];
          const allProducts = productsList || [];
          let grossProfit = 0;
          for (const item of items) {
            const product = allProducts.find((p) => p.id === item.productId) ?? (await productsApi.getById(item.productId));
            const costPrice = product?.costPrice != null ? Number(product.costPrice) : 0;
            grossProfit += (item.unitPrice - costPrice) * item.qty;
          }
          await ordersApi.update(doc.orderId, { grossProfit });
        } catch (err) {
          // Swallow errors here so that stock updates and layaway completion still succeed.
          console.error(err);
        }
      }

      for (const item of doc.items as LayawayItem[]) {
        const productDoc = await productsApi.getById(item.productId);
        if (productDoc) {
          const currentStock = productDoc.stock != null ? Number(productDoc.stock) : 0;
          if (!Number.isNaN(currentStock)) {
            const newStock = currentStock - item.qty;
            await productsApi.update(item.productId, { stock: Math.max(0, Math.round(newStock)) });
          }
        }
      }
    }

    await layawaysApi.update(id, updates);
    await refetchLayaways();
    if (newRemaining <= 0) await refetchProducts();
    setPaymentAmount('');
    setSelectedLayaway(null);
    setMessage(newRemaining <= 0 ? 'Layaway completed! Items released.' : 'Payment recorded');
    setTimeout(() => setMessage(null), 3000);
  };

  const cancelLayaway = async (id: string) => {
    if (!confirm('Cancel this layaway? Items will be released.')) return;
    await layawaysApi.update(id, { status: 'cancelled' });
    await refetchLayaways();
    setMessage('Layaway cancelled');
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">
          Deposits & Layaways
        </h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">
          ← Dashboard
        </Link>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 ${
            message.includes('completed') || message.includes('recorded')
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-3">
          <h2 className="mb-3 font-sans text-title3 font-semibold text-smoky-black">Layaways</h2>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="input-base w-auto py-1.5 text-sm"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-slate-500">No layaways match. Add one from POS checkout.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((l) => {
                const isExpanded = selectedLayaway === l.id;
                const showPaymentForm = isExpanded && l.status === 'active';

                return (
                  <li key={l.id} className="border-b border-slate-100 last:border-b-0">
                    <div className="flex flex-col gap-3 px-4 py-3 transition hover:bg-slate-50/50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-smoky-black">{l.customerName}</p>
                        <p className="text-sm text-slate-600">{l.customerPhone}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Created: {format(new Date(l.createdAt), 'dd MMM yyyy, HH:mm')}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm">
                          <span className="font-semibold text-emerald-700">Total: <Money value={l.totalAmount} className="font-semibold text-emerald-700" /></span>
                          <span className="text-slate-600">Paid: <Money value={l.paidAmount} className="text-slate-600" /></span>
                          <span className="text-amber-600">Remaining: <Money value={l.remainingAmount} className="text-amber-600" /></span>
                        </div>
                        {l.status === 'completed' && l.completedAt && (
                          <p className="mt-1 text-xs text-emerald-600">
                            Completed: {format(new Date(l.completedAt), 'dd MMM yyyy, HH:mm')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            l.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : l.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {l.status === 'completed' ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Completed
                            </span>
                          ) : l.status === 'cancelled' ? (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              Cancelled
                            </span>
                          ) : (
                            'Active'
                          )}
                        </span>
                        {l.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => setSelectedLayaway(isExpanded ? null : l.id)}
                            className="btn-primary text-sm"
                          >
                            {isExpanded ? 'Cancel' : 'Record Payment'}
                          </button>
                        )}
                        {l.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => cancelLayaway(l.id)}
                            className="btn-secondary text-sm"
                          >
                            Cancel Layaway
                          </button>
                        )}
                      </div>
                    </div>
                    {showPaymentForm && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                        <div className="space-y-3">
                          <div>
                            <h3 className="mb-2 text-sm font-medium text-smoky-black">Items on Hold</h3>
                            <ul className="space-y-1 text-sm">
                              {l.items.map((item, idx) => (
                                <li key={idx} className="flex justify-between text-slate-600">
                                  <span>
                                    {item.name} × {item.qty}
                                  </span>
                                  <span><Money value={item.totalPrice} className="text-slate-600" /></span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="border-t border-slate-200 pt-3">
                            <h3 className="mb-2 text-sm font-medium text-smoky-black">Record Payment</h3>
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder={`Remaining: ${formatUGX(l.remainingAmount)}`}
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="input-base"
                              />
                              <button
                                type="button"
                                onClick={() => recordPayment(l.id)}
                                className="btn-primary w-full text-sm"
                              >
                                <DollarSign className="mr-1 inline h-4 w-4" />
                                Record Payment
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
