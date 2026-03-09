import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCustomers, useOrders, customersApi, generateId } from '@/hooks/useData';
import { useCustomerSummary } from '@/hooks/useCustomerSummary';

export default function CustomersPage() {
  const { data: customers, loading } = useCustomers({ realtime: true });
  const { data: ordersList } = useOrders({ realtime: true });
  const orders = useMemo(
    () =>
      (ordersList ?? []).map((o) => ({
        customerId: o.customerId,
        createdAt: o.createdAt,
        orderType: o.orderType,
        status: o.status,
      })),
    [ordersList]
  );
  const { uniqueCustomers, returningCustomerRate, atRiskCount } = useCustomerSummary(orders, 'monthly');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      await customersApi.insert({
        id: `cust_${generateId()}`,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      setName('');
      setPhone('');
      setAddress('');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-smoky-black">Customers</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-[#1f2937] dark:bg-[#111827]/50">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-800 dark:text-slate-200">This month:</span>{' '}
          {uniqueCustomers} unique customers · {returningCustomerRate.toFixed(0)}% returning · {atRiskCount} at-risk
        </p>
        <Link to="/reports/daily" className="mt-1 inline-block text-sm font-medium text-tufts-blue hover:underline">
          See full customer analytics → Reports
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-sans text-lg font-semibold">Add customer</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="customer-name" className="sr-only">Name</label>
            <input id="customer-name" name="name" type="text" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded border border-slate-300 px-3 py-2" />
            <label htmlFor="customer-phone" className="sr-only">Phone</label>
            <input id="customer-phone" name="phone" type="tel" placeholder="Phone *" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full rounded border border-slate-300 px-3 py-2" />
            <label htmlFor="customer-address" className="sr-only">Address</label>
            <textarea id="customer-address" name="address" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full rounded border border-slate-300 px-3 py-2" />
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-tufts-blue py-2 font-medium text-white disabled:opacity-50">Add customer</button>
          </form>
        </section>
        <section>
          <h2 className="mb-3 font-sans text-lg font-semibold">Customer list</h2>
          <ul className="space-y-2">
            {customers.map((c) => (
              <li key={c.id} className="rounded border border-slate-200 bg-white p-3">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-600">{c.phone}</p>
                {c.address && <p className="text-sm text-slate-500">{c.address}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
