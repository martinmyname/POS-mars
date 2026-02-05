import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';

export default function CustomersPage() {
  const db = useRxDB();
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone: string; email?: string; address?: string }>>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db) return;
    const sub = db.customers.find().$.subscribe((docs) => {
      setCustomers(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted)
          .map((d) => ({ id: d.id, name: d.name, phone: d.phone, email: d.email, address: d.address }))
      );
    });
    return () => sub.unsubscribe();
  }, [db]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.customers.insert({
        id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
    } finally {
      setSaving(false);
    }
  };

  if (!db) return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>;

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
            <input type="text" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded border border-slate-300 px-3 py-2" />
            <input type="tel" placeholder="Phone *" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full rounded border border-slate-300 px-3 py-2" />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            <textarea placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full rounded border border-slate-300 px-3 py-2" />
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-tufts-blue py-2 font-medium text-white disabled:opacity-50">Add customer</button>
          </form>
        </section>
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">Customer list</h2>
          <ul className="space-y-2">
            {customers.map((c) => (
              <li key={c.id} className="rounded border border-slate-200 bg-white p-3">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-600">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                {c.address && <p className="text-sm text-slate-500">{c.address}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
