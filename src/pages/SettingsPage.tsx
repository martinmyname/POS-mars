import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSettings, setSettings, type StoreSettings } from '@/lib/settings';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Building2, MapPin, Phone, Mail, User as UserIcon, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [s, setS] = useState<StoreSettings>(getSettings());
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    setS(getSettings());
  }, []);

  useEffect(() => {
    if (user?.user_metadata?.full_name != null) setDisplayName(String(user.user_metadata.full_name));
    else if (user?.user_metadata?.display_name != null) setDisplayName(String(user.user_metadata.display_name));
    else setDisplayName('');
  }, [user]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      await supabase.auth.updateUser({ data: { full_name: displayName.trim() || undefined } });
      setProfileMessage('Profile updated.');
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-smoky-black">Settings</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>
      <p className="text-slate-600">
        Manage your account and business details. Business info appears on receipts.
      </p>

      {/* User profile */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
          <UserIcon className="h-5 w-5 text-tufts-blue" />
          User profile
        </h2>
        <form onSubmit={handleSaveProfile} className="max-w-md space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={user?.email ?? ''}
              readOnly
              className="input-base w-full bg-slate-50 text-slate-600"
              aria-readonly
            />
            <p className="mt-1 text-xs text-slate-500">Sign in email (cannot be changed here)</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="input-base w-full"
            />
            <p className="mt-1 text-xs text-slate-500">Shown where your name is used (e.g. cash drawer opened by)</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={profileSaving} className="btn-primary disabled:opacity-50">
              {profileSaving ? 'Saving…' : 'Save profile'}
            </button>
            {profileMessage && (
              <span className={`text-sm ${profileMessage.startsWith('Profile') ? 'text-emerald-600' : 'text-red-600'}`}>
                {profileMessage}
              </span>
            )}
          </div>
        </form>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </section>

      <form onSubmit={handleSave} className="max-w-lg space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            <Building2 className="h-5 w-5 text-tufts-blue" />
            Business information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Business name</label>
              <input
                type="text"
                value={s.businessName}
                onChange={(e) => setS((p) => ({ ...p, businessName: e.target.value }))}
                placeholder="Mars Kitchen Essentials"
                className="input-base w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                <MapPin className="mr-1 inline h-4 w-4" /> Location / Address
              </label>
              <textarea
                value={s.address}
                onChange={(e) => setS((p) => ({ ...p, address: e.target.value }))}
                rows={2}
                placeholder="e.g. Kikuubo Skylight Arcade L2-43"
                className="input-base w-full resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Logo URL (optional)</label>
              <input
                type="url"
                value={s.logoUrl}
                onChange={(e) => setS((p) => ({ ...p, logoUrl: e.target.value }))}
                placeholder="https://..."
                className="input-base w-full"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            <Phone className="h-5 w-5 text-tufts-blue" />
            Contact (receipts & share)
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Phone is shown as Call / WhatsApp; email is shown for enquiries. Both appear on printed and shared receipts.
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone (Call / WhatsApp)</label>
              <input
                type="tel"
                value={s.phone ?? ''}
                onChange={(e) => setS((p) => ({ ...p, phone: e.target.value || undefined }))}
                placeholder="0703666646"
                className="input-base w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                <Mail className="mr-1 inline h-4 w-4" /> Email
              </label>
              <input
                type="email"
                value={s.email ?? ''}
                onChange={(e) => setS((p) => ({ ...p, email: e.target.value || undefined }))}
                placeholder="info@marskitchenessentials.com"
                className="input-base w-full"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            Save settings
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
