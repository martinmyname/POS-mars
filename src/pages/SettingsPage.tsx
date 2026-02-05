import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSettings, setSettings, type StoreSettings } from '@/lib/settings';

export default function SettingsPage() {
  const [s, setS] = useState<StoreSettings>(getSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setS(getSettings());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-smoky-black">Settings</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>
      <p className="text-slate-600">Customize receipt branding (logo, business name, address).</p>
      <form onSubmit={handleSave} className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Business name</label>
          <input
            type="text"
            value={s.businessName}
            onChange={(e) => setS((p) => ({ ...p, businessName: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Address</label>
          <textarea
            value={s.address}
            onChange={(e) => setS((p) => ({ ...p, address: e.target.value }))}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Logo URL (optional)</label>
          <input
            type="url"
            value={s.logoUrl}
            onChange={(e) => setS((p) => ({ ...p, logoUrl: e.target.value }))}
            placeholder="https://..."
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Phone (optional)</label>
          <input
            type="text"
            value={s.phone ?? ''}
            onChange={(e) => setS((p) => ({ ...p, phone: e.target.value || undefined }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email (optional)</label>
          <input
            type="email"
            value={s.email ?? ''}
            onChange={(e) => setS((p) => ({ ...p, email: e.target.value || undefined }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <button type="submit" className="rounded-lg bg-tufts-blue px-4 py-2 font-medium text-white">
          Save
        </button>
        {saved && <p className="text-sm text-green-600">Saved.</p>}
      </form>
    </div>
  );
}
