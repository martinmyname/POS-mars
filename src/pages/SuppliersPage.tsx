import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { useSuppliers, useSupplierLedger, suppliersApi, supplierLedgerApi, generateId } from '@/hooks/useData';
import { formatUGX } from '@/lib/formatUGX';
import { Money } from '@/components/Money';
import { formatUGXShort } from '@/utils/formatUtils';
import { StatCardXL } from '@/components/cards/StatCardXL';
import { StatCardMD } from '@/components/cards/StatCardMD';
import { StatCardSM } from '@/components/cards/StatCardSM';
import { getTodayInAppTz } from '@/lib/appTimezone';
import { exportToCSV } from '@/utils/exportUtils';
import {
  Truck,
  PlusCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';

type LedgerEntry = {
  id: string;
  supplierId: string;
  type: 'credit' | 'payment';
  amount: number;
  date: string;
  dueDate?: string;
  note?: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** YYYY-MM-DD for today + N days in app timezone. */
function addDaysToToday(days: number): string {
  const today = getTodayInAppTz();
  const [y, m, d] = today.split('-').map(Number);
  const d2 = addDays(new Date(y, m - 1, d), days);
  return format(d2, 'yyyy-MM-dd');
}

/** Sparkline: running balance from oldest to newest (last 8–10 points). */
function Sparkline({ points, owing }: { points: number[]; owing: boolean }) {
  if (points.length < 2) return null;
  const w = 80;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 2;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - 2 * pad));
  const ys = points.map((v) => h - pad - ((v - min) / range) * (h - 2 * pad));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  const stroke = owing ? '#b45309' : '#15803d';
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SuppliersPage() {
  useTheme();
  const { data: suppliersList, loading, refetch: refetchSuppliers } = useSuppliers({ realtime: true });
  const { data: ledgerList, refetch: refetchLedger } = useSupplierLedger({ realtime: true });

  type SupplierRow = {
    id: string;
    name: string;
    contact?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  };
  const suppliers = useMemo<SupplierRow[]>(
    () =>
      suppliersList.map((d) => ({
        id: d.id,
        name: d.name,
        contact: d.contact,
        phone: d.phone,
        email: d.email,
        address: d.address,
        notes: d.notes,
      })),
    [suppliersList]
  );
  const ledger = useMemo(
    () =>
      ledgerList.map((d) => ({
        id: d.id,
        supplierId: d.supplierId,
        type: d.type as 'credit' | 'payment',
        amount: d.amount,
        date: d.date,
        dueDate: d.dueDate,
        note: d.note,
      })),
    [ledgerList]
  );

  const todayStr = getTodayInAppTz();
  const todayPlus7 = addDaysToToday(7);

  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of suppliers) map[s.id] = 0;
    for (const e of ledger) {
      if (e.type === 'credit') map[e.supplierId] = (map[e.supplierId] ?? 0) + e.amount;
      else map[e.supplierId] = (map[e.supplierId] ?? 0) - e.amount;
    }
    return map;
  }, [suppliers, ledger]);

  const ledgerBySupplier = useMemo(() => {
    const map: Record<string, LedgerEntry[]> = {};
    for (const e of ledger) {
      if (!map[e.supplierId]) map[e.supplierId] = [];
      map[e.supplierId].push(e);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [ledger]);

  /** Credit entries only, for overdue / due-soon. */
  const creditEntriesBySupplier = useMemo(() => {
    const map: Record<string, LedgerEntry[]> = {};
    for (const e of ledger) {
      if (e.type !== 'credit') continue;
      if (!map[e.supplierId]) map[e.supplierId] = [];
      map[e.supplierId].push(e);
    }
    return map;
  }, [ledger]);

  const totalOwed = useMemo(
    () => Object.values(balances).reduce((sum, b) => sum + (b > 0 ? b : 0), 0),
    [balances]
  );
  const suppliersWithBalance = useMemo(
    () => Object.entries(balances).filter(([, b]) => b > 0).length,
    [balances]
  );
  const settledCount = useMemo(
    () => Object.entries(balances).filter(([, b]) => b <= 0).length,
    [balances]
  );

  const overdueCount = useMemo(() => {
    let n = 0;
    for (const [supplierId, entries] of Object.entries(creditEntriesBySupplier)) {
      const balance = balances[supplierId] ?? 0;
      if (balance <= 0) continue;
      n += entries.filter((e) => e.dueDate && e.dueDate < todayStr).length;
    }
    return n;
  }, [creditEntriesBySupplier, balances, todayStr]);

  const dueWithin7Count = useMemo(() => {
    let n = 0;
    for (const [supplierId, entries] of Object.entries(creditEntriesBySupplier)) {
      const balance = balances[supplierId] ?? 0;
      if (balance <= 0) continue;
      const hasOverdue = entries.some((e) => e.dueDate && e.dueDate < todayStr);
      if (hasOverdue) continue;
      n += entries.filter(
        (e) => e.dueDate && e.dueDate >= todayStr && e.dueDate <= todayPlus7
      ).length;
    }
    return n;
  }, [creditEntriesBySupplier, balances, todayStr, todayPlus7]);

  type FilterTab = 'all' | 'owing' | 'overdue' | 'settled';
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const filteredAndSortedSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = suppliers.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.contact ?? '').toLowerCase().includes(q)
    );
    const hasOverdue = (sid: string) => {
      const balance = balances[sid] ?? 0;
      if (balance <= 0) return false;
      const entries = creditEntriesBySupplier[sid] ?? [];
      return entries.some((e) => e.dueDate && e.dueDate < todayStr);
    };
    if (filterTab === 'owing') list = list.filter((s) => (balances[s.id] ?? 0) > 0);
    else if (filterTab === 'overdue') list = list.filter((s) => hasOverdue(s.id));
    else if (filterTab === 'settled') list = list.filter((s) => (balances[s.id] ?? 0) <= 0);
    list.sort((a, b) => {
      const balA = balances[a.id] ?? 0;
      const balB = balances[b.id] ?? 0;
      const overA = hasOverdue(a.id) ? 1 : 0;
      const overB = hasOverdue(b.id) ? 1 : 0;
      if (overB !== overA) return overB - overA;
      if (balB !== balA) return balB - balA;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [suppliers, search, filterTab, balances, creditEntriesBySupplier, todayStr]);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const [activeForm, setActiveForm] = useState<{ supplierId: string; type: 'credit' | 'payment' } | null>(null);
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDate, setLedgerDate] = useState(todayISO());
  const [ledgerDueDate, setLedgerDueDate] = useState('');
  const [ledgerNote, setLedgerNote] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [ledgerAmountError, setLedgerAmountError] = useState<string | null>(null);

  const duplicateName = useMemo(() => {
    if (!name.trim()) return null;
    const found = suppliers.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
    return found ? found.name : null;
  }, [suppliers, name]);

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    if (!name.trim()) {
      setNameError('Name is required.');
      return;
    }
    setSaving(true);
    setAddSuccess(false);
    try {
      await suppliersApi.insert({
        id: `sup_${generateId()}`,
        name: name.trim(),
        contact: contact.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      await refetchSuppliers();
      setName('');
      setContact('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm || !ledgerAmount.trim()) return;
    const amount = parseFloat(ledgerAmount.replace(/,/g, ''));
    if (Number.isNaN(amount) || amount <= 0) {
      setLedgerAmountError('Amount must be greater than 0');
      return;
    }
    setLedgerAmountError(null);
    setSaving(true);
    try {
      await supplierLedgerApi.insert({
        id: `ledger_${generateId()}`,
        supplierId: activeForm.supplierId,
        type: activeForm.type,
        amount,
        date: ledgerDate,
        dueDate: activeForm.type === 'credit' && ledgerDueDate.trim() ? ledgerDueDate : undefined,
        note: ledgerNote.trim() || undefined,
      });
      await refetchLedger();
      setActiveForm(null);
      setLedgerAmount('');
      setLedgerDate(todayISO());
      setLedgerDueDate('');
      setLedgerNote('');
    } finally {
      setSaving(false);
    }
  };

  const openForm = (supplierId: string, type: 'credit' | 'payment') => {
    setExpandedSupplier(supplierId);
    const current = activeForm?.supplierId === supplierId && activeForm?.type === type ? null : { supplierId, type };
    setActiveForm(current);
    if (current) {
      setLedgerAmount('');
      setLedgerDate(todayISO());
      setLedgerDueDate('');
      setLedgerNote('');
      setLedgerAmountError(null);
    }
  };

  const handleExportLedger = (supplierName: string, supplierId: string) => {
    const entries = (ledgerBySupplier[supplierId] ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const rows = entries.map((e) => {
      if (e.type === 'credit') running += e.amount;
      else running -= e.amount;
      return [
        e.date ? format(parseISO(e.date), 'dd MMM yyyy') : e.date,
        e.type === 'credit' ? 'Credit' : 'Payment',
        e.note ?? '—',
        e.dueDate ?? '',
        e.type === 'credit' ? `+${formatUGX(e.amount)}` : `−${formatUGX(e.amount)}`,
        formatUGX(running),
      ];
    });
    rows.reverse();
    const headers = ['Date', 'Type', 'Note', 'Pay By', 'Amount', 'Running Balance'];
    const safeName = supplierName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'supplier';
    exportToCSV(`${safeName}_ledger`, headers, rows);
  };

  if (loading)
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>
    );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Suppliers</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>

      {/* Summary cards — Total owed, Overdue, Due soon, Total suppliers */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="min-w-0">
          <StatCardXL
            label="Total owed to suppliers"
            value={formatUGXShort(totalOwed)}
            fullValue={formatUGX(totalOwed)}
            sub={`${suppliersWithBalance} suppliers with open balance`}
          />
        </div>
        <div className="min-w-0">
          <StatCardMD
            label="Overdue payments"
            value={overdueCount.toString()}
            sub={
              overdueCount > 0
                ? `${overdueCount} past pay-by date`
                : 'All payments on time'
            }
          />
        </div>
        <div className="min-w-0">
          <StatCardMD
            label="Due within 7 days"
            value={dueWithin7Count.toString()}
            sub={
              dueWithin7Count > 0
                ? 'Act soon to avoid overdue'
                : 'Nothing due soon'
            }
          />
        </div>
        <div className="min-w-0">
          <StatCardSM
            label="Total suppliers"
            value={suppliers.length.toString()}
            fullValue={`${suppliersWithBalance} active, ${settledCount} settled`}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 lg:gap-6">
        {/* Task 10 — Add supplier form */}
        <section className="card p-4 order-last lg:order-first">
          <h2 className="mb-3 font-sans text-title3 font-semibold">Add supplier</h2>
          {addSuccess && (
            <p className="mb-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ Supplier added</p>
          )}
          <form onSubmit={handleSubmitSupplier} className="space-y-3">
            <div>
              <label htmlFor="supplier-name" className="sr-only">Supplier name</label>
              <input
                id="supplier-name"
                name="supplier_name"
                type="text"
                placeholder="Supplier name *"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                className={`input-base w-full ${nameError ? 'border-red-500' : ''}`}
              />
              {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
            </div>
            <div>
              <label htmlFor="supplier-contact" className="sr-only">Contact person</label>
              <input
                id="supplier-contact"
                name="contact"
                type="text"
                placeholder="Contact person"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="input-base w-full"
              />
            </div>
            <div>
              <label htmlFor="supplier-phone" className="sr-only">Phone</label>
              <input
                id="supplier-phone"
                name="phone"
                type="tel"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-base w-full"
              />
            </div>
            <div>
              <label htmlFor="supplier-email" className="sr-only">Email</label>
              <input
                id="supplier-email"
                name="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-base w-full"
              />
            </div>
            <div>
              <label htmlFor="supplier-address" className="sr-only">Address</label>
              <textarea
                id="supplier-address"
                name="address"
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="input-base w-full"
              />
            </div>
            <div>
              <label htmlFor="supplier-notes" className="sr-only">Notes</label>
              <textarea
                id="supplier-notes"
                name="notes"
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="input-base w-full"
              />
            </div>
            {duplicateName && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                A supplier named {duplicateName} already exists.
              </p>
            )}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              Add supplier
            </button>
          </form>
        </section>

        <section>
          {/* Task 2 — Search & filter */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Search suppliers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base max-w-[220px] py-2 text-sm"
              aria-label="Search suppliers"
            />
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600" role="tablist">
              {(['all', 'owing', 'overdue', 'settled'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={filterTab === tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize first:rounded-l-lg last:rounded-r-lg ${
                    filterTab === tab
                      ? 'bg-tufts-blue text-white dark:bg-tufts-blue'
                      : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'owing' ? 'Owing' : tab === 'overdue' ? 'Overdue' : 'Settled'}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              {filteredAndSortedSuppliers.length} suppliers
            </span>
          </div>

          {/* Task 11 — Empty states */}
          {filteredAndSortedSuppliers.length === 0 && suppliers.length === 0 && (
            <div className="card flex flex-col items-center justify-center gap-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
              <Truck className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No suppliers yet. Add your first one using the form.
              </p>
            </div>
          )}
          {filteredAndSortedSuppliers.length === 0 && suppliers.length > 0 && search.trim() && (
            <div className="card flex flex-col items-center justify-center gap-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
              <Truck className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No suppliers match &quot;{search.trim()}&quot;.
              </p>
            </div>
          )}
          {filteredAndSortedSuppliers.length === 0 && suppliers.length > 0 && !search.trim() && (
            <div className="card flex flex-col items-center justify-center gap-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
              <Truck className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No suppliers are currently {filterTab === 'owing' ? 'owing' : filterTab === 'overdue' ? 'overdue' : 'settled'}.
              </p>
            </div>
          )}

          <ul className="space-y-3">
            {filteredAndSortedSuppliers.map((s) => {
              const balance = balances[s.id] ?? 0;
              const entries = ledgerBySupplier[s.id] ?? [];
              const credits = creditEntriesBySupplier[s.id] ?? [];
              const isExpanded = expandedSupplier === s.id;
              const formOpen = activeForm?.supplierId === s.id;
              const owing = balance > 0;
              const displayBalance = balance <= 0 ? 0 : balance;

              const hasOverdue = credits.some((e) => e.dueDate && e.dueDate < todayStr);
              const hasDueSoon =
                !hasOverdue &&
                credits.some((e) => e.dueDate && e.dueDate >= todayStr && e.dueDate <= todayPlus7);

              const sortedByDate = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
              let run = 0;
              const sparkPoints = sortedByDate.map((e) => {
                if (e.type === 'credit') run += e.amount;
                else run -= e.amount;
                return run;
              });
              const lastPoints = sparkPoints.slice(-10);

              return (
                <li key={s.id} className="card overflow-hidden p-0">
                  {/* Task 3 — Row header */}
                  <div
                    className="flex cursor-pointer items-center gap-3 p-3"
                    onClick={() => setExpandedSupplier(isExpanded ? null : s.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setExpandedSupplier(isExpanded ? null : s.id)}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                        owing ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                      }`}
                    >
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-smoky-black dark:text-white">
                        {s.name}
                        {hasOverdue && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/50 dark:text-red-200">
                            <AlertTriangle className="h-3 w-3" /> {credits.filter((e) => e.dueDate && e.dueDate < todayStr).length} Overdue
                          </span>
                        )}
                        {hasDueSoon && !hasOverdue && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                            <Clock className="h-3 w-3" /> Due Soon
                          </span>
                        )}
                      </p>
                      {(s.contact || s.phone) && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {[s.contact, s.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <Sparkline points={lastPoints} owing={owing} />
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${owing ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        <Money
                          value={displayBalance}
                          abbreviated={displayBalance >= 100_000}
                          className={owing ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}
                        />
                      </p>
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          owing ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                        }`}
                      >
                        {owing ? 'Due' : 'Settled'}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                    )}
                  </div>

                  {(isExpanded || formOpen) && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                      {/* Task 4 — Stats mini-grid */}
                      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {(() => {
                          const totalCredited = entries.filter((e) => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
                          const totalPaid = entries.filter((e) => e.type === 'payment').reduce((s, e) => s + e.amount, 0);
                          const rate = totalCredited > 0 ? (totalPaid / totalCredited) * 100 : 100;
                          return (
                            <>
                              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Total Credited</p>
                                <p className="font-semibold text-red-700 dark:text-red-300"><Money value={totalCredited} abbreviated className="font-semibold text-red-700 dark:text-red-300" /></p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Total Paid</p>
                                <p className="font-semibold text-emerald-700 dark:text-emerald-300"><Money value={totalPaid} abbreviated className="font-semibold text-emerald-700 dark:text-emerald-300" /></p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Payment Rate</p>
                                <p
                                  className={`font-semibold ${
                                    rate >= 80 ? 'text-emerald-700 dark:text-emerald-300' : rate >= 50 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
                                  }`}
                                >
                                  {rate.toFixed(0)}%
                                </p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Transactions</p>
                                <p className="font-semibold text-slate-700 dark:text-slate-300">{entries.length}</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Task 5 — Credit aging bar */}
                      {credits.length > 0 && (() => {
                        const now = new Date();
                        const bucket30 = credits.filter((e) => {
                          const d = e.date ? parseISO(e.date) : now;
                          const days = differenceInDays(now, d);
                          return days <= 30;
                        }).reduce((s, e) => s + e.amount, 0);
                        const bucket60 = credits.filter((e) => {
                          const d = e.date ? parseISO(e.date) : now;
                          const days = differenceInDays(now, d);
                          return days > 30 && days <= 60;
                        }).reduce((s, e) => s + e.amount, 0);
                        const bucket61 = credits.filter((e) => {
                          const d = e.date ? parseISO(e.date) : now;
                          const days = differenceInDays(now, d);
                          return days > 60;
                        }).reduce((s, e) => s + e.amount, 0);
                        const total = bucket30 + bucket60 + bucket61 || 1;
                        const w30 = (bucket30 / total) * 100;
                        const w60 = (bucket60 / total) * 100;
                        const w61 = (bucket61 / total) * 100;
                        const parts: { w: number; color: string }[] = [];
                        if (w30 > 0) parts.push({ w: w30, color: 'bg-emerald-500' });
                        if (w60 > 0) parts.push({ w: w60, color: 'bg-amber-500' });
                        if (w61 > 0) parts.push({ w: w61, color: 'bg-red-500' });
                        return (
                          <div className="mb-4">
                            <div className="mb-1 flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
                              {parts.map((p, i) => (
                                <div
                                  key={i}
                                  className={`${p.color} shrink-0`}
                                  style={{ width: `${p.w}%` }}
                                />
                              ))}
                            </div>
                            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                              {bucket30 > 0 && <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> 0–30d: <Money value={bucket30} abbreviated className="text-slate-600 dark:text-slate-400" /></span>}
                              {bucket60 > 0 && <span><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> 31–60d: <Money value={bucket60} abbreviated className="text-slate-600 dark:text-slate-400" /></span>}
                              {bucket61 > 0 && <span><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> 61d+: <Money value={bucket61} abbreviated className="text-slate-600 dark:text-slate-400" /></span>}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Task 6 — Overdue alert banner */}
                      {owing && (() => {
                        const overdueEntries = credits.filter((e) => e.dueDate && e.dueDate < todayStr);
                        if (overdueEntries.length === 0) return null;
                        return (
                          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/40">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              {overdueEntries.length} credit{overdueEntries.length !== 1 ? 's' : ''} past pay-by date —{' '}
                              {overdueEntries
                                .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
                                .map((e) => `${formatUGX(e.amount)} (due ${e.dueDate ? format(parseISO(e.dueDate), 'dd MMM yyyy') : ''})`)
                                .join(', ')}
                            </p>
                            <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">
                              Amount still owed (after payments): <Money value={balance} className="text-red-700 dark:text-red-300" />
                            </p>
                          </div>
                        );
                      })()}

                      {/* Task 7 — Inline credit & payment forms */}
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openForm(s.id, 'credit'); }}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                            activeForm?.supplierId === s.id && activeForm?.type === 'credit'
                              ? 'bg-amber-600 text-white dark:bg-amber-600'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-800/50'
                          }`}
                        >
                          <PlusCircle className="h-4 w-4" /> Record Credit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openForm(s.id, 'payment'); }}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                            activeForm?.supplierId === s.id && activeForm?.type === 'payment'
                              ? 'bg-tufts-blue text-white dark:bg-tufts-blue'
                              : 'btn-secondary'
                          }`}
                        >
                          <MinusCircle className="h-4 w-4" /> Record Payment
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleExportLedger(s.name, s.id); }}
                          className="btn-secondary ml-auto inline-flex items-center gap-1.5 text-sm"
                        >
                          <Download className="h-4 w-4" /> Export CSV
                        </button>
                      </div>

                      {formOpen && activeForm?.supplierId === s.id && (
                        <form onSubmit={handleRecordLedger} className="mb-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
                          <h3 className="mb-2 font-medium dark:text-slate-100">
                            {activeForm.type === 'credit' ? 'Record credit (we owe this)' : 'Record payment'}
                          </h3>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <label htmlFor="ledger-amount" className="sr-only">Amount (UGX)</label>
                              <input
                                id="ledger-amount"
                                name="amount"
                                type="text"
                                placeholder="Amount (UGX)"
                                value={ledgerAmount}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/,/g, '');
                                  setLedgerAmount(val);
                                  if (!val.trim()) setLedgerAmountError(null);
                                  else {
                                    const num = parseFloat(val);
                                    setLedgerAmountError(Number.isNaN(num) || num <= 0 ? 'Amount must be greater than 0' : null);
                                  }
                                }}
                                className={`input-base ${ledgerAmountError ? 'border-red-500' : ''}`}
                              />
                              {ledgerAmountError && <p className="mt-1 text-xs text-red-600">{ledgerAmountError}</p>}
                            </div>
                            <div>
                              <label htmlFor="ledger-date" className="sr-only">Date</label>
                              <input
                                id="ledger-date"
                                name="date"
                                type="date"
                                value={ledgerDate}
                                onChange={(e) => setLedgerDate(e.target.value)}
                                className="input-base"
                              />
                            </div>
                            {activeForm.type === 'credit' && (
                              <div className="sm:col-span-2">
                                <label htmlFor="ledger-pay-by" className="mb-1 block text-xs text-slate-500">Pay by date (optional)</label>
                                <input
                                  id="ledger-pay-by"
                                  name="pay_by_date"
                                  type="date"
                                  value={ledgerDueDate}
                                  onChange={(e) => setLedgerDueDate(e.target.value)}
                                  className="input-base"
                                />
                              </div>
                            )}
                            <div className="sm:col-span-2">
                              <label htmlFor="ledger-note" className="sr-only">Note</label>
                              <input
                                id="ledger-note"
                                name="note"
                                type="text"
                                placeholder="Note"
                                value={ledgerNote}
                                onChange={(e) => setLedgerNote(e.target.value)}
                                className="input-base"
                              />
                            </div>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button type="submit" disabled={saving || !!ledgerAmountError} className="btn-primary flex-1">
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                setActiveForm(null);
                                setLedgerAmount('');
                                setLedgerAmountError(null);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Task 8 — Ledger history table */}
                      <div>
                        <p className="mb-2 font-medium text-slate-700 dark:text-slate-300">Ledger history</p>
                        {entries.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center dark:border-slate-600">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              No entries yet. Record a credit or payment above.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50">
                                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Date</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Type</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Note</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Pay By</th>
                                  <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Amount</th>
                                  <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Running Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const sorted = entries.slice().sort((a, b) => b.date.localeCompare(a.date));
                                  let running = 0;
                                  const withRunning = sorted.map((e) => {
                                    if (e.type === 'credit') running += e.amount;
                                    else running -= e.amount;
                                    return { ...e, running };
                                  });
                                  const oldestFirst = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
                                  let run = 0;
                                  const runMap: Record<string, number> = {};
                                  for (const e of oldestFirst) {
                                    if (e.type === 'credit') run += e.amount;
                                    else run -= e.amount;
                                    runMap[e.id] = run;
                                  }
                                  return withRunning.map((e, i) => {
                                    const rb = runMap[e.id] ?? 0;
                                    const isOverdue = e.type === 'credit' && e.dueDate && e.dueDate < todayStr;
                                    const dueSoon = e.type === 'credit' && e.dueDate && e.dueDate >= todayStr && e.dueDate <= todayPlus7 && !isOverdue;
                                    const daysOverdue = e.dueDate && e.dueDate < todayStr ? differenceInDays(parseISO(todayStr), parseISO(e.dueDate)) : 0;
                                    const daysUntil = e.dueDate && e.dueDate >= todayStr ? differenceInDays(parseISO(e.dueDate), parseISO(todayStr)) : null;
                                    return (
                                      <tr
                                        key={e.id}
                                        className={`border-b border-slate-100 dark:border-slate-700 ${
                                          i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''
                                        } ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                                      >
                                        <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">
                                          {e.date ? format(parseISO(e.date), 'dd MMM yyyy') : '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span
                                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                                              e.type === 'credit'
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                                            }`}
                                          >
                                            {e.type === 'credit' ? 'Credit' : 'Payment'}
                                          </span>
                                        </td>
                                        <td className="max-w-[120px] truncate px-3 py-2 text-slate-600 dark:text-slate-400" title={e.note ?? ''}>
                                          {e.note || '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                          {e.dueDate ? (
                                            isOverdue ? (
                                              <span className="text-red-700 dark:text-red-300">
                                                <AlertTriangle className="inline h-3 w-3" /> ({daysOverdue} days ago)
                                              </span>
                                            ) : dueSoon && daysUntil !== null ? (
                                              <span className="text-amber-700 dark:text-amber-300">
                                                <Clock className="inline h-3 w-3" /> (in {daysUntil} days)
                                              </span>
                                            ) : (
                                              <span className="text-slate-500 dark:text-slate-400">
                                                {format(parseISO(e.dueDate), 'dd MMM yyyy')}
                                              </span>
                                            )
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                                          {e.type === 'credit' ? (
                                            <span className="text-red-700 dark:text-red-300">+<Money value={e.amount} className="text-red-700 dark:text-red-300" /></span>
                                          ) : (
                                            <span className="text-emerald-700 dark:text-emerald-300">−<Money value={e.amount} className="text-emerald-700 dark:text-emerald-300" /></span>
                                          )}
                                        </td>
                                        <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${rb > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                          <Money value={rb} className={rb > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'} />
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Task 12 — Link to Reports */}
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/reports" className="underline hover:text-tufts-blue">
              📊 Supplier payments are shown in the cash flow section of Reports →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
