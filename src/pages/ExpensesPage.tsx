import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { getTodayInAppTz } from '@/lib/appTimezone';
import { format } from 'date-fns';

interface ExpenseDoc {
  id: string;
  date: string;
  itemBought: string;
  purpose: string;
  amount: number;
  paidBy: string;
  receiptAttached: boolean;
  paidByWho: string;
  notes?: string;
}

export default function ExpensesPage() {
  const db = useRxDB();
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [itemBought, setItemBought] = useState('');
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [paidByWho, setPaidByWho] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => getTodayInAppTz());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const sub = db.expenses.find().$.subscribe((docs) => {
      setExpenses(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted)
          .sort((a, b) => (b.date > a.date ? 1 : -1))
          .map((d) => ({
              id: d.id,
              date: d.date,
              itemBought: d.itemBought,
              purpose: d.purpose,
              amount: d.amount,
              paidBy: d.paidBy,
              receiptAttached: d.receiptAttached,
              paidByWho: d.paidByWho,
              notes: d.notes,
            }))
        );
      });
    return () => sub.unsubscribe();
  }, [db]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      setMessage('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.expenses.insert({
        id,
        date,
        itemBought: itemBought.trim() || 'Misc',
        purpose: purpose.trim() || 'General',
        amount: num,
        paidBy: paidBy.trim() || 'Cash',
        receiptAttached: false,
        paidByWho: paidByWho.trim() || 'Staff',
        notes: notes.trim() || undefined,
      });
      setItemBought('');
      setPurpose('');
      setAmount('');
      setPaidBy('');
      setPaidByWho('');
      setNotes('');
      setDate(getTodayInAppTz());
      setMessage('Expense added.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading database…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black">Expenses</h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">← Dashboard</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-heading text-lg font-semibold text-smoky-black">Add expense</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base w-full" />
              <p className="mt-0.5 text-xs text-slate-500">Use a past date to record historical expenses (e.g. January)</p>
            </div>
            <input type="text" placeholder="Item bought" value={itemBought} onChange={(e) => setItemBought(e.target.value)} className="input-base" />
            <input type="text" placeholder="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input-base" />
            <input type="number" placeholder="Amount (UGX)" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" step="1" className="input-base" />
            <input type="text" placeholder="Paid by (e.g. Cash, Mobile Money)" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="input-base" />
            <input type="text" placeholder="Paid by who" value={paidByWho} onChange={(e) => setPaidByWho(e.target.value)} className="input-base" />
            <input type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base" />
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Add expense'}
            </button>
          </form>
          {message && (
            <p className={`mt-2 text-sm ${message === 'Expense added.' ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="mb-3 border-b border-slate-200/80 bg-slate-50/50 px-5 py-4 font-heading text-lg font-semibold text-smoky-black">Recent expenses</h2>
          <div className="max-h-[70vh] overflow-y-auto">
            {expenses.length === 0 ? (
              <p className="p-4 text-center text-slate-500">No expenses yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-slate-50/50">
                    <div>
                      <p className="font-medium">{e.itemBought}</p>
                      <p className="text-sm text-slate-600">
                        {e.purpose} · {format(new Date(e.date), 'dd MMM yyyy')} · {e.paidBy}
                      </p>
                    </div>
                    <span className="font-medium text-red-700">{formatUGX(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
