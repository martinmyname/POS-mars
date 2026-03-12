import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePromotions, promotionsApi, generateId } from '@/hooks/useData';
import { Money } from '@/components/Money';
import { format } from 'date-fns';
import type { PromotionType } from '@/types';

export default function PromotionsPage() {
  const { data: promos, loading, refetch: refetchPromos } = usePromotions({ realtime: true });
  const [name, setName] = useState('');
  const [type, setType] = useState<PromotionType>('percent_off');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [minPurchase, setMinPurchase] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const val = parseFloat(value);
    if (Number.isNaN(val) || val < 0) return;
    if (type === 'percent_off' && (val > 100 || val < 0)) return;
    setSaving(true);
    try {
      await promotionsApi.insert({
        id: `promo_${generateId()}`,
        name: name.trim(),
        type,
        value: val,
        startDate,
        endDate: endDate || undefined,
        minPurchase: minPurchase ? parseFloat(minPurchase) : undefined,
        active: true,
      });
      await refetchPromos();
      setName('');
      setValue('');
      setMinPurchase('');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await promotionsApi.update(id, { active });
    await refetchPromos();
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title font-sans lg:font-serif">Promotions</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-sans text-lg font-semibold">Create promotion</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="promo-name" className="sr-only">Name</label>
            <input id="promo-name" name="name" type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded border border-slate-300 px-3 py-2" />
            <label htmlFor="promo-type" className="sr-only">Type</label>
            <select id="promo-type" name="type" value={type} onChange={(e) => setType(e.target.value as PromotionType)} className="w-full rounded border border-slate-300 px-3 py-2">
              <option value="percent_off">Percent off</option>
              <option value="amount_off">Amount off (UGX)</option>
              <option value="bogo">Buy one get one</option>
            </select>
            <label htmlFor="promo-value" className="sr-only">Value</label>
            <input id="promo-value" name="value" type="number" placeholder={type === 'percent_off' ? 'Percent (e.g. 10)' : 'Amount UGX'} value={value} onChange={(e) => setValue(e.target.value)} min="0" step={type === 'percent_off' ? 1 : 100} className="w-full rounded border border-slate-300 px-3 py-2" />
            <label htmlFor="promo-start-date" className="sr-only">Start date</label>
            <input id="promo-start-date" name="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            <label htmlFor="promo-end-date" className="sr-only">End date</label>
            <input id="promo-end-date" name="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
            <label htmlFor="promo-min-purchase" className="sr-only">Min purchase (UGX)</label>
            <input id="promo-min-purchase" name="min_purchase" type="number" placeholder="Min purchase (UGX, optional)" value={minPurchase} onChange={(e) => setMinPurchase(e.target.value)} min="0" className="w-full rounded border border-slate-300 px-3 py-2" />
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-tufts-blue py-2 font-medium text-white disabled:opacity-50">Add promotion</button>
          </form>
        </section>
        <section>
          <h2 className="mb-3 font-sans text-lg font-semibold">Active promotions</h2>
          <ul className="space-y-2">
            {promos.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded border border-slate-200 bg-white p-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-slate-600">
                    {p.type === 'percent_off' ? p.value + '% off' : <><Money value={p.value} className="text-slate-600" /> off</>}
                    {' · '}{format(new Date(p.startDate), 'dd MMM')} – {p.endDate ? format(new Date(p.endDate), 'dd MMM yyyy') : '–'}
                    {p.minPurchase != null && <> · Min <Money value={p.minPurchase} className="text-slate-600" /></>}
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
