import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSuppliers, useSupplierLedger, suppliersApi, supplierLedgerApi, generateId } from '@/hooks/useData';
import { formatUGX } from '@/lib/formatUGX';
import { Truck, PlusCircle, MinusCircle, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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
  const { data: suppliersList, loading } = useSuppliers({ realtime: true });
  const { data: ledgerList } = useSupplierLedger({ realtime: true });
  type SupplierRow = { id: string; name: string; contact?: string; phone?: string; email?: string; address?: string; notes?: string };
  const suppliers = useMemo<SupplierRow[]>(
    () => suppliersList.map((d) => ({ id: d.id, name: d.name, contact: d.contact, phone: d.phone, email: d.email, address: d.address, notes: d.notes })),
    [suppliersList]
  );
  const ledger = useMemo(
    () => ledgerList.map((d) => ({ id: d.id, supplierId: d.supplierId, type: d.type as 'credit' | 'payment', amount: d.amount, date: d.date, dueDate: d.dueDate, note: d.note })),
    [ledgerList]
  );
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [activeForm, setActiveForm] = useState<{ supplierId: string; type: 'credit' | 'payment' } | null>(null);
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDate, setLedgerDate] = useState(todayISO());
  const [ledgerDueDate, setLedgerDueDate] = useState('');
  const [ledgerNote, setLedgerNote] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [ledgerAmountError, setLedgerAmountError] = useState<string | null>(null);

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
    if (!name.trim()) return;
    setSaving(true);
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
    if (!activeForm || !ledgerAmount.trim()) return;
    const amount = parseFloat(ledgerAmount.replace(/,/g, ''));
    if (Number.isNaN(amount) || amount <= 0) return;
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
      setActiveForm(null);
      setLedgerAmount('');
      setLedgerDate(todayISO());
      setLedgerDueDate('');
      setLedgerNote('');
      setLedgerAmountError(null);
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
    setLedgerAmountError(null);
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>;

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
            <label htmlFor="supplier-name" className="sr-only">Supplier name</label>
            <input
              id="supplier-name"
              name="supplier_name"
              type="text"
              placeholder="Supplier name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
            />
            <label htmlFor="supplier-contact" className="sr-only">Contact person</label>
            <input id="supplier-contact" name="contact" type="text" placeholder="Contact person" value={contact} onChange={(e) => setContact(e.target.value)} className="input" />
            <label htmlFor="supplier-phone" className="sr-only">Phone</label>
            <input id="supplier-phone" name="phone" type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            <label htmlFor="supplier-email" className="sr-only">Email</label>
            <input id="supplier-email" name="email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            <label htmlFor="supplier-address" className="sr-only">Address</label>
            <textarea id="supplier-address" name="address" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="input" />
            <label htmlFor="supplier-notes" className="sr-only">Notes</label>
            <textarea id="supplier-notes" name="notes" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
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
                                  if (!val.trim()) {
                                    setLedgerAmountError(null);
                                    return;
                                  }
                                  const num = parseFloat(val);
                                  if (isNaN(num)) {
                                    setLedgerAmountError('Amount must be a number');
                                  } else if (num <= 0) {
                                    setLedgerAmountError('Amount must be greater than 0');
                                  } else {
                                    setLedgerAmountError(null);
                                  }
                                }}
                                className={`input ${ledgerAmountError ? 'border-red-300' : ''}`}
                                required
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
                                className="input"
                              />
                            </div>
                            {activeForm.type === 'credit' && (
                              <div className="sm:col-span-2">
                                <label htmlFor="ledger-pay-by-date" className="mb-1 block text-xs text-slate-500">Pay by date (leave empty for anytime)</label>
                                <input
                                  id="ledger-pay-by-date"
                                  name="pay_by_date"
                                  type="date"
                                  value={ledgerDueDate}
                                  onChange={(e) => setLedgerDueDate(e.target.value)}
                                  className="input"
                                />
                              </div>
                            )}
                            <label htmlFor="ledger-note" className="sr-only">Note</label>
                            <input
                              id="ledger-note"
                              name="note"
                              type="text"
                              placeholder="Note"
                              value={ledgerNote}
                              onChange={(e) => setLedgerNote(e.target.value)}
                              className="input sm:col-span-2"
                            />
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button type="submit" disabled={saving || !!ledgerAmountError} className="btn-primary flex-1">Save</button>
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
