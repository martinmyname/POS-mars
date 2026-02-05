import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { format } from 'date-fns';
import type { PromotionType } from '@/types';

export default function PromotionsPage() {
  const db = useRxDB();
  const [promos, setPromos] = useState<Array<{ id: string; name: string; type: string; value: number; startDate: string; endDate: string; minPurchase?: number; active: boolean }>>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<PromotionType>('percent_off');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [minPurchase, setMinPurchase] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db) return;
    const sub = db.promotions.find().$.subscribe((docs) => {
      setPromos(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted)
          .map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            value: d.value,
            startDate: d.startDate,
            endDate: d.endDate,
            minPurchase: d.minPurchase,
            active: d.active,
          }))
      );
    });
    return () => sub.unsubscribe();
  }, [db]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !name.trim()) return;
    const val = parseFloat(value);
    if (Number.isNaN(val) || val < 0) return;
    if (type === 'percent_off' && (val > 100 || val < 0)) return;
    setSaving(true);
    try {
      const id = `promo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.promotions.insert({
        id,
        name: name.trim(),
        type,
        value: val,
        productIds: [],
        categoryIds: [],
        startDate,
        endDate,
        minPurchase: minPurchase ? parseFloat(minPurchase) : undefined,
        active: true,
      });
      setName('');
      setValue('');
      setMinPurchase('');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    if (!db) return;
    const doc = await db.promotions.findOne(id).exec();
    if (doc) await doc.patch({ active });
  };

  if (!db) return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-smoky-black">Promotions</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold">Create promotion</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded border border-slate-300 px-3 py-2" />
            <select value={type} onChange={(e) => setType(e.target.value as PromotionType)} className="w-full rounded border border-slate-300 px-3 py-2">
              <option value="percent_off">Percent off</option>
              <option value="amount_off">Amount off (UGX)</option>
              <option value="bogo">Buy one get one</option>
            </select>
            <input type="number" placeholder={type === 'percent_off' ? 'Percent (e.g. 10)' : 'Amount UGX'} value={value} onChange={(e) => setValue(e.target.value)} min="0" step={type === 'percent_off' ? 1 : 100} className="w-full rounded border border-slate-300 px-3 py-2" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            <input type="number" placeholder="Min purchase (UGX, optional)" value={minPurchase} onChange={(e) => setMinPurchase(e.target.value)} min="0" className="w-full rounded border border-slate-300 px-3 py-2" />
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-tufts-blue py-2 font-medium text-white disabled:opacity-50">Add promotion</button>
          </form>
        </section>
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">Active promotions</h2>
          <ul className="space-y-2">
            {promos.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded border border-slate-200 bg-white p-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-slate-600">
                    {p.type === 'percent_off' ? p.value + '% off' : formatUGX(p.value) + ' off'}
                    {' · '}{format(new Date(p.startDate), 'dd MMM')} – {format(new Date(p.endDate), 'dd MMM yyyy')}
                    {p.minPurchase != null && ` · Min ${formatUGX(p.minPurchase)}`}
                  </p>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={p.active} onChange={() => toggleActive(p.id, !p.active)} />
                  Active
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
