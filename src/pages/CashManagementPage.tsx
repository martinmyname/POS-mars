import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCashSessions, useOrders, useExpenses, useSupplierLedger, usePettyCashTransactions, cashSessionsApi, pettyCashTransactionsApi, cashSessionAuditLogApi, generateId } from '@/hooks/useData';
import type { CashSessionAuditLogEntry } from '@/lib/data';
import { useDayBoundaryTick } from '@/hooks/useDayBoundaryTick';
import { useAuth } from '@/context/AuthContext';
import { formatUGX } from '@/lib/formatUGX';
import { Money } from '@/components/Money';
import { getTodayInAppTz, getStartOfDayAppTzAsUTC, getEndOfDayAppTzAsUTC, getCurrentTimeAppTz } from '@/lib/appTimezone';
import { getSettings } from '@/lib/settings';
import { format } from 'date-fns';
import { Lock, Unlock, TrendingUp, TrendingDown, BarChart3, AlertTriangle, X, Clock, ChevronDown, ChevronRight, History, Download } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { addDaysToDateStr } from '@/lib/appTimezone';

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
  const { data: sessionsList, loading, refetch: refetchSessions } = useCashSessions({ realtime: true });
  const { data: ordersList } = useOrders({ realtime: true });
  const { data: expensesList } = useExpenses({ realtime: true });
  const { data: ledgerList } = useSupplierLedger({ realtime: true });
  const { data: pettyCashList, refetch: refetchPettyCash } = usePettyCashTransactions({ realtime: true });
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
  const [unclosedBannerDismissed, setUnclosedBannerDismissed] = useState(false);
  const [eodReminderShown, setEodReminderShown] = useState(false);
  const [thresholdWarning, setThresholdWarning] = useState<{ amount: number; over: boolean } | null>(null);
  const [pettyModalOpen, setPettyModalOpen] = useState(false);
  const [pettyAmount, setPettyAmount] = useState('');
  const [pettyReason, setPettyReason] = useState('');
  const [pettyReasonOther, setPettyReasonOther] = useState('');
  const [auditExpandedId, setAuditExpandedId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<CashSessionAuditLogEntry[]>([]);
  const [exportStart, setExportStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [exportEnd, setExportEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const recentSessionsRef = useRef<HTMLElement>(null);

  const cashThreshold = getSettings().cashOverShortThresholdUgx ?? 10000;

  const PETTY_REASONS = [
    { value: 'change/float adjustment', label: 'Change / float adjustment' },
    { value: 'boda/transport', label: 'Boda / transport' },
    { value: 'misc', label: 'Misc' },
    { value: 'other', label: 'Other' },
  ] as const;

  const pettyForSession = (sessionId: string) =>
    pettyCashList.filter((t) => t.sessionId === sessionId).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const pettyTodayTotal = todaySession ? pettyForSession(todaySession.id) : 0;
  const pettyTodayList = todaySession ? pettyCashList.filter((t) => t.sessionId === todaySession.id) : [];

  // Last 30 days over/short for Trends chart (closed sessions only)
  const trendsData = useMemo(() => {
    const today = getTodayInAppTz();
    const out: { date: string; dateLabel: string; difference: number; expected?: number; closing?: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDaysToDateStr(today, -i);
      const session = sessions.find((s) => s.date === d && s.closedAt != null);
      out.push({
        date: d,
        dateLabel: format(new Date(d + 'T12:00:00'), 'dd MMM'),
        difference: session?.difference ?? 0,
        expected: session?.expectedAmount,
        closing: session?.closingAmount,
      });
    }
    return out;
  }, [sessions]);
  const [trendsOpen, setTrendsOpen] = useState(false);

  // Unclosed sessions from previous days
  const unclosedPastSessions = useMemo(
    () => sessions.filter((s) => s.date < todayStr && !s.closedAt),
    [sessions, todayStr]
  );

  // End-of-day close reminder: at configured time (default 21:00), show once per day if session still open
  const reminderTime = getSettings().cashCloseReminderTime ?? '21:00';
  useEffect(() => {
    if (!todaySession) return;
    const key = `cash-eod-reminder-${todayStr}`;
    const check = () => {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
      if (getCurrentTimeAppTz() === reminderTime) {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
        setEodReminderShown(true);
      }
    };
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [todaySession, todayStr, reminderTime]);

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

  // Recalculate and persist expected cash in drawer when session or totals change (includes petty cash out)
  useEffect(() => {
    if (!todaySession) return;
    const expectedCash =
      todaySession.openingAmount +
      todayExpected.cashFromOrders -
      todayExpected.totalDeductions -
      pettyTodayTotal;
    if (todaySession.expectedAmount !== expectedCash) {
      cashSessionsApi.updateAndLog(todaySession.id, { expectedAmount: expectedCash }, 'System', 'Recalculated from sales and deductions').catch(() => {});
    }
  }, [todaySession, todayExpected.cashFromOrders, todayExpected.totalDeductions, pettyTodayTotal]);

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
      await refetchSessions();
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
    const closedBy = (user?.user_metadata as { full_name?: string })?.full_name || user?.email || 'Staff';
    try {
      await cashSessionsApi.updateAndLog(sessionToClose.id, {
        closingAmount: amount,
        expectedAmount: expected,
        difference,
        closedAt: new Date().toISOString(),
        closedBy,
        notes: closeNotesForPast.trim() || undefined,
      }, closedBy, 'Session closed');
      await refetchSessions();
      setSessionToClose(null);
      setCloseAmountForPast('');
      setCloseNotesForPast('');
      setMessage(`Session for ${sessionToClose.date} closed`);
      if (Math.abs(difference) > cashThreshold) {
        setThresholdWarning({ amount: Math.abs(difference), over: difference >= 0 });
      } else {
        setThresholdWarning(null);
      }
      setTimeout(() => { setMessage(null); setThresholdWarning(null); }, 8000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to close session');
    }
  };

  const exportSessionsCsv = () => {
    const inRange = sessions.filter((s) => s.date >= exportStart && s.date <= exportEnd);
    const headers = ['Date', 'Opened By', 'Opening Amount', 'Expected Amount', 'Closing Amount', 'Difference', 'Over/Short', 'Notes'];
    const escape = (v: string | number | undefined) => {
      const s = v === undefined || v === null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = inRange.map((s) => [
      s.date,
      s.openedBy,
      s.openingAmount,
      s.expectedAmount ?? '',
      s.closingAmount ?? '',
      s.difference ?? '',
      s.difference != null ? (s.difference >= 0 ? `Over ${s.difference}` : `Short ${Math.abs(s.difference)}`) : '',
      s.notes ?? '',
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitPettyCash = async () => {
    if (!user || !todaySession) return;
    const amount = Math.round(parseFloat(pettyAmount.replace(/,/g, '')));
    if (Number.isNaN(amount) || amount <= 0) {
      setMessage('Enter a valid amount');
      return;
    }
    const reasonText = pettyReason === 'other' ? pettyReasonOther.trim() || 'Other' : pettyReason;
    if (!reasonText) {
      setMessage('Select or enter a reason');
      return;
    }
    try {
      await pettyCashTransactionsApi.insert({
        id: `petty_${generateId()}`,
        sessionId: todaySession.id,
        amount,
        reason: reasonText,
        recordedAt: new Date().toISOString(),
        recordedBy: (user?.user_metadata as { full_name?: string })?.full_name || user?.email || 'Staff',
      });
      await refetchPettyCash();
      await refetchSessions();
      setPettyModalOpen(false);
      setPettyAmount('');
      setPettyReason('');
      setPettyReasonOther('');
      setMessage('Petty cash recorded');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to record petty cash');
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
    const closedBy = (user?.user_metadata as { full_name?: string })?.full_name || user?.email || 'Staff';
    try {
      await cashSessionsApi.updateAndLog(todaySession.id, {
        closingAmount: amount,
        expectedAmount: expected,
        difference,
        closedAt: new Date().toISOString(),
        closedBy,
        notes: notes.trim() || undefined,
      }, closedBy, 'Cash drawer closed');
      await refetchSessions();

      setClosingAmount('');
      setNotes('');
      setMessage(`Cash drawer closed. ${difference >= 0 ? 'Over' : 'Short'} by ${formatUGX(Math.abs(difference))}`);
      if (Math.abs(difference) > cashThreshold) {
        setThresholdWarning({ amount: Math.abs(difference), over: difference >= 0 });
      } else {
        setThresholdWarning(null);
      }
      setTimeout(() => { setMessage(null); setThresholdWarning(null); }, 8000);
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
        <h1 className="page-title">
          Cash Management
        </h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-body">
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

      {unclosedPastSessions.length > 0 && !unclosedBannerDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium">
              You have {unclosedPastSessions.length} unclosed session(s) from previous days. Please review and close them.
            </p>
            <button
              type="button"
              onClick={() => {
                recentSessionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="mt-2 text-sm font-medium text-amber-800 underline hover:no-underline"
            >
              Go to Recent Sessions →
            </button>
          </div>
          <button
            type="button"
            onClick={() => setUnclosedBannerDismissed(true)}
            className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {thresholdWarning && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-3 ${
            thresholdWarning.over
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="font-medium">
            {thresholdWarning.over ? 'Over' : 'Short'} by {formatUGX(thresholdWarning.amount)} — this exceeds the over/short threshold ({formatUGX(cashThreshold)}).
          </p>
        </div>
      )}

      {eodReminderShown && todaySession && (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-800">
          <Clock className="h-5 w-5 shrink-0 text-slate-600" />
          <p className="flex-1">
            It’s time to count and close the cash drawer. Enter the closing amount below and close the session.
          </p>
          <button
            type="button"
            onClick={() => setEodReminderShown(false)}
            className="shrink-0 rounded p-1 text-slate-600 hover:bg-slate-200"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open/Close Cash */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-sans text-title3 font-semibold text-smoky-black">
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
                  Opening Amount: <Money value={todaySession.openingAmount} size="medium" className="font-semibold text-emerald-700" />
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
                    {pettyTodayTotal > 0 && (
                      <p className="mt-1 border-t border-slate-200 pt-1 text-slate-600">
                        Petty cash out: <Money value={pettyTodayTotal} className="text-slate-600" />
                        {pettyTodayList.length > 0 && (
                          <span className="ml-1 text-xs">
                            ({pettyTodayList.map((t) => `${formatUGX(t.amount)} ${t.reason}`).join(', ')})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {todaySession && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPettyModalOpen(true)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Petty Cash Out
                  </button>
                </div>
              )}

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
        <section ref={recentSessionsRef} className="card overflow-hidden">
          <div className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-sans text-title3 font-semibold text-smoky-black">Recent Sessions</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                  className="input-base w-36 py-1 text-sm"
                  aria-label="Export from date"
                />
                <span className="text-slate-500">–</span>
                <input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="input-base w-36 py-1 text-sm"
                  aria-label="Export to date"
                />
                <button
                  type="button"
                  onClick={exportSessionsCsv}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No cash sessions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sessions.slice(0, 10).map((s) => {
                  const exceedsThreshold =
                    s.closedAt != null &&
                    s.difference !== undefined &&
                    Math.abs(s.difference) > cashThreshold;
                  const thresholdShort = exceedsThreshold && (s.difference ?? 0) < 0;
                  const thresholdOver = exceedsThreshold && (s.difference ?? 0) >= 0;
                  return (
                  <li
                    key={s.id}
                    className={`px-4 py-3 ${exceedsThreshold ? 'border-l-4 ' + (thresholdShort ? 'border-l-red-500 bg-red-50/30' : 'border-l-amber-500 bg-amber-50/30') : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-smoky-black">
                          {format(new Date(s.date), 'dd MMM yyyy')}
                          {s.date === getTodayInAppTz() && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                              Today
                            </span>
                          )}
                          {thresholdShort && (
                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                              Short &gt; threshold
                            </span>
                          )}
                          {thresholdOver && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Over &gt; threshold
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
                        {pettyForSession(s.id) > 0 && (
                          <p className="mt-1 text-xs text-slate-500">Petty cash out: <Money value={pettyForSession(s.id)} className="text-slate-500" /></p>
                        )}
                        {s.closedAt && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (auditExpandedId === s.id) {
                                  setAuditExpandedId(null);
                                } else {
                                  setAuditExpandedId(s.id);
                                  cashSessionAuditLogApi.getBySessionId(s.id).then(setAuditLog);
                                }
                              }}
                              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
                            >
                              {auditExpandedId === s.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <History className="h-3 w-3" />
                              Session History
                            </button>
                            {auditExpandedId === s.id && (
                              <ul className="mt-2 space-y-1 rounded border border-slate-100 bg-slate-50/50 p-2 text-xs">
                                {auditLog.length === 0 ? (
                                  <li className="text-slate-500">No history recorded.</li>
                                ) : (
                                  auditLog.map((entry) => (
                                    <li key={entry.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                                      <span className="text-slate-500">{format(new Date(entry.changedAt), 'dd MMM HH:mm')}</span>
                                      <span className="font-medium text-slate-700">{entry.changedBy}</span>
                                      <span className="text-slate-600">{entry.field}:</span>
                                      <span className="text-slate-500">{entry.oldValue ?? '—'}</span>
                                      <span>→</span>
                                      <span className="text-slate-700">{entry.newValue ?? '—'}</span>
                                      {entry.reason && <span className="italic text-slate-500">({entry.reason})</span>}
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                          </div>
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
                );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Over/Short Trends (collapsible) */}
      <section className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setTrendsOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b border-slate-200/80 bg-slate-50/50 px-4 py-3 text-left font-sans text-title3 font-semibold text-smoky-black"
        >
          <span className="flex items-center gap-2">Trends (last 30 days)</span>
          {trendsOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        {trendsOpen && (
          <div className="p-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendsData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dateLabel" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => formatUGX(v)} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                          <p className="font-medium text-slate-800">{p.date}</p>
                          {p.expected != null && <p className="text-sm text-slate-600">Expected: {formatUGX(p.expected)}</p>}
                          {p.closing != null && <p className="text-sm text-slate-600">Closing: {formatUGX(p.closing)}</p>}
                          <p className={`text-sm font-medium ${p.difference >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            Difference: {p.difference >= 0 ? '+' : ''}{formatUGX(p.difference)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                  <ReferenceArea y1={-cashThreshold} y2={cashThreshold} fill="#e2e8f0" fillOpacity={0.4} />
                  <Bar dataKey="difference" radius={[2, 2, 0, 0]} isAnimationActive={true}>
                    {trendsData.map((entry, index) => (
                      <Cell key={index} fill={entry.difference >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Green = over, red = short. Shaded band = within threshold ({formatUGX(cashThreshold)}).
            </p>
          </div>
        )}
      </section>

      {/* Petty Cash Out modal */}
      {pettyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="mb-3 font-sans text-lg font-semibold text-smoky-black">Petty Cash Out</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="petty-amount" className="mb-1 block text-sm font-medium text-slate-700">Amount (UGX) *</label>
                <input
                  id="petty-amount"
                  type="text"
                  value={pettyAmount}
                  onChange={(e) => setPettyAmount(e.target.value.replace(/,/g, ''))}
                  placeholder="0"
                  className="input-base w-full"
                />
              </div>
              <div>
                <label htmlFor="petty-reason" className="mb-1 block text-sm font-medium text-slate-700">Reason *</label>
                <select
                  id="petty-reason"
                  value={pettyReason}
                  onChange={(e) => setPettyReason(e.target.value)}
                  className="input-base w-full"
                >
                  <option value="">Select…</option>
                  {PETTY_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {pettyReason === 'other' && (
                <div>
                  <label htmlFor="petty-reason-other" className="mb-1 block text-sm font-medium text-slate-700">Other reason</label>
                  <input
                    id="petty-reason-other"
                    type="text"
                    value={pettyReasonOther}
                    onChange={(e) => setPettyReasonOther(e.target.value)}
                    placeholder="Describe…"
                    className="input-base w-full"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={submitPettyCash} className="btn-primary flex-1">
                Record
              </button>
              <button
                type="button"
                onClick={() => { setPettyModalOpen(false); setPettyAmount(''); setPettyReason(''); setPettyReasonOther(''); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
