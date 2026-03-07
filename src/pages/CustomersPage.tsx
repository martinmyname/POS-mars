import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomers, customersApi, generateId } from '@/hooks/useData';

export default function CustomersPage() {
  const { data: customers, loading } = useCustomers({ realtime: true });
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
        <h1 className="font-heading text-2xl font-bold text-smoky-black">Customers</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold">Add customer</h2>
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
          <h2 className="mb-3 font-heading text-lg font-semibold">Customer list</h2>
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
