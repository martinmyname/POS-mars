import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { useAuth } from '@/context/AuthContext';
import { formatUGX } from '@/lib/formatUGX';
import { format, startOfDay, isToday } from 'date-fns';
import { Lock, Unlock, TrendingUp, TrendingDown } from 'lucide-react';

interface CashSession {
  id: string;
  date: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  notes?: string;
}

export default function CashManagementPage() {
  const db = useRxDB();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [todaySession, setTodaySession] = useState<CashSession | null>(null);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [, setInventoryExpensesTick] = useState(0);

  useEffect(() => {
    if (!db) return;
    const sub = db.cash_sessions.find().$.subscribe((docs) => {
      const list = docs
        .filter((d) => !(d as { _deleted?: boolean })._deleted)
        .map((d) => ({
          id: d.id,
          date: d.date,
          openingAmount: d.openingAmount,
          closingAmount: (d as { closingAmount?: number }).closingAmount,
          expectedAmount: (d as { expectedAmount?: number }).expectedAmount,
          difference: (d as { difference?: number }).difference,
          openedAt: d.openedAt,
          closedAt: (d as { closedAt?: string }).closedAt,
          openedBy: d.openedBy,
          closedBy: (d as { closedBy?: string }).closedBy,
          notes: (d as { notes?: string }).notes,
        }))
        .sort((a, b) => (b.date > a.date ? 1 : -1));
      setSessions(list);
      
      // Find today's session
      const today = startOfDay(new Date()).toISOString().slice(0, 10);
      const todaySess = list.find((s) => s.date === today && !s.closedAt);
      setTodaySession(todaySess || null);
    });
    return () => sub.unsubscribe();
  }, [db]);

  // Calculate expected cash from orders and inventory purchases (cash)
  useEffect(() => {
    if (!db || !todaySession) return;

    const calculateExpectedCash = async () => {
      const today = startOfDay(new Date()).toISOString();
      const tomorrow = new Date(startOfDay(new Date()));
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowIso = tomorrow.toISOString();
      const todayStr = today.slice(0, 10);

      // Get all cash orders today
      const orders = await db.orders
        .find({
          selector: {
            createdAt: { $gte: today, $lt: tomorrowIso },
            paymentMethod: 'cash',
            _deleted: { $ne: true },
          },
        })
        .exec();

      const cashReceived = orders.reduce((sum, o) => sum + o.total, 0);

      // Get inventory purchases paid by cash today (deduct from expected)
      const inventoryExpenses = await db.expenses
        .find({
          selector: {
            date: todayStr,
            purpose: 'Inventory purchase',
            _deleted: { $ne: true },
          },
        })
        .exec();
      const cashOutForInventory = inventoryExpenses.reduce((sum, e) => sum + e.amount, 0);

      const expected = todaySession.openingAmount + cashReceived - cashOutForInventory;

      // Update expected amount
      const doc = await db.cash_sessions.findOne(todaySession.id).exec();
      if (doc && doc.expectedAmount !== expected) {
        await doc.patch({ expectedAmount: expected });
      }
    };

    calculateExpectedCash();
  }, [db, todaySession, inventoryExpensesTick]);

  const openCash = async () => {
    if (!db || !user) return;
    const amount = parseFloat(openingAmount.replace(/,/g, ''));
    if (Number.isNaN(amount) || amount < 0) {
      setMessage('Enter a valid opening amount');
      return;
    }
    
    const today = startOfDay(new Date()).toISOString().slice(0, 10);
    
    // Check if session already exists for today
    const existing = await db.cash_sessions
      .findOne({
        selector: {
          date: today,
          _deleted: { $ne: true },
        },
      })
      .exec();
    
    if (existing && !existing.closedAt) {
      setMessage('Cash drawer already opened for today');
      return;
    }
    
    try {
      const id = `cash_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.cash_sessions.insert({
        id,
        date: today,
        openingAmount: amount,
        openedAt: new Date().toISOString(),
        openedBy: user.email || 'Staff',
      });
      setOpeningAmount('');
      setMessage('Cash drawer opened');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to open cash drawer');
    }
  };

  const closeCash = async () => {
    if (!db || !user || !todaySession) return;
    const amount = parseFloat(closingAmount.replace(/,/g, ''));
    if (Number.isNaN(amount) || amount < 0) {
      setMessage('Enter a valid closing amount');
      return;
    }
    
    const expected = todaySession.expectedAmount ?? todaySession.openingAmount;
    const difference = amount - expected;
    
    try {
      const doc = await db.cash_sessions.findOne(todaySession.id).exec();
      if (!doc) return;
      
      await doc.patch({
        closingAmount: amount,
        expectedAmount: expected,
        difference,
        closedAt: new Date().toISOString(),
        closedBy: user?.user_metadata?.full_name || user?.email || 'Staff',
        notes: notes.trim() || undefined,
      });
      
      setClosingAmount('');
      setNotes('');
      setMessage(`Cash drawer closed. ${difference >= 0 ? 'Over' : 'Short'} by ${formatUGX(Math.abs(difference))}`);
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to close cash drawer');
    }
  };

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black">
          Cash Management
        </h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">
          ← Dashboard
        </Link>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 ${
            message.includes('opened') || message.includes('closed')
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open/Close Cash */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            {todaySession ? (
              <>
                <Lock className="h-5 w-5 text-emerald-600" />
                Cash Drawer Status
              </>
            ) : (
              <>
                <Unlock className="h-5 w-5 text-amber-600" />
                Open Cash Drawer
              </>
            )}
          </h2>

          {todaySession ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-sm text-slate-600">Opened by: {todaySession.openedBy}</p>
                <p className="text-sm text-slate-600">
                  Opened at: {format(new Date(todaySession.openedAt), 'dd MMM yyyy, HH:mm')}
                </p>
                <p className="mt-2 text-lg font-semibold text-emerald-700">
                  Opening Amount: {formatUGX(todaySession.openingAmount)}
                </p>
                {todaySession.expectedAmount !== undefined && (
                  <p className="mt-1 text-sm text-slate-600">
                    Expected Cash: {formatUGX(todaySession.expectedAmount)}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Closing Amount (UGX) *
                  </label>
                  <input
                    type="text"
                    placeholder={todaySession.expectedAmount ? formatUGX(todaySession.expectedAmount) : 'Enter amount'}
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
                  <textarea
                    placeholder="Any notes about discrepancies..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="input-base resize-none"
                  />
                </div>
                <button type="button" onClick={closeCash} className="btn-primary w-full">
                  <Lock className="mr-2 inline h-4 w-4" />
                  Close Cash Drawer
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Opening Amount (UGX) *
                </label>
                <input
                  type="text"
                  placeholder="Enter opening cash amount"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="input-base"
                />
              </div>
              <button type="button" onClick={openCash} className="btn-primary w-full">
                <Unlock className="mr-2 inline h-4 w-4" />
                Open Cash Drawer
              </button>
            </div>
          )}
        </section>

        {/* Recent Sessions */}
        <section className="card overflow-hidden">
          <div className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-3">
            <h2 className="font-heading text-lg font-semibold text-smoky-black">Recent Sessions</h2>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No cash sessions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sessions.slice(0, 10).map((s) => (
                  <li key={s.id} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-smoky-black">
                          {format(new Date(s.date), 'dd MMM yyyy')}
                          {isToday(new Date(s.date)) && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                              Today
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Opened: {formatUGX(s.openingAmount)} by {s.openedBy}
                        </p>
                        {s.closedAt && (
                          <>
                            <p className="mt-1 text-sm text-slate-600">
                              Closed: {formatUGX(s.closingAmount ?? 0)} by {s.closedBy}
                            </p>
                            {s.difference !== undefined && (
                              <p
                                className={`mt-1 flex items-center gap-1 text-sm font-medium ${
                                  s.difference >= 0 ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {s.difference >= 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : (
                                  <TrendingDown className="h-4 w-4" />
                                )}
                                {s.difference >= 0 ? 'Over' : 'Short'} by {formatUGX(Math.abs(s.difference))}
                              </p>
                            )}
                          </>
                        )}
                        {s.notes && (
                          <p className="mt-1 text-xs text-slate-500">Note: {s.notes}</p>
                        )}
                      </div>
                      {!s.closedAt && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                          Open
                        </span>
                      )}
                    </div>
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
