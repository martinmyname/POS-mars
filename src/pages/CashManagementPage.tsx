import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { useDayBoundaryTick } from '@/hooks/useDayBoundaryTick';
import { useAuth } from '@/context/AuthContext';
import { formatUGX } from '@/lib/formatUGX';
import { getTodayInAppTz, getStartOfDayAppTzAsUTC, getEndOfDayAppTzAsUTC } from '@/lib/appTimezone';
import { format } from 'date-fns';
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
  const dayTick = useDayBoundaryTick();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [todaySession, setTodaySession] = useState<CashSession | null>(null);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [openForPastDate, setOpenForPastDate] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => getTodayInAppTz());
  const [sessionToClose, setSessionToClose] = useState<CashSession | null>(null);
  const [closeAmountForPast, setCloseAmountForPast] = useState('');
  const [closeNotesForPast, setCloseNotesForPast] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [inventoryExpensesTick, setInventoryExpensesTick] = useState(0);
  const [openingAmountError, setOpeningAmountError] = useState<string | null>(null);
  const [closingAmountError, setClosingAmountError] = useState<string | null>(null);
  const [closeAmountForPastError, setCloseAmountForPastError] = useState<string | null>(null);

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
      
      // Find today's session (Uganda/EAT)
      const today = getTodayInAppTz();
      const todaySess = list.find((s) => s.date === today && !s.closedAt);
      setTodaySession(todaySess || null);
    });
    return () => sub.unsubscribe();
  }, [db, dayTick]);

  // Re-run expected cash when today's inventory expenses change (re-subscribe when date changes)
  useEffect(() => {
    if (!db) return;
    const todayStr = getTodayInAppTz();
    const sub = db.expenses
      .find({
        selector: {
          date: todayStr,
          purpose: 'Inventory purchase',
          _deleted: { $ne: true },
        },
      })
      .$.subscribe(() => setInventoryExpensesTick((t) => t + 1));
    return () => sub.unsubscribe();
  }, [db, dayTick]);

  // Calculate expected cash from orders and inventory purchases (cash)
  useEffect(() => {
    if (!db || !todaySession) return;

    const calculateExpectedCash = async () => {
      const todayStr = getTodayInAppTz();
      const today = getStartOfDayAppTzAsUTC(todayStr).toISOString();
      const tomorrowIso = getEndOfDayAppTzAsUTC(todayStr).toISOString();

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
  }, [db, todaySession, inventoryExpensesTick, dayTick]);

  const openCash = async () => {
    if (!db || !user) return;
    if (openingAmountError) {
      setMessage('Please fix validation errors before opening cash drawer.');
      return;
    }
    const amount = parseFloat(openingAmount.replace(/,/g, ''));
    if (Number.isNaN(amount) || amount < 0) {
      setMessage('Enter a valid opening amount');
      return;
    }
    const today = getTodayInAppTz();
    const dateToUse = openForPastDate ? sessionDate : today;
    if (!dateToUse) {
      setMessage('Select a date');
      return;
    }
    const existing = await db.cash_sessions
      .findOne({ selector: { date: dateToUse, _deleted: { $ne: true } } })
      .exec();
    if (existing && !existing.closedAt) {
      setMessage(dateToUse === today ? 'Cash drawer already opened for today' : `A session for ${dateToUse} is already open`);
      return;
    }
    if (existing && existing.closedAt) {
      setMessage(`A session for ${dateToUse} already exists. Use a different date for historical data.`);
      return;
    }
    try {
      const id = `cash_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const openedAt = openForPastDate && dateToUse
        ? new Date(dateToUse + 'T08:00:00').toISOString()
        : new Date().toISOString();
      await db.cash_sessions.insert({
        id,
        date: dateToUse,
        openingAmount: amount,
        openedAt,
        openedBy: user.email || 'Staff',
      });
      setOpeningAmount('');
      setOpeningAmountError(null);
      setOpenForPastDate(false);
      setSessionDate(today);
      setMessage('Cash drawer opened' + (dateToUse !== today ? ` for ${dateToUse}` : ''));
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to open cash drawer');
    }
  };

  const closePastSession = async () => {
    if (!db || !user || !sessionToClose) return;
    if (closeAmountForPastError) {
      setMessage('Please fix validation errors before closing session.');
      return;
    }
    const amount = parseFloat(closeAmountForPast.replace(/,/g, ''));
    if (Number.isNaN(amount) || amount < 0) {
      setMessage('Enter a valid closing amount');
      return;
    }
    const expected = sessionToClose.expectedAmount ?? sessionToClose.openingAmount;
    const difference = amount - expected;
    try {
      const doc = await db.cash_sessions.findOne(sessionToClose.id).exec();
      if (!doc) return;
      await doc.patch({
        closingAmount: amount,
        expectedAmount: expected,
        difference,
        closedAt: new Date().toISOString(),
        closedBy: user?.user_metadata?.full_name || user?.email || 'Staff',
        notes: closeNotesForPast.trim() || undefined,
      });
      setSessionToClose(null);
      setCloseAmountForPast('');
      setCloseNotesForPast('');
      setMessage(`Session for ${sessionToClose.date} closed`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to close session');
    }
  };

  const closeCash = async () => {
    if (!db || !user || !todaySession) return;
    if (closingAmountError) {
      setMessage('Please fix validation errors before closing cash drawer.');
      return;
    }
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
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '');
                      setClosingAmount(val);
                      if (!val.trim()) {
                        setClosingAmountError(null);
                        return;
                      }
                      const num = parseFloat(val);
                      if (isNaN(num)) {
                        setClosingAmountError('Amount must be a number');
                      } else if (num < 0) {
                        setClosingAmountError('Amount cannot be negative');
                      } else {
                        setClosingAmountError(null);
                      }
                    }}
                    className={`input-base ${closingAmountError ? 'border-red-300' : ''}`}
                  />
                  {closingAmountError && <p className="mt-1 text-xs text-red-600">{closingAmountError}</p>}
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
                <button type="button" onClick={closeCash} disabled={!!closingAmountError} className="btn-primary w-full disabled:opacity-50">
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
                  onChange={(e) => {
                    const val = e.target.value.replace(/,/g, '');
                    setOpeningAmount(val);
                    if (!val.trim()) {
                      setOpeningAmountError(null);
                      return;
                    }
                    const num = parseFloat(val);
                    if (isNaN(num)) {
                      setOpeningAmountError('Amount must be a number');
                    } else if (num < 0) {
                      setOpeningAmountError('Amount cannot be negative');
                    } else {
                      setOpeningAmountError(null);
                    }
                  }}
                  className={`input-base ${openingAmountError ? 'border-red-300' : ''}`}
                />
                {openingAmountError && <p className="mt-1 text-xs text-red-600">{openingAmountError}</p>}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={openForPastDate}
                    onChange={(e) => {
                      setOpenForPastDate(e.target.checked);
                      if (!e.target.checked) setSessionDate(getTodayInAppTz());
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-tufts-blue focus:ring-tufts-blue"
                  />
                  <span className="text-sm text-slate-700">Open for a past date (e.g. January)</span>
                </label>
              </div>
              {openForPastDate && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Session date</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="input-base w-full"
                  />
                </div>
              )}
              <button type="button" onClick={openCash} disabled={!!openingAmountError} className="btn-primary w-full disabled:opacity-50">
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
                          {s.date === getTodayInAppTz() && (
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
                        <div className="ml-2 flex items-center gap-2">
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                            Open
                          </span>
                          {sessionToClose?.id === s.id ? (
                            <div className="flex flex-col gap-1">
                              <div>
                                <input
                                  type="text"
                                  placeholder="Closing amount"
                                  value={closeAmountForPast}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/,/g, '');
                                    setCloseAmountForPast(val);
                                    if (!val.trim()) {
                                      setCloseAmountForPastError(null);
                                      return;
                                    }
                                    const num = parseFloat(val);
                                    if (isNaN(num)) {
                                      setCloseAmountForPastError('Must be a number');
                                    } else if (num < 0) {
                                      setCloseAmountForPastError('Cannot be negative');
                                    } else {
                                      setCloseAmountForPastError(null);
                                    }
                                  }}
                                  className={`input-base w-28 py-1 text-sm ${closeAmountForPastError ? 'border-red-300' : ''}`}
                                />
                                {closeAmountForPastError && <p className="mt-0.5 text-xs text-red-600">{closeAmountForPastError}</p>}
                              </div>
                              <div className="flex gap-1">
                                <button type="button" onClick={closePastSession} disabled={!!closeAmountForPastError} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSessionToClose(null);
                                    setCloseAmountForPast('');
                                    setCloseNotesForPast('');
                                    setCloseAmountForPastError(null);
                                  }}
                                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setSessionToClose(s); setCloseAmountForPast(''); setCloseNotesForPast(''); }}
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Close
                            </button>
                          )}
                        </div>
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
