import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useExpenses, expensesApi, generateId } from '@/hooks/useData';
import { useExpenseMetrics } from '@/hooks/expenses/useExpenseMetrics';
import { Money } from '@/components/Money';
import { formatUGX, formatUGXShort } from '@/utils/formatUtils';
import { StatCardXL } from '@/components/cards/StatCardXL';
import { StatCardMD } from '@/components/cards/StatCardMD';
import { StatCardSM } from '@/components/cards/StatCardSM';
import { getTodayInAppTz } from '@/lib/appTimezone';
import { format } from 'date-fns';
import { EXPENSE_PURPOSE_OPTIONS, PURPOSE_COLORS, UNCATEGORIZED_LABEL } from '@/lib/expenseConstants';
import { isToday, isThisWeek, isThisMonth } from '@/utils/dateUtils';
import { exportToCSV } from '@/utils/exportUtils';

type FormStatus = 'idle' | 'saving' | 'success' | 'error';

export type ListPeriod = 'today' | 'week' | 'month' | 'all';
const LIST_PERIODS: ListPeriod[] = ['today', 'week', 'month', 'all'];
const PAID_BY_WHO_OPTIONS = ['All', 'Staff', 'Owner', 'Manager', 'Accountant'];

export default function ExpensesPage() {
  const { data: expensesList, loading, refetch: refetchExpenses } = useExpenses({ realtime: true });
  const todayStr = getTodayInAppTz();
  const [listPeriod, setListPeriod] = useState<ListPeriod>('month');
  const [listPurpose, setListPurpose] = useState<string>('All');
  const [listPaidByWho, setListPaidByWho] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [breakdownPeriod, setBreakdownPeriod] = useState<ListPeriod>('month');

  const metrics = useExpenseMetrics(expensesList, 'month');
  const breakdownMetrics = useExpenseMetrics(expensesList, breakdownPeriod);

  const inListPeriod = (d: string) =>
    listPeriod === 'today' ? isToday(d) : listPeriod === 'week' ? isThisWeek(d) : listPeriod === 'month' ? isThisMonth(d) : true;
  const normPurpose = (p: string) => {
    const t = (p || '').trim();
    return (EXPENSE_PURPOSE_OPTIONS as readonly string[]).includes(t) ? t : UNCATEGORIZED_LABEL;
  };
  const purposesInData = useMemo(() => {
    const set = new Set(expensesList.map((e) => normPurpose(e.purpose)));
    return ['All', ...EXPENSE_PURPOSE_OPTIONS, ...(set.has(UNCATEGORIZED_LABEL) ? [UNCATEGORIZED_LABEL] : [])];
  }, [expensesList]);

  const filteredList = useMemo(() => {
    let list = expensesList.filter((e) => inListPeriod(e.date));
    if (listPurpose !== 'All') list = list.filter((e) => normPurpose(e.purpose) === listPurpose);
    if (listPaidByWho !== 'All') list = list.filter((e) => (e.paidByWho || '').trim() === listPaidByWho);
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.itemBought || '').toLowerCase().includes(q) ||
          (e.purpose || '').toLowerCase().includes(q) ||
          (e.paidByWho || '').toLowerCase().includes(q) ||
          (e.notes || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [expensesList, listPeriod, listPurpose, listPaidByWho, searchTerm]);

  const runningTotalByExpenseId = useMemo(() => {
    const monthExp = expensesList
      .filter((e) => isThisMonth(e.date))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const map = new Map<string, number>();
    let run = 0;
    monthExp.forEach((e) => {
      run += Number(e.amount) || 0;
      map.set(e.id, run);
    });
    return map;
  }, [expensesList]);

  const last6MonthKeys = useMemo(() => {
    const [y, m] = todayStr.split('-').map(Number);
    const keys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      let mm = m - i;
      let yy = y;
      if (mm <= 0) {
        mm += 12;
        yy -= 1;
      }
      keys.push(`${yy}-${String(mm).padStart(2, '0')}`);
    }
    return keys;
  }, [todayStr]);

  const [itemBought, setItemBought] = useState('');
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [paidByWho, setPaidByWho] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => getTodayInAppTz());
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [purposeError, setPurposeError] = useState<string | null>(null);
  const [hoverRowId, setHoverRowId] = useState<string | null>(null);

  const handleExportCSV = () => {
    const headers = ['Date', 'Item', 'Purpose', 'Amount (UGX)', 'Paid By', 'Paid By Who', 'Notes'];
    const rows = filteredList.map((e) => [
      e.date,
      e.itemBought,
      e.purpose || '',
      e.amount,
      e.paidBy || '',
      e.paidByWho || '',
      e.notes || '',
    ]);
    exportToCSV('expenses', headers, rows);
  };

  const visibleTotal = filteredList.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const emptyDb = expensesList.length === 0;
  const emptyPeriod = !emptyDb && filteredList.length === 0 && !searchTerm.trim() && listPurpose === 'All' && listPaidByWho === 'All';
  const emptySearch = !emptyDb && filteredList.length === 0 && searchTerm.trim().length > 0;
  const emptyFilter = !emptyDb && filteredList.length === 0 && (listPurpose !== 'All' || listPaidByWho !== 'All') && !searchTerm.trim();

  useEffect(() => {
    if (formStatus !== 'success') return;
    const t = setTimeout(() => setFormStatus('idle'), 3000);
    return () => clearTimeout(t);
  }, [formStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const purposeTrimmed = purpose.trim();
    if (!purposeTrimmed || !(EXPENSE_PURPOSE_OPTIONS as readonly string[]).includes(purposeTrimmed)) {
      setPurposeError('Please select a purpose.');
      return;
    }
    setPurposeError(null);
    const trimmed = amount.trim();
    if (!trimmed) {
      setAmountError('Amount must be greater than 0.');
      return;
    }
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      setAmountError('Amount must be greater than 0.');
      return;
    }
    setAmountError(null);
    setFormStatus('saving');
    setApiErrorMessage(null);
    try {
      await expensesApi.insert({
        id: `exp_${generateId()}`,
        date,
        itemBought: itemBought.trim() || 'Misc',
        purpose: purposeTrimmed,
        amount: num,
        paidBy: paidBy.trim() || 'Cash',
        receiptAttached: false,
        paidByWho: paidByWho.trim() || 'Staff',
        notes: notes.trim() || undefined,
      });
      await refetchExpenses();
      setItemBought('');
      setPurpose('');
      setAmount('');
      setPaidBy('');
      setPaidByWho('');
      setNotes('');
      setDate(getTodayInAppTz());
      setFormStatus('success');
    } catch {
      setFormStatus('error');
      setApiErrorMessage('Failed to save. Try again.');
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
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">Expenses</h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">
          ← Dashboard
        </Link>
      </div>

      {/* Summary cards — Today, Month, Operating, Restock */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="min-w-0">
          <StatCardXL
            label="Today’s expenses"
            value={formatUGXShort(metrics.todayTotal)}
            fullValue={formatUGX(metrics.todayTotal)}
            sub={
              metrics.todayCount === 0
                ? 'None recorded yet'
                : `${metrics.todayCount} entries`
            }
          />
        </div>
        <div className="min-w-0">
          <StatCardXL
            label="This month total"
            value={formatUGXShort(metrics.monthTotal)}
            fullValue={formatUGX(metrics.monthTotal)}
            sub={
              metrics.weekOverWeekChange != null
                ? `${metrics.weekOverWeekChange >= 0 ? '+' : ''}${(
                    metrics.weekOverWeekChange * 100
                  ).toFixed(1)}% vs last week`
                : `${metrics.monthCount} entries this month`
            }
          />
        </div>
        <div className="min-w-0">
          <StatCardMD
            label="Operating (month)"
            value={formatUGXShort(metrics.operatingExpenses)}
            fullValue={formatUGX(metrics.operatingExpenses)}
            sub="Excl. stock · counts toward net profit"
          />
        </div>
        <div className="min-w-0">
          <StatCardMD
            label="Restock / Stock (month)"
            value={formatUGXShort(metrics.restockExpenses)}
            fullValue={formatUGX(metrics.restockExpenses)}
            sub="Not deducted from net profit"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 lg:gap-6">
        {/* Left column: Form + Spending by Purpose + Quick Stats */}
        <div className="space-y-5 sm:space-y-6">
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-sans text-[15px] font-semibold text-primary">
                Add expense
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="expense-date" className="mb-1 block text-caption2 font-semibold uppercase tracking-apple-wider text-slate-700">Date</label>
                <input id="expense-date" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base w-full" />
                <p className="mt-0.5 text-footnote text-slate-500">Use a past date to record historical expenses (e.g. January)</p>
              </div>
              <label htmlFor="expense-item" className="sr-only">Item bought</label>
              <input id="expense-item" name="item_bought" type="text" placeholder="e.g. Cooking oil (defaults to 'Misc' if blank)" value={itemBought} onChange={(e) => setItemBought(e.target.value)} className="input-base" />
              <div>
                <label htmlFor="expense-purpose" className="mb-1 block text-caption2 font-semibold uppercase tracking-apple-wider text-slate-700">Purpose</label>
                <select
                  id="expense-purpose"
                  name="purpose"
                  value={purpose}
                  onChange={(e) => { setPurpose(e.target.value); setPurposeError(null); }}
                  className={`input-base w-full ${purposeError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                >
                  <option value="">Select purpose (required)</option>
                  {EXPENSE_PURPOSE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {purposeError && <p className="mt-1 text-footnote text-red-600">{purposeError}</p>}
              </div>
              <div>
                <label htmlFor="expense-amount" className="mb-1 block text-caption2 font-semibold uppercase tracking-apple-wider text-slate-700">Amount (UGX)</label>
                <input
                  id="expense-amount"
                  name="amount"
                  type="number"
                  placeholder="Amount (UGX)"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAmount(val);
                    if (!val.trim()) {
                      setAmountError(null);
                      return;
                    }
                    const num = parseFloat(val);
                    if (isNaN(num)) {
                      setAmountError('Amount must be a number');
                    } else if (num <= 0) {
                      setAmountError('Amount must be greater than 0.');
                    } else {
                      setAmountError(null);
                    }
                  }}
                  min="1"
                  step="1"
                  className={`input-base ${amountError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
                {amountError && <p className="mt-1 text-footnote text-red-600">{amountError}</p>}
              </div>
              <label htmlFor="expense-paid-by" className="sr-only">Paid by</label>
              <input id="expense-paid-by" name="paid_by" type="text" placeholder="Paid by (e.g. Cash, Mobile Money)" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="input-base" />
              <label htmlFor="expense-paid-by-who" className="sr-only">Paid by who</label>
              <input id="expense-paid-by-who" name="paid_by_who" type="text" placeholder="Paid by who" value={paidByWho} onChange={(e) => setPaidByWho(e.target.value)} className="input-base" />
              <label htmlFor="expense-notes" className="sr-only">Notes</label>
              <textarea id="expense-notes" name="notes" rows={2} style={{ resize: 'vertical' }} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base min-h-[4rem]" />
            <button
              type="submit"
              disabled={formStatus === 'saving' || !!amountError || !!purposeError}
                className={`btn-primary disabled:opacity-50 ${formStatus === 'success' ? '!bg-green-600 hover:!bg-green-700' : ''}`}
                style={formStatus === 'saving' ? { cursor: 'wait' } : undefined}
              >
                {formStatus === 'saving' ? 'Saving…' : formStatus === 'success' ? '✓ Expense Added!' : 'Add Expense'}
              </button>
            </form>
            {apiErrorMessage && (
              <p className="mt-2 text-footnote text-red-600">Failed to save. Try again.</p>
            )}
          </section>

          {/* Task 2 — Spending by Purpose */}
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-sans text-[15px] font-semibold text-primary">
                Spending by purpose
              </h2>
            </div>
            <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
              {LIST_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBreakdownPeriod(p)}
                  className={`rounded-md px-3 py-1.5 text-subhead font-medium capitalize ${breakdownPeriod === p ? 'bg-white text-smoky-black shadow' : 'text-slate-600 hover:text-smoky-black'}`}
                >
                  {p === 'all' ? 'All' : p}
                </button>
              ))}
            </div>
            {breakdownMetrics.byPurpose.length === 0 ? (
              <p className="py-4 text-center text-footnote text-slate-500">No expenses in this period.</p>
            ) : (
              <div className="space-y-3">
                {breakdownMetrics.byPurpose.map((row) => {
                  const grandTotal = breakdownMetrics.periodTotal || 1;
                  const pct = (row.total / grandTotal) * 100;
                  const sparkValues = last6MonthKeys.map(
                    (k) => breakdownMetrics.last6MonthsByPurpose[k]?.[row.purpose] ?? 0
                  );
                  const maxVal = Math.max(...sparkValues, 1);
                  const points = sparkValues
                    .map((v, i) => `${(i / 5) * 64},${24 - (v / maxVal) * 24}`)
                    .join(' ');
                  return (
                    <div key={row.purpose} className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="text-sm font-medium">
                        {row.purpose} (×{row.count})
                      </span>
                      <svg width={64} height={24} className="shrink-0" aria-hidden>
                        <polyline
                          fill="none"
                          stroke={row.color}
                          strokeWidth="1.5"
                          points={points}
                        />
                      </svg>
                      <span className="ml-auto"><Money value={row.total} abbreviated size="body" className="font-medium" /></span>
                      <span className="text-caption2 text-slate-500">{(pct).toFixed(1)}%</span>
                      <div className="w-full overflow-hidden rounded-full bg-slate-100" style={{ height: 4 }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: row.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Task 3 — Quick Stats */}
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-sans text-[15px] font-semibold text-primary">
                This month — quick stats
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatCardSM
                label="Avg per day"
                value={formatUGXShort(Math.round(metrics.avgPerDay))}
                fullValue={formatUGX(Math.round(metrics.avgPerDay))}
              />
              <StatCardSM
                label="Biggest expense"
                value={
                  metrics.biggestExpense
                    ? formatUGXShort(metrics.biggestExpense.amount)
                    : '—'
                }
                fullValue={
                  metrics.biggestExpense
                    ? formatUGX(metrics.biggestExpense.amount)
                    : undefined
                }
              />
              <StatCardSM
                label="Top purpose"
                value={metrics.topPurpose?.purpose ?? '—'}
              />
              <StatCardSM
                label="Top spender"
                value={metrics.topPayer?.who ?? '—'}
              />
            </div>
          </section>
        </div>

        {/* Right column: Recent expenses list */}
        <section className="card overflow-hidden flex flex-col">
          <h2 className="border-b border-slate-200/80 bg-slate-50/50 px-5 py-4 font-sans text-title3 font-semibold text-smoky-black">Recent expenses</h2>

          {/* Task 4 — Filter controls */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-slate-50/30 px-4 py-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
              {LIST_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setListPeriod(p)}
                  className={`rounded-md px-2 py-1.5 text-caption2 font-medium capitalize ${listPeriod === p ? 'bg-white shadow' : 'text-slate-600'}`}
                >
                  {p === 'all' ? 'All' : p}
                </button>
              ))}
            </div>
            <select
              value={listPurpose}
              onChange={(e) => setListPurpose(e.target.value)}
              className="input-base max-w-[140px] py-1.5 text-sm"
            >
              <option value="All">All</option>
              {purposesInData.filter((p) => p !== 'All').map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={listPaidByWho}
              onChange={(e) => setListPaidByWho(e.target.value)}
              className="input-base max-w-[120px] py-1.5 text-sm"
            >
              {PAID_BY_WHO_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <input
              type="search"
              placeholder="Search…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base max-w-[140px] py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={handleExportCSV}
              className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ⬇ CSV
            </button>
          </div>

          {/* Task 5e — List header */}
          <div className="flex justify-end px-5 py-2 text-right text-footnote text-slate-500">
            {filteredList.length} entries · <Money value={visibleTotal} abbreviated size="body" />
          </div>

          <div className="max-h-[560px] overflow-y-auto">
            {emptyDb && (
              <p className="py-12 text-center text-slate-500">No expenses yet. Add your first one using the form.</p>
            )}
            {emptyPeriod && !emptyDb && (
              <p className="py-12 text-center text-slate-500">
                No expenses recorded {listPeriod === 'today' ? 'today' : listPeriod === 'week' ? 'this week' : 'this month'}.
              </p>
            )}
            {emptySearch && (
              <p className="py-12 text-center text-slate-500">No results for &quot;{searchTerm}&quot;.</p>
            )}
            {emptyFilter && !emptySearch && (
              <p className="py-12 text-center text-slate-500">
                {listPurpose !== 'All' ? `No ${listPurpose} expenses in this period.` : 'No expenses in this period.'}
              </p>
            )}
            {!emptyDb && filteredList.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {filteredList.map((e) => {
                  const runTotal = runningTotalByExpenseId.get(e.id);
                  const purposeColor = PURPOSE_COLORS[normPurpose(e.purpose)] ?? PURPOSE_COLORS[UNCATEGORIZED_LABEL] ?? '#adb5bd';
                  const isHover = hoverRowId === e.id;
                  return (
                    <li
                      key={e.id}
                      onMouseEnter={() => setHoverRowId(e.id)}
                      onMouseLeave={() => setHoverRowId(null)}
                      className="relative flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50/50"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: purposeColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{e.itemBought}</p>
                        <p className="flex flex-wrap items-center gap-1.5 text-subhead text-slate-600">
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: `${purposeColor}26`, color: purposeColor }}
                          >
                            {normPurpose(e.purpose)}
                          </span>
                          {format(new Date(e.date), 'dd MMM yyyy')} · {e.paidBy}
                        </p>
                        {isHover && runTotal != null && isThisMonth(e.date) && (
                          <p className="mt-1 text-footnote text-slate-400">
                            month total<br />
                            <Money value={runTotal} size="small" className="font-medium" />
                          </p>
                        )}
                      </div>
                      <span className="shrink-0"><Money value={e.amount} size="body" className="font-medium text-red-700" /></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Task 5d — Footer */}
          {filteredList.length > 0 && (
            <div className="mt-auto border-t border-slate-200/80 bg-slate-50/50 px-5 py-3 text-right text-body">
              <span className="font-medium">Total · {filteredList.length} entries</span>
              <span className="ml-2"><Money value={visibleTotal} size="medium" className="font-semibold" /></span>
            </div>
          )}

          {/* Task 8 — Reports link */}
          <div className="border-t border-slate-200/80 px-5 py-3">
            <Link
              to="/reports?section=expenses"
              className="text-footnote text-slate-500 hover:text-tufts-blue hover:underline"
            >
              📊 See full expense analytics &amp; breakdowns in Reports →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
