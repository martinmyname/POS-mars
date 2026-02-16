import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { useAuth } from '@/context/AuthContext';
import { formatUGX } from '@/lib/formatUGX';
import { format } from 'date-fns';
import { DollarSign, CheckCircle2, XCircle } from 'lucide-react';

interface LayawayItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

interface Layaway {
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
}

export default function LayawaysPage() {
  const db = useRxDB();
  useAuth();
  const [layaways, setLayaways] = useState<Layaway[]>([]);
  const [filterStatus, setFilterStatus] = useState<'active' | 'completed' | 'cancelled' | 'all'>('all');
  const [selectedLayaway, setSelectedLayaway] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const sub = db.layaways.find().$.subscribe((docs) => {
      const list = docs
        .filter((d) => !(d as { _deleted?: boolean })._deleted)
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
          completedAt: (d as { completedAt?: string }).completedAt,
          notes: (d as { notes?: string }).notes,
        }))
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      setLayaways(list);
    });
    return () => sub.unsubscribe();
  }, [db]);

  const filtered = layaways.filter((l) => filterStatus === 'all' || l.status === filterStatus);

  const recordPayment = async (id: string) => {
    if (!db) return;
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

    const doc = await db.layaways.findOne(id).exec();
    if (!doc) return;

    const currentPaid = doc.paidAmount;
    const newPaid = currentPaid + amount;
    const total = doc.totalAmount;
    const newRemaining = total - newPaid;

    if (newPaid > total) {
      setMessage('Payment amount exceeds remaining balance');
      return;
    }

    const updates: Record<string, unknown> = {
      paidAmount: newPaid,
      remainingAmount: newRemaining,
    };

    if (newRemaining <= 0) {
      updates.status = 'completed';
      updates.completedAt = new Date().toISOString();
      
      // Reduce stock when layaway is completed
      for (const item of doc.items as LayawayItem[]) {
        const productDoc = await db.products.findOne(item.productId).exec();
        if (productDoc) {
          // Ensure proper number conversion: handle null, undefined, string, or number
          const currentStock = productDoc.stock != null ? Number(productDoc.stock) : 0;
          if (!isNaN(currentStock)) {
            const newStock = currentStock - item.qty;
            await productDoc.patch({ stock: Math.max(0, Math.round(newStock)) });
          }
        }
      }
    }

    await doc.patch(updates);

    setPaymentAmount('');
    setSelectedLayaway(null);
    setMessage(newRemaining <= 0 ? 'Layaway completed! Items released.' : 'Payment recorded');
    setTimeout(() => setMessage(null), 3000);
  };

  const cancelLayaway = async (id: string) => {
    if (!db || !confirm('Cancel this layaway? Items will be released.')) return;
    const doc = await db.layaways.findOne(id).exec();
    if (!doc) return;
    await doc.patch({ status: 'cancelled' });
    setMessage('Layaway cancelled');
    setTimeout(() => setMessage(null), 3000);
  };

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black">
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
          <h2 className="mb-3 font-heading text-lg font-semibold text-smoky-black">Layaways</h2>
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
                          <span className="font-semibold text-emerald-700">Total: {formatUGX(l.totalAmount)}</span>
                          <span className="text-slate-600">Paid: {formatUGX(l.paidAmount)}</span>
                          <span className="text-amber-600">Remaining: {formatUGX(l.remainingAmount)}</span>
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
                                  <span>{formatUGX(item.totalPrice)}</span>
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
