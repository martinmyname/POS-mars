import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { format } from 'date-fns';
import { Bike } from 'lucide-react';
import type { Delivery as DeliveryType, DeliveryStatus, DeliveryPaymentStatus } from '@/types';

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
  const [deliveries, setDeliveries] = useState<DeliveryType[]>([]);
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'all'>('all');
  const [filterPayment, setFilterPayment] = useState<DeliveryPaymentStatus | 'all'>('all');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [amountToCollect, setAmountToCollect] = useState('');
  const [riderName, setRiderName] = useState('');
  const [motorcycleId, setMotorcycleId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const sub = db.deliveries.find().$.subscribe((docs) => {
      const list = docs
        .filter((d) => !(d as { _deleted?: boolean })._deleted)
        .map((d) => ({
          id: d.id,
          orderId: d.orderId,
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          address: d.address,
          amountToCollect: d.amountToCollect,
          paymentStatus: d.paymentStatus as DeliveryPaymentStatus,
          deliveryStatus: d.deliveryStatus as DeliveryStatus,
          riderName: d.riderName,
          motorcycleId: d.motorcycleId,
          notes: d.notes,
          createdAt: d.createdAt,
          deliveredAt: d.deliveredAt,
        }))
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      setDeliveries(list);
    });
    return () => sub.unsubscribe();
  }, [db]);

  const filtered = deliveries.filter((d) => {
    if (filterStatus !== 'all' && d.deliveryStatus !== filterStatus) return false;
    if (filterPayment !== 'all' && d.paymentStatus !== filterPayment) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !customerName.trim() || !customerPhone.trim() || !address.trim()) return;
    const amount = parseFloat(amountToCollect);
    if (Number.isNaN(amount) || amount < 0) {
      setMessage('Enter a valid amount to collect.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const id = `del_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.deliveries.insert({
        id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        address: address.trim(),
        amountToCollect: amount,
        paymentStatus: 'unpaid',
        deliveryStatus: 'pending',
        riderName: riderName.trim() || undefined,
        motorcycleId: motorcycleId.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      setCustomerName('');
      setCustomerPhone('');
      setAddress('');
      setAmountToCollect('');
      setRiderName('');
      setMotorcycleId('');
      setNotes('');
      setMessage('Delivery added.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add delivery');
    } finally {
      setSaving(false);
    }
  };

  const updateDelivery = async (
    id: string,
    updates: { deliveryStatus?: DeliveryStatus; paymentStatus?: DeliveryPaymentStatus }
  ) => {
    if (!db) return;
    const doc = await db.deliveries.findOne(id).exec();
    if (!doc) return;
    const patch: Record<string, unknown> = { ...updates };
    if (updates.deliveryStatus === 'delivered' && doc.deliveryStatus !== 'delivered') {
      patch.deliveredAt = new Date().toISOString();
    }
    await doc.patch(patch);
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
          Motorcycle deliveries
        </h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">
          ← Dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            <Bike className="h-5 w-5 text-tufts-blue" />
            New delivery
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Customer name *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className="input-base"
            />
            <input
              type="tel"
              placeholder="Customer phone *"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
              className="input-base"
            />
            <textarea
              placeholder="Delivery address *"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              required
              className="input-base resize-none"
            />
            <input
              type="number"
              placeholder="Amount to collect (UGX) *"
              value={amountToCollect}
              onChange={(e) => setAmountToCollect(e.target.value)}
              min="0"
              step="1"
              required
              className="input-base"
            />
            <input
              type="text"
              placeholder="Rider name (optional)"
              value={riderName}
              onChange={(e) => setRiderName(e.target.value)}
              className="input-base"
            />
            <input
              type="text"
              placeholder="Motorcycle ID / plate (optional)"
              value={motorcycleId}
              onChange={(e) => setMotorcycleId(e.target.value)}
              className="input-base"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-base"
            />
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Adding…' : 'Add delivery'}
            </button>
          </form>
          {message && (
            <p
              className={`mt-2 text-sm ${
                message === 'Delivery added.' ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {message}
            </p>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-3">
            <h2 className="mb-3 font-heading text-lg font-semibold text-smoky-black">
              Deliveries
            </h2>
            <div className="flex flex-wrap gap-2">
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
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-slate-500">
                No deliveries match. Add one or change filters.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-3 px-4 py-3 transition hover:bg-slate-50/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-smoky-black">{d.customerName}</p>
                      <p className="truncate text-sm text-slate-600">{d.address}</p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(d.createdAt), 'dd MMM yyyy, HH:mm')}
                        {d.riderName && ` · ${d.riderName}`}
                        {d.motorcycleId && ` · ${d.motorcycleId}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-emerald-700">
                        {formatUGX(d.amountToCollect)}
                      </span>
                      <select
                        value={d.deliveryStatus}
                        onChange={(e) =>
                          updateDelivery(d.id, {
                            deliveryStatus: e.target.value as DeliveryStatus,
                          })
                        }
                        className="input-base w-auto py-1 text-xs"
                      >
                        {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {DELIVERY_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={d.paymentStatus}
                        onChange={(e) =>
                          updateDelivery(d.id, {
                            paymentStatus: e.target.value as DeliveryPaymentStatus,
                          })
                        }
                        className={`input-base w-auto py-1 text-xs ${
                          d.paymentStatus === 'paid'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : d.paymentStatus === 'partial'
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-red-200 bg-red-50 text-red-800'
                        }`}
                      >
                        {(Object.keys(PAYMENT_STATUS_LABELS) as DeliveryPaymentStatus[]).map(
                          (s) => (
                            <option key={s} value={s}>
                              {PAYMENT_STATUS_LABELS[s]}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
