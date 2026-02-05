import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { Truck, PlusCircle, MinusCircle, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

type SupplierDoc = {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

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

export default function SuppliersPage() {
  const db = useRxDB();
  const [suppliers, setSuppliers] = useState<SupplierDoc[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Record credit / payment form (per supplier)
  const [activeForm, setActiveForm] = useState<{ supplierId: string; type: 'credit' | 'payment' } | null>(null);
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDate, setLedgerDate] = useState(todayISO());
  const [ledgerDueDate, setLedgerDueDate] = useState(''); // empty = anytime
  const [ledgerNote, setLedgerNote] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const subS = db.suppliers.find().$.subscribe((docs) => {
      setSuppliers(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted)
          .map((d) => ({
            id: d.id,
            name: d.name,
            contact: d.contact,
            phone: d.phone,
            email: d.email,
            address: d.address,
            notes: d.notes,
          }))
      );
    });
    const subL = db.supplier_ledger.find().$.subscribe((docs) => {
      setLedger(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted)
          .map((d) => ({
            id: d.id,
            supplierId: d.supplierId,
            type: d.type as 'credit' | 'payment',
            amount: d.amount,
            date: d.date,
            dueDate: d.dueDate,
            note: d.note,
          }))
      );
    });
    return () => {
      subS.unsubscribe();
      subL.unsubscribe();
    };
  }, [db]);

  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of suppliers) map[s.id] = 0;
    for (const e of ledger) {
      if (e.type === 'credit') map[e.supplierId] = (map[e.supplierId] ?? 0) + e.amount;
      else map[e.supplierId] = (map[e.supplierId] ?? 0) - e.amount;
    }
    return map;
  }, [suppliers, ledger]);

  const totalOwed = useMemo(() => {
    return Object.values(balances).reduce((sum, b) => sum + (b > 0 ? b : 0), 0);
  }, [balances]);

  const ledgerBySupplier = useMemo(() => {
    const map: Record<string, LedgerEntry[]> = {};
    for (const e of ledger) {
      if (!map[e.supplierId]) map[e.supplierId] = [];
      map[e.supplierId].push(e);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.date.localeCompare(a.date));
    }
    return map;
  }, [ledger]);

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !name.trim()) return;
    setSaving(true);
    try {
      const id = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.suppliers.insert({
        id,
        name: name.trim(),
        contact: contact.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setName('');
      setContact('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !activeForm || !ledgerAmount.trim()) return;
    const amount = parseFloat(ledgerAmount.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      const id = `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.supplier_ledger.insert({
        id,
        supplierId: activeForm.supplierId,
        type: activeForm.type,
        amount,
        date: ledgerDate,
        dueDate: activeForm.type === 'credit' && ledgerDueDate.trim() ? ledgerDueDate : undefined,
        note: ledgerNote.trim() || undefined,
      });
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
    setActiveForm({ supplierId, type });
    setLedgerAmount('');
    setLedgerDate(todayISO());
    setLedgerDueDate('');
    setLedgerNote('');
  };

  if (!db) return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-smoky-black">Suppliers</h1>
        <Link to="/" className="text-tufts-blue underline">← Dashboard</Link>
      </div>

      {/* Total owed summary */}
      <section className="card border-amber-200 bg-amber-50/50 p-4">
        <p className="text-sm font-medium text-slate-600">Total owed to suppliers</p>
        <p className="text-2xl font-bold text-amber-800">{formatUGX(totalOwed)}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold">Add supplier</h2>
          <form onSubmit={handleSubmitSupplier} className="space-y-3">
            <input
              type="text"
              placeholder="Supplier name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
            />
            <input type="text" placeholder="Contact person" value={contact} onChange={(e) => setContact(e.target.value)} className="input" />
            <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            <textarea placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="input" />
            <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
            <button type="submit" disabled={saving} className="btn-primary w-full">Add supplier</button>
          </form>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">Suppliers & balances</h2>
          <ul className="space-y-3">
            {suppliers.map((s) => {
              const balance = balances[s.id] ?? 0;
              const entries = ledgerBySupplier[s.id] ?? [];
              const isExpanded = expandedSupplier === s.id;
              const formOpen = activeForm?.supplierId === s.id;
              return (
                <li key={s.id} className="card overflow-hidden p-0">
                  <div
                    className="flex cursor-pointer items-start gap-3 p-3"
                    onClick={() => setExpandedSupplier(isExpanded ? null : s.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setExpandedSupplier(isExpanded ? null : s.id)}
                  >
                    <div className="rounded-lg bg-slate-100 p-2">
                      <Truck className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-smoky-black">{s.name}</p>
                      {(s.contact || s.phone) && (
                        <p className="text-sm text-slate-600">{[s.contact, s.phone].filter(Boolean).join(' · ')}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-sm font-semibold ${balance > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                          Balance: {formatUGX(balance)}
                        </span>
                        {balance > 0 && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Due</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                        onClick={(e) => { e.stopPropagation(); openForm(s.id, 'credit'); }}
                        title="Record credit from supplier"
                      >
                        <PlusCircle className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-600 hover:bg-slate-100"
                        onClick={(e) => { e.stopPropagation(); openForm(s.id, 'payment'); }}
                        title="Record payment to supplier"
                      >
                        <MinusCircle className="h-5 w-5" />
                      </button>
                      {isExpanded ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                    </div>
                  </div>

                  {(isExpanded || formOpen) && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-3">
                      {formOpen && activeForm?.supplierId === s.id && (
                        <form onSubmit={handleRecordLedger} className="mb-3 rounded border border-slate-200 bg-white p-3">
                          <h3 className="mb-2 font-medium">
                            {activeForm.type === 'credit' ? 'Record credit (we owe this)' : 'Record payment'}
                          </h3>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              placeholder="Amount (UGX)"
                              value={ledgerAmount}
                              onChange={(e) => setLedgerAmount(e.target.value)}
                              className="input"
                              required
                            />
                            <input
                              type="date"
                              value={ledgerDate}
                              onChange={(e) => setLedgerDate(e.target.value)}
                              className="input"
                            />
                            {activeForm.type === 'credit' && (
                              <div className="sm:col-span-2">
                                <label className="mb-1 block text-xs text-slate-500">Pay by date (leave empty for anytime)</label>
                                <input
                                  type="date"
                                  value={ledgerDueDate}
                                  onChange={(e) => setLedgerDueDate(e.target.value)}
                                  className="input"
                                />
                              </div>
                            )}
                            <input
                              type="text"
                              placeholder="Note"
                              value={ledgerNote}
                              onChange={(e) => setLedgerNote(e.target.value)}
                              className="input sm:col-span-2"
                            />
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button type="submit" disabled={saving} className="btn-primary flex-1">Save</button>
                            <button type="button" className="btn-secondary" onClick={() => setActiveForm(null)}>Cancel</button>
                          </div>
                        </form>
                      )}
                      <div>
                        <p className="mb-1 text-xs font-medium text-slate-500">Ledger history</p>
                        {entries.length === 0 ? (
                          <p className="text-sm text-slate-400">No credits or payments yet.</p>
                        ) : (
                          <ul className="space-y-1">
                            {entries.map((e) => (
                              <li key={e.id} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                  {e.type === 'credit' ? (
                                    <PlusCircle className="h-4 w-4 text-amber-600" />
                                  ) : (
                                    <MinusCircle className="h-4 w-4 text-slate-500" />
                                  )}
                                  <span>{e.date ? format(parseISO(e.date), 'dd MMM yyyy') : e.date}</span>
                                  {e.type === 'credit' && e.dueDate && (
                                    <span className="flex items-center gap-0.5 text-slate-500">
                                      <Calendar className="h-3 w-3" /> due {format(parseISO(e.dueDate), 'dd MMM yyyy')}
                                    </span>
                                  )}
                                  {e.note && <span className="text-slate-400">— {e.note}</span>}
                                </span>
                                <span className={e.type === 'credit' ? 'font-medium text-amber-700' : 'text-slate-600'}>
                                  {e.type === 'credit' ? '+' : '−'}{formatUGX(e.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
