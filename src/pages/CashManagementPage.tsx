import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCashSessions, useOrders, useExpenses, useSupplierLedger, cashSessionsApi, generateId } from '@/hooks/useData';
import { useDayBoundaryTick } from '@/hooks/useDayBoundaryTick';
import { useAuth } from '@/context/AuthContext';
import { formatUGX } from '@/lib/formatUGX';
import { Money } from '@/components/Money';
import { getTodayInAppTz, getStartOfDayAppTzAsUTC, getEndOfDayAppTzAsUTC } from '@/lib/appTimezone';
import { format } from 'date-fns';
import { Lock, Unlock, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

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
  const { data: sessionsList, loading } = useCashSessions({ realtime: true });
  const { data: ordersList } = useOrders({ realtime: true });
  const { data: expensesList } = useExpenses({ realtime: true });
  const { data: ledgerList } = useSupplierLedger({ realtime: true });
  useDayBoundaryTick();
  const { user } = useAuth();
  const sessions = useMemo(
    () =>
      [...sessionsList]
        .map((d) => ({
          id: d.id,
          date: d.date,
          openingAmount: d.openingAmount,
          closingAmount: d.closingAmount,
          expectedAmount: d.expectedAmount,
          difference: d.difference,
          openedAt: d.openedAt,
          closedAt: d.closedAt,
          openedBy: d.openedBy,
          closedBy: d.closedBy,
          notes: d.notes,
        }))
        .sort((a, b) => (b.date > a.date ? 1 : -1)),
    [sessionsList]
  );
  const todayStr = getTodayInAppTz();
  const todaySession = useMemo(
    () => sessions.find((s) => s.date === todayStr && !s.closedAt) ?? null,
    [sessions, todayStr]
  );
  // Most recent closed session (by date) — used as default opening when none entered
  const lastClosedSession = useMemo(
    () => sessions.find((s) => s.closedAt && s.closingAmount != null) ?? null,
    [sessions]
  );
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [openForPastDate, setOpenForPastDate] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => getTodayInAppTz());
  const [sessionToClose, setSessionToClose] = useState<CashSession | null>(null);
  const [closeAmountForPast, setCloseAmountForPast] = useState('');
  const [closeNotesForPast, setCloseNotesForPast] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [openingAmountError, setOpeningAmountError] = useState<string | null>(null);
  const [closingAmountError, setClosingAmountError] = useState<string | null>(null);
  const [closeAmountForPastError, setCloseAmountForPastError] = useState<string | null>(null);

  // Today's expected amounts by payment method and deductions (orders use paymentSplits when present)
  const todayExpected = useMemo(() => {
    const today = getStartOfDayAppTzAsUTC(todayStr).toISOString();
    const tomorrowIso = getEndOfDayAppTzAsUTC(todayStr).toISOString();
    const periodOrders = ordersList.filter((o) => o.createdAt >= today && o.createdAt < tomorrowIso);

    const byMethod: Record<string, number> = { cash: 0, mtn_momo: 0, airtel_pay: 0 };
    periodOrders.forEach((order) => {
      const splits = order.paymentSplits && Array.isArray(order.paymentSplits) && order.paymentSplits.length > 0
        ? (order.paymentSplits as { method?: string; amount?: number }[])
        : null;
      if (splits) {
        splits.forEach((s) => {
          const method = (s.method || 'cash').toLowerCase().trim();
          const amount = Number(s.amount) || 0;
          const key = method === 'mtn_momo' || method === 'airtel_pay' ? method : 'cash';
          byMethod[key] = (byMethod[key] ?? 0) + amount;
        });
      } else {
        const method = (order.paymentMethod || 'cash').toLowerCase().trim();
        const amount = Number(order.total) || 0;
        const key = method === 'mtn_momo' || method === 'airtel_pay' ? method : 'cash';
        byMethod[key] = (byMethod[key] ?? 0) + amount;
      }
    });

    const allExpensesToday = expensesList
      .filter((e) => e.date.slice(0, 10) === todayStr)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const supplierPaymentsToday = ledgerList
      .filter((e) => e.type === 'payment' && e.date.slice(0, 10) === todayStr)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalDeductions = allExpensesToday + supplierPaymentsToday;

    return {
      cashFromOrders: byMethod.cash ?? 0,
      mtnFromOrders: byMethod.mtn_momo ?? 0,
      airtelFromOrders: byMethod.airtel_pay ?? 0,
      allExpensesToday,
      supplierPaymentsToday,
      totalDeductions,
    };
  }, [ordersList, expensesList, ledgerList, todayStr]);

  // Recalculate and persist expected cash in drawer when session or totals change
  useEffect(() => {
    if (!todaySession) return;
    const expectedCash =
      todaySession.openingAmount +
      todayExpected.cashFromOrders -
      todayExpected.totalDeductions;
    if (todaySession.expectedAmount !== expectedCash) {
      cashSessionsApi.update(todaySession.id, { expectedAmount: expectedCash }).catch(() => {});
    }
  }, [todaySession, todayExpected.cashFromOrders, todayExpected.totalDeductions]);

  const openCash = async () => {
    if (!user) return;
    if (openingAmountError) {
      setMessage('Please fix validation errors before opening cash drawer.');
      return;
    }
    const today = getTodayInAppTz();
    const dateToUse = openForPastDate ? sessionDate : today;
    // When opening for today with no amount entered, use last closed session's closing amount
    let amount: number;
    if (dateToUse === today && !openingAmount.trim() && lastClosedSession?.closingAmount != null) {
      amount = lastClosedSession.closingAmount;
    } else {
      amount = parseFloat(openingAmount.replace(/,/g, ''));
      if (Number.isNaN(amount) || amount < 0) {
        setMessage('Enter a valid opening amount');
        return;
      }
    }
    if (!dateToUse) {
      setMessage('Select a date');
      return;
    }
    const existing = await cashSessionsApi.getByDate(dateToUse);
    if (existing && !existing.closedAt) {
      setMessage(dateToUse === today ? 'Cash drawer already opened for today' : `A session for ${dateToUse} is already open`);
      return;
    }
    if (existing && existing.closedAt) {
      setMessage(`A session for ${dateToUse} already exists. Use a different date for historical data.`);
      return;
    }
    try {
      const openedAt = openForPastDate && dateToUse
        ? new Date(dateToUse + 'T08:00:00').toISOString()
        : new Date().toISOString();
      await cashSessionsApi.insert({
        id: `cash_${generateId()}`,
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
    if (!user || !sessionToClose) return;
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
      await cashSessionsApi.update(sessionToClose.id, {
        closingAmount: amount,
        expectedAmount: expected,
        difference,
        closedAt: new Date().toISOString(),
        closedBy: (user?.user_metadata as { full_name?: string })?.full_name || user?.email || 'Staff',
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
    if (!user || !todaySession) return;
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
      await cashSessionsApi.update(todaySession.id, {
        closingAmount: amount,
        expectedAmount: expected,
        difference,
        closedAt: new Date().toISOString(),
        closedBy: (user?.user_metadata as { full_name?: string })?.full_name || user?.email || 'Staff',
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-smoky-black">
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
          <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-smoky-black">
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
                  Opening Amount: <Money value={todaySession.openingAmount} className="text-lg font-semibold text-emerald-700" />
                </p>
                {todaySession.expectedAmount !== undefined && (
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <p className="font-medium text-slate-800">
                      Expected in drawer (Cash): <Money value={todaySession.expectedAmount} className="font-medium text-slate-800" />
                    </p>
                    <p>Expected MTN MoMo: <Money value={todayExpected.mtnFromOrders} className="text-slate-700" /></p>
                    <p>Expected Airtel Pay: <Money value={todayExpected.airtelFromOrders} className="text-slate-700" /></p>
                    {(todayExpected.allExpensesToday > 0 || todayExpected.supplierPaymentsToday > 0) && (
                      <p className="mt-1 border-t border-slate-200 pt-1 text-slate-600">
                        Deductions today: expenses <Money value={todayExpected.allExpensesToday} className="text-slate-600" />
                        {todayExpected.supplierPaymentsToday > 0 && (
                          <>, supplier payments <Money value={todayExpected.supplierPaymentsToday} className="text-slate-600" /></>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="cash-closing-amount" className="mb-1 block text-sm font-medium text-slate-700">
                    Closing Amount (UGX) *
                  </label>
                  <input
                    id="cash-closing-amount"
                    name="closing_amount"
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
                  <label htmlFor="cash-close-notes" className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
                  <textarea
                    id="cash-close-notes"
                    name="close_notes"
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
                <label htmlFor="cash-opening-amount" className="mb-1 block text-sm font-medium text-slate-700">
                  Opening Amount (UGX) *
                </label>
                <input
                  id="cash-opening-amount"
                  name="opening_amount"
                  type="text"
                  placeholder={lastClosedSession?.closingAmount != null ? `Leave blank to use last closed (${formatUGX(lastClosedSession.closingAmount)})` : 'Enter opening cash amount'}
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
                  <label htmlFor="cash-session-date" className="mb-1 block text-sm font-medium text-slate-700">Session date</label>
                  <input
                    id="cash-session-date"
                    name="session_date"
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
            <h2 className="font-sans text-lg font-semibold text-smoky-black">Recent Sessions</h2>
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
                          Opened: <Money value={s.openingAmount} className="text-slate-600" /> by {s.openedBy}
                        </p>
                        {s.closedAt && (
                          <>
                            <p className="mt-1 text-sm text-slate-600">
                              Closed: <Money value={s.closingAmount ?? 0} className="text-slate-600" /> by {s.closedBy}
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
                                {s.difference >= 0 ? 'Over' : 'Short'} by <Money value={Math.abs(s.difference)} className={s.difference >= 0 ? 'text-emerald-700' : 'text-red-700'} />
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

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-[#1f2937] dark:bg-[#111827]/50">
        <Link
          to="/reports/daily"
          className="flex items-center gap-2 text-sm font-medium text-tufts-blue hover:underline"
        >
          <BarChart3 className="h-4 w-4 shrink-0" />
          View full cash flow breakdown → Reports
        </Link>
      </div>
    </div>
  );
}
