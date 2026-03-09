import { useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { useOrders, useExpenses, useProducts, useCustomers, useSupplierLedger } from '@/hooks/useData';
import { useDayBoundaryTick } from '@/hooks/useDayBoundaryTick';
import { usePeriodRange, type PeriodType } from '@/hooks/usePeriodRange';
import { useLowStockMetrics } from '@/hooks/useLowStockMetrics';
import { useCustomerSummary } from '@/hooks/useCustomerSummary';
import {
  useReportPeriodData,
  useBreakEvenMetrics,
  useHourlyMetrics,
  useReturnMetrics,
  usePaymentMetrics,
  useChannelMetrics,
  useProductMetrics,
  useExpenseMetrics,
  useCustomerMetrics,
  useInventoryHealth,
  usePeriodMetricsCore,
} from '@/hooks/reports';
import { formatUGX } from '@/lib/formatUGX';
import { Money } from '@/components/Money';
import { getDailyGoals, setDailyGoals, getEffectiveDailyGoals, type DailyGoals } from '@/lib/dailyGoalsStorage';
import {
  getTodayInAppTz,
  getStartOfDayAppTzAsUTC,
  getWeekRangeInAppTz,
} from '@/lib/appTimezone';
import { getChannelLabel } from '@/lib/orderConstants';
import { TrendingUp, TrendingDown, Package, CreditCard, ShoppingCart, BarChart3, Receipt, Printer, FileText, ChevronRight, ChevronDown, Settings, X, Store, Globe, MessageCircle, Share2, Users, Download } from 'lucide-react';

/** Max rows to show before collapsing the rest into a "Show more" section */
const INITIAL_LIST_SIZE = 8;
import { exportToCSV } from '@/utils/exportUtils';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Bar, LineChart, Line, ComposedChart, PieChart, Pie, Cell } from 'recharts';

export default function ReportsPage() {
  const { theme } = useTheme();
  const { data: ordersList, loading } = useOrders({ realtime: true });
  const { data: expensesList } = useExpenses({ realtime: true });
  const { data: productsList } = useProducts({ realtime: true });
  useCustomers({ realtime: true });
  const { data: supplierLedgerList } = useSupplierLedger({ realtime: true });
  useDayBoundaryTick();
  const isDark = theme === 'dark';
  const chartTooltipStyle = isDark
    ? { backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '8px', color: '#e5e7eb' }
    : { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a' };
  const chartGridStroke = isDark ? '#1f2937' : '#e2e8f0';
  const chartAxisStroke = isDark ? '#9ca3af' : '#64748b';

  const [dailyGoals, setDailyGoalsState] = useState<DailyGoals>(() => getDailyGoals());
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  useEffect(() => {
    setDailyGoalsState(getDailyGoals());
  }, [goalsModalOpen]);
  const { '*': splat } = useParams();
  const period: PeriodType = splat === 'weekly' ? 'weekly' : splat === 'monthly' ? 'monthly' : splat === 'yearly' ? 'yearly' : 'daily';

  const periodRange = usePeriodRange(period);
  const { current, previous, currentDateStr, previousDateStr } = periodRange;
  const lowStockMetrics = useLowStockMetrics(productsList || []);
  const customerSummary = useCustomerSummary(ordersList ?? [], period);

  const todayStr = getTodayInAppTz();

  const reportData = useReportPeriodData(
    ordersList ?? [],
    expensesList ?? [],
    productsList ?? [],
    current,
    previous,
    currentDateStr,
    previousDateStr,
    todayStr
  );

  const {
    ordersToday,
    revenueToday,
    profitToday,
    expensesToday,
    ordersYesterday,
    revenueYesterday,
    profitYesterday,
    ordersTodayPct,
    revenueTodayPct,
    profitTodayPct,
    expensesTodayPct,
    last7DaysSparkline,
    ordersPeriod,
    revenuePeriod,
    profitPeriod,
    expensesPeriod,
    previousPeriodOrders,
    previousPeriodRevenue,
    previousPeriodProfit,
    previousPeriodExpenses,
    allOrders,
    allExpenses,
    allProducts,
    periodExpList,
    prevPeriodExpList,
  } = reportData;

  const effectiveGoals = useMemo(
    () =>
      getEffectiveDailyGoals(dailyGoals, {
        revenue: revenueYesterday,
        orders: ordersYesterday,
        profit: profitYesterday,
      }),
    [dailyGoals, revenueYesterday, ordersYesterday, profitYesterday]
  );

  const periodOrders = useMemo(
    () => allOrders.filter((o) => o.createdAt >= current.from && o.createdAt < current.to),
    [allOrders, current.from, current.to]
  );

  const breakEven = useBreakEvenMetrics(
    allOrders,
    periodExpList,
    period,
    currentDateStr,
    currentDateStr.to,
    revenuePeriod,
    profitPeriod
  );
  const hourly = useHourlyMetrics(allOrders, period, todayStr);
  const productsArray = allProducts as Array<{ id: string; name?: string; stock?: number }>;
  const returnMetrics = useReturnMetrics(periodOrders, productsArray, ordersPeriod);
  const paymentBreakdown = usePaymentMetrics(periodOrders);
  const channelBreakdown = useChannelMetrics(periodOrders);
  const topProducts = useProductMetrics(periodOrders, productsArray);
  const expenseMetrics = useExpenseMetrics(periodExpList, prevPeriodExpList);
  const customerMetrics = useCustomerMetrics(
    periodOrders,
    allOrders,
    current,
    customerSummary.uniqueCustomers,
    ordersPeriod,
    Number(revenuePeriod) || 0
  );
  const inventoryHealth = useInventoryHealth(
    allOrders,
    productsArray,
    lowStockMetrics.lowStockCount
  );
  const core = usePeriodMetricsCore(
    allOrders,
    allExpenses,
    periodOrders,
    periodExpList,
    prevPeriodExpList,
    period,
    currentDateStr,
    todayStr,
    revenuePeriod,
    profitPeriod,
    expensesPeriod,
    ordersPeriod,
    previousPeriodRevenue,
    previousPeriodProfit,
    previousPeriodOrders,
    previousPeriodExpenses,
    supplierLedgerList
  );

  const periodMetrics = useMemo(
    () => ({
      grossProfit: Number(profitPeriod) || 0,
      previousPeriodGrossProfit: Number(previousPeriodProfit) || 0,
      grossIncome: core.grossIncome,
      expenses: Number(expensesPeriod) || 0,
      restockExpenses: core.restockExpenses,
      operatingExpenses: core.operatingExpenses,
      operatingExpensesGrowth: core.operatingExpensesGrowth,
      restockExpensesGrowth: core.restockExpensesGrowth,
      netProfit: core.netProfit,
      avgOrderValue: core.avgOrderValue,
      profitMargin: core.profitMargin,
      netProfitMargin: core.netProfitMargin,
      topProducts,
      paymentBreakdown,
      channelBreakdown,
      expensesByPurpose: expenseMetrics.expensesByPurpose,
      lowStockCount: lowStockMetrics.lowStockCount,
      lowStockValue: lowStockMetrics.lowStockValue,
      uniqueCustomers: customerSummary.uniqueCustomers,
      returnRate: returnMetrics.returnRate,
      returnOrders: returnMetrics.returnOrders,
      revenueGrowth: core.revenueGrowth,
      profitGrowth: core.profitGrowth,
      ordersGrowth: core.ordersGrowth,
      expenseGrowth: core.expenseGrowth,
      netProfitGrowth: core.netProfitGrowth,
      timeSeriesData: core.timeSeriesData,
      grossProfitHistory: core.grossProfitHistory,
      bestProfitPeriodLabel: core.bestProfitPeriodLabel,
      worstProfitPeriodLabel: core.worstProfitPeriodLabel,
      hourlyBreakdown: hourly.hourlyBreakdown,
      peakRevenueHour: hourly.peakRevenueHour,
      cashFlowWaterfall: core.cashFlowWaterfall,
      fixedCosts: breakEven.fixedCosts,
      breakEvenRevenue: breakEven.breakEvenRevenue,
      breakEvenProgress: breakEven.breakEvenProgress,
      breakEvenReached: breakEven.breakEvenReached,
      breakEvenDay: breakEven.breakEvenDay,
      returningCustomerRate: customerSummary.returningCustomerRate,
      revenuePerCustomer: customerMetrics.revenuePerCustomer,
      avgVisitsPerCustomer: customerMetrics.avgVisitsPerCustomer,
      costToRevenueRatio: core.costToRevenueRatio,
      newCustomersCount: customerMetrics.newCustomersCount,
      returningCustomersCount: customerMetrics.returningCustomersCount,
      atRiskCount: customerSummary.atRiskCount,
      topCustomersBySpend: customerMetrics.topCustomersBySpend,
      lowStockTable: lowStockMetrics.lowStockTable,
      deadStockCount: inventoryHealth.deadStockCount,
      inventoryHealthScore: inventoryHealth.inventoryHealthScore,
      totalRefunded: returnMetrics.totalRefunded,
      topReturnedProducts: returnMetrics.topReturnedProducts,
    }),
    [
      profitPeriod,
      previousPeriodProfit,
      expensesPeriod,
      core,
      breakEven,
      hourly,
      returnMetrics,
      paymentBreakdown,
      channelBreakdown,
      topProducts,
      expenseMetrics.expensesByPurpose,
      lowStockMetrics,
      customerSummary,
      customerMetrics,
      inventoryHealth,
    ]
  );

  if (loading) {
    return (
      <div className="report-page p-4 sm:p-6 space-y-6">
        <div className="h-8 w-48 report-skeleton rounded" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-20 report-skeleton rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="report-card p-4 sm:p-5 h-28 report-skeleton rounded-xl" />
          ))}
        </div>
        <div className="report-card p-4 sm:p-5 h-48 report-skeleton rounded-xl" />
      </div>
    );
  }

  const periodLabel = periodRange.periodLabel;
  const prevPeriodLabel = periodRange.prevPeriodLabel;

  // Report period date range and generated time for stakeholders
  const REPORT_BUSINESS_NAME = 'Mars Kitchen Essentials';
  const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', day: 'numeric', month: 'short', year: 'numeric' });
  let periodRangeLabel = formatDate(getStartOfDayAppTzAsUTC(todayStr));
  if (period === 'weekly') {
    const w = getWeekRangeInAppTz(todayStr);
    const endDate = new Date(new Date(w.end).getTime() - 1);
    periodRangeLabel = `${formatDate(new Date(w.start))} – ${formatDate(endDate)}`;
  } else if (period === 'monthly') {
    const [y, m] = todayStr.split('-').map(Number);
    const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate();
    periodRangeLabel = `1 ${new Date(2000, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })} – ${lastD} ${new Date(2000, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })} ${y}`;
  } else if (period === 'yearly') {
    const [y] = todayStr.split('-').map(Number);
    periodRangeLabel = `1 Jan – 31 Dec ${y}`;
  }
  const generatedAt = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' });

  const ChangeBadge = ({ value, inverse }: { value: number; inverse?: boolean }) => {
    if (value === 0) return null;
    const improved = inverse ? value < 0 : value > 0;
    const color = improved ? 'report-accent-teal' : 'report-accent-red';
    return (
      <span className={`flex items-center gap-1 text-xs ${color}`}>
        {value > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {value > 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    );
  };

  const Sparkline = ({ dataKey, data }: { dataKey: 'orders' | 'revenue' | 'profit' | 'expenses'; data: typeof last7DaysSparkline }) => (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey={dataKey} stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div className="report-page space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="report-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">Reports &amp; Analytics</h1>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#1f2937] bg-white dark:bg-[#111827] px-4 py-2.5 sm:px-5 text-sm font-medium text-slate-800 dark:text-[#e5e7eb] hover:border-slate-400 dark:hover:border-[#374151] min-h-[2.75rem] sm:min-h-0 no-print"
            aria-label="Print or save as PDF"
          >
            <Printer className="h-4 w-4 shrink-0" />
            <span>Print</span><span className="hidden sm:inline"> / Save as PDF</span>
          </button>
          <Link to="/" className="inline-flex w-fit items-center rounded-xl border border-slate-200 dark:border-[#1f2937] bg-white dark:bg-[#111827] px-4 py-2.5 sm:px-5 text-sm font-medium text-slate-800 dark:text-[#e5e7eb] hover:border-slate-400 dark:hover:border-[#374151] min-h-[2.75rem] sm:min-h-0 no-print">
            ← Dashboard
          </Link>
        </div>
      </div>

      <nav className="flex gap-2 no-print sticky top-0 z-10 bg-background-grey dark:bg-[#0d1117] py-2 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto overflow-y-hidden -mb-1 scrollbar-none" aria-label="Report period" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-2 flex-nowrap min-w-0">
          <Link
            to="/reports/daily"
            className={`shrink-0 rounded-xl px-4 py-2.5 font-medium transition min-h-[2.75rem] flex items-center ${
              period === 'daily' ? 'bg-[#f59e0b] text-[#0d1117]' : 'border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-[#9ca3af] hover:border-slate-400 dark:hover:border-[#374151]'
            }`}
          >
            Daily
          </Link>
          <Link
            to="/reports/weekly"
            className={`shrink-0 rounded-xl px-4 py-2.5 font-medium transition min-h-[2.75rem] flex items-center ${
              period === 'weekly' ? 'bg-[#f59e0b] text-[#0d1117]' : 'border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-[#9ca3af] hover:border-slate-400 dark:hover:border-[#374151]'
            }`}
          >
            Weekly
          </Link>
          <Link
            to="/reports/monthly"
            className={`shrink-0 rounded-xl px-4 py-2.5 font-medium transition min-h-[2.75rem] flex items-center ${
              period === 'monthly' ? 'bg-[#f59e0b] text-[#0d1117]' : 'border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-[#9ca3af] hover:border-slate-400 dark:hover:border-[#374151]'
            }`}
          >
            Monthly
          </Link>
          <Link
            to="/reports/yearly"
            className={`shrink-0 rounded-xl px-4 py-2.5 font-medium transition min-h-[2.75rem] flex items-center ${
              period === 'yearly' ? 'bg-[#f59e0b] text-[#0d1117]' : 'border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-[#9ca3af] hover:border-slate-400 dark:hover:border-[#374151]'
            }`}
          >
            Yearly
          </Link>
        </div>
      </nav>

      {/* Today's Summary — real-time, % vs same day last week, 7-day sparkline */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 no-print">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Today&apos;s summary</span>
        <button
          type="button"
          onClick={() => exportToCSV('today_summary', ['Metric', 'Value', 'vs Last Week'], [
            ['Orders', ordersToday, ordersTodayPct !== 0 ? `${ordersTodayPct > 0 ? '+' : ''}${ordersTodayPct.toFixed(1)}%` : '—'],
            ['Revenue (UGX)', revenueToday, revenueTodayPct !== 0 ? `${revenueTodayPct > 0 ? '+' : ''}${revenueTodayPct.toFixed(1)}%` : '—'],
            ['Gross Profit (UGX)', profitToday, profitTodayPct !== 0 ? `${profitTodayPct > 0 ? '+' : ''}${profitTodayPct.toFixed(1)}%` : '—'],
            ['Operating Expenses (UGX)', expensesToday, expensesTodayPct !== 0 ? `${expensesTodayPct > 0 ? '+' : ''}${expensesTodayPct.toFixed(1)}%` : '—'],
          ])}
          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#1f2937] px-2 py-1 text-xs text-slate-500 dark:text-[#9ca3af] hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="report-card p-4 sm:p-5">
          <p className="text-xs sm:text-sm report-muted">Today – Orders</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">{ordersToday}</p>
          {ordersTodayPct !== 0 && <ChangeBadge value={ordersTodayPct} />}
          <div className="mt-2 h-8">
            <Sparkline dataKey="orders" data={last7DaysSparkline} />
          </div>
        </div>
        <div className="report-card p-4 sm:p-5">
          <p className="text-xs sm:text-sm report-muted">Today – Revenue</p>
          <p className="text-lg sm:text-2xl font-bold report-accent-teal truncate"><Money value={revenueToday} className="text-lg sm:text-2xl font-bold report-accent-teal" /></p>
          {revenueTodayPct !== 0 && <ChangeBadge value={revenueTodayPct} />}
          <div className="mt-2 h-8">
            <Sparkline dataKey="revenue" data={last7DaysSparkline} />
          </div>
        </div>
        <div className="report-card p-4 sm:p-5">
          <p className="text-xs sm:text-sm report-muted">Today – Gross Profit</p>
          <p className="text-lg sm:text-2xl font-bold report-accent-teal truncate"><Money value={profitToday} className="text-lg sm:text-2xl font-bold report-accent-teal" /></p>
          {profitTodayPct !== 0 && <ChangeBadge value={profitTodayPct} />}
          <div className="mt-2 h-8">
            <Sparkline dataKey="profit" data={last7DaysSparkline} />
          </div>
        </div>
        <div className="report-card p-4 sm:p-5">
          <p className="text-xs sm:text-sm report-muted">Today – Operating Expenses</p>
          <p className="text-lg sm:text-2xl font-bold report-accent-red truncate"><Money value={expensesToday} className="text-lg sm:text-2xl font-bold report-accent-red" /></p>
          {expensesTodayPct !== 0 && <ChangeBadge value={expensesTodayPct} inverse />}
          <div className="mt-2 h-8">
            <Sparkline dataKey="expenses" data={last7DaysSparkline} />
          </div>
        </div>
      </div>

      {/* Daily Goals Tracker — general target or yesterday's actual if higher */}
      <div className="report-card p-4 sm:p-5 no-print">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">Daily Goals</h2>
          <button
            type="button"
            onClick={() => setGoalsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#1f2937] bg-white dark:bg-[#111827] px-3 py-2 text-sm text-slate-500 dark:text-[#9ca3af] hover:border-slate-400 dark:hover:border-[#374151] hover:text-slate-900 dark:hover:text-white"
            aria-label="Edit daily goals"
          >
            <Settings className="h-4 w-4" />
            Set targets
          </button>
        </div>
        <p className="text-xs report-muted mb-3">Target = your set goal, or yesterday&apos;s actual if it was higher.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm report-muted mb-1">Revenue</p>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-[#1f2937] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#34d399] transition-all"
                style={{ width: `${effectiveGoals.revenueTarget > 0 ? Math.min(100, (revenueToday / effectiveGoals.revenueTarget) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs report-muted mt-1"><Money value={revenueToday} className="report-muted" /> / <Money value={effectiveGoals.revenueTarget} className="report-muted" /></p>
          </div>
          <div>
            <p className="text-sm report-muted mb-1">Orders</p>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-[#1f2937] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#34d399] transition-all"
                style={{ width: `${effectiveGoals.ordersTarget > 0 ? Math.min(100, (ordersToday / effectiveGoals.ordersTarget) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs report-muted mt-1">{ordersToday} / {effectiveGoals.ordersTarget}</p>
          </div>
          <div>
            <p className="text-sm report-muted mb-1">Profit</p>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-[#1f2937] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#34d399] transition-all"
                style={{ width: `${effectiveGoals.profitTarget > 0 ? Math.min(100, (profitToday / effectiveGoals.profitTarget) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs report-muted mt-1"><Money value={profitToday} className="report-muted" /> / <Money value={effectiveGoals.profitTarget} className="report-muted" /></p>
          </div>
        </div>
      </div>

      {/* Daily Goals settings modal */}
      {goalsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="goals-modal-title">
          <div className="report-card w-full max-w-md p-4 sm:p-6 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 id="goals-modal-title" className="report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">Daily targets</h3>
              <button type="button" onClick={() => setGoalsModalOpen(false)} className="p-1 text-slate-500 dark:text-[#9ca3af] hover:text-slate-900 dark:hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const revenueTarget = Number((form.querySelector('[name="revenueTarget"]') as HTMLInputElement)?.value) || 0;
                const ordersTarget = Number((form.querySelector('[name="ordersTarget"]') as HTMLInputElement)?.value) || 0;
                const profitTarget = Number((form.querySelector('[name="profitTarget"]') as HTMLInputElement)?.value) || 0;
                const next = { revenueTarget, ordersTarget, profitTarget };
                setDailyGoals(next);
                setDailyGoalsState(next);
                setGoalsModalOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="goals-revenue" className="block text-sm font-medium text-slate-700 dark:text-[#e5e7eb] mb-1">Revenue target (UGX)</label>
                <input id="goals-revenue" name="revenueTarget" type="number" min={0} step={1000} defaultValue={dailyGoals.revenueTarget} className="input-base w-full rounded-lg" />
              </div>
              <div>
                <label htmlFor="goals-orders" className="block text-sm font-medium text-slate-700 dark:text-[#e5e7eb] mb-1">Orders target</label>
                <input id="goals-orders" name="ordersTarget" type="number" min={0} step={1} defaultValue={dailyGoals.ordersTarget} className="input-base w-full rounded-lg" />
              </div>
              <div>
                <label htmlFor="goals-profit" className="block text-sm font-medium text-slate-700 dark:text-[#e5e7eb] mb-1">Profit target (UGX)</label>
                <input id="goals-profit" name="profitTarget" type="number" min={0} step={1000} defaultValue={dailyGoals.profitTarget} className="input-base w-full rounded-lg" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setGoalsModalOpen(false)} className="rounded-lg border border-slate-200 dark:border-[#1f2937] px-4 py-2 text-sm text-slate-500 dark:text-[#9ca3af] hover:bg-slate-100 dark:hover:bg-[#1f2937]">Cancel</button>
                <button type="submit" className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-medium text-[#0d1117]">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Period Overview — all metrics with % change vs previous period */}
      <div className="report-card p-4 sm:p-5">
        <h2 className="mb-4 flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
          <BarChart3 className="h-5 w-5 report-accent-blue shrink-0" />
          {periodLabel} Overview
        </h2>
        <div className="grid gap-4 grid-cols-1 min-w-0 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <p className="text-sm report-muted">Orders</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{ordersPeriod}</p>
              {periodMetrics.ordersGrowth !== 0 && <ChangeBadge value={periodMetrics.ordersGrowth} />}
            </div>
            <p className="text-xs report-muted">vs {prevPeriodLabel}: {previousPeriodOrders}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm report-muted">Revenue</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xl font-bold report-accent-teal truncate"><Money value={periodMetrics.grossIncome} className="text-xl font-bold report-accent-teal" /></p>
              {periodMetrics.revenueGrowth !== 0 && <ChangeBadge value={periodMetrics.revenueGrowth} />}
            </div>
            <p className="text-xs report-muted truncate">vs {prevPeriodLabel}: <Money value={previousPeriodRevenue} className="report-muted" /></p>
          </div>
          <div className="min-w-0">
            <p className="text-sm report-muted">Gross Profit</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xl font-bold report-accent-teal"><Money value={periodMetrics.grossProfit} className="text-xl font-bold report-accent-teal" /></p>
              {periodMetrics.profitGrowth !== 0 && <ChangeBadge value={periodMetrics.profitGrowth} />}
            </div>
            <p className="text-xs report-muted">vs {prevPeriodLabel}: <Money value={periodMetrics.previousPeriodGrossProfit} className="report-muted" /></p>
          </div>
          <div className="min-w-0">
            <p className="text-sm report-muted">Gross Margin %</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xl font-bold report-accent-teal">{periodMetrics.profitMargin.toFixed(1)}%</p>
            </div>
            <p className="text-xs report-muted">Gross profit / Revenue × 100</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm report-muted">Operating Expenses</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xl font-bold report-accent-red"><Money value={periodMetrics.operatingExpenses} className="text-xl font-bold report-accent-red" /></p>
              {periodMetrics.operatingExpensesGrowth !== 0 && <ChangeBadge value={periodMetrics.operatingExpensesGrowth} inverse />}
            </div>
            <p className="text-xs report-muted">excl. Stock</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm report-muted">Restock Expenses</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xl font-bold text-[#f59e0b]"><Money value={periodMetrics.restockExpenses} className="text-xl font-bold text-[#f59e0b]" /></p>
              {periodMetrics.restockExpensesGrowth !== 0 && <ChangeBadge value={periodMetrics.restockExpensesGrowth} inverse />}
            </div>
            <p className="text-xs report-muted">Stock purchases (not deducted from profit)</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm report-muted">Net Profit</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className={`text-xl font-bold ${periodMetrics.netProfit >= 0 ? 'report-accent-teal' : 'report-accent-red'}`}>
                <Money value={periodMetrics.netProfit} className="font-semibold" />
              </p>
              {periodMetrics.netProfitGrowth !== 0 && <ChangeBadge value={periodMetrics.netProfitGrowth} />}
            </div>
            <p className="text-xs report-muted">Gross profit − Operating expenses</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm report-muted">Net Margin %</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className={`text-xl font-bold ${periodMetrics.netProfitMargin >= 0 ? 'report-accent-teal' : 'report-accent-red'}`}>
                {periodMetrics.netProfitMargin.toFixed(1)}%
              </p>
            </div>
            <p className="text-xs report-muted">Net profit / Revenue × 100</p>
          </div>
        </div>
      </div>

      {/* Cash Flow Waterfall */}
      {periodMetrics.cashFlowWaterfall.length > 0 && (
        <div className="report-card p-4 sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
            <BarChart3 className="h-5 w-5 report-accent-blue shrink-0" />
            Cash Flow Waterfall ({periodLabel})
          </h3>
          <ul className="space-y-2">
            {periodMetrics.cashFlowWaterfall.slice(0, INITIAL_LIST_SIZE).map((row, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 sm:py-1.5 border-b border-slate-200 dark:border-[#1f2937] last:border-0 min-w-0">
                <span className="report-muted text-sm truncate min-w-0">
                  {row.type === 'inflow' && '+'}
                  {row.type === 'outflow' && '-'}
                  {row.type === 'subtotal' && '='}
                  {' '}{row.label}
                </span>
                <span
                  className={`font-medium tabular-nums ${
                    row.type === 'inflow' ? 'report-accent-teal' : row.type === 'outflow' ? 'report-accent-red' : 'text-[#f59e0b]'
                  }`}
                >
                  <Money value={row.value} className="report-accent-teal" />
                </span>
              </li>
            ))}
          </ul>
          {periodMetrics.cashFlowWaterfall.length > INITIAL_LIST_SIZE && (
            <details className="no-print group mt-1">
              <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm report-muted hover:text-slate-900 dark:hover:text-slate-100">
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                Show {periodMetrics.cashFlowWaterfall.length - INITIAL_LIST_SIZE} more line items
              </summary>
              <ul className="space-y-2 mt-1">
                {periodMetrics.cashFlowWaterfall.slice(INITIAL_LIST_SIZE).map((row, i) => (
                  <li key={INITIAL_LIST_SIZE + i} className="flex items-center justify-between gap-3 py-2 sm:py-1.5 border-b border-slate-200 dark:border-[#1f2937] last:border-0 min-w-0">
                    <span className="report-muted text-sm truncate min-w-0">
                      {row.type === 'inflow' && '+'}
                      {row.type === 'outflow' && '-'}
                      {row.type === 'subtotal' && '='}
                      {' '}{row.label}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        row.type === 'inflow' ? 'report-accent-teal' : row.type === 'outflow' ? 'report-accent-red' : 'text-[#f59e0b]'
                      }`}
                    >
                      <Money value={row.value} className="report-accent-teal" />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Sales by Hour (daily only) — revenue bars, profit line, table, peak hour highlight */}
      {period === 'daily' && periodMetrics.hourlyBreakdown.length > 0 && (
        <div className="report-card p-4 sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
            <BarChart3 className="h-5 w-5 report-accent-blue shrink-0" />
            Sales by Hour (Today)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={periodMetrics.hourlyBreakdown} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis dataKey="hourLabel" stroke={chartAxisStroke} fontSize={11} />
              <YAxis stroke={chartAxisStroke} fontSize={11} tickFormatter={(v) => formatUGX(v)} />
              <Tooltip
                formatter={(value: number) => formatUGX(value)}
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => `Hour ${label}`}
              />
              <Bar dataKey="revenue" fill="#34d399" name="Revenue" radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="profit" stroke="#f59e0b" strokeWidth={2} name="Gross Profit" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-4 report-table-wrap max-h-[320px] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                  <th className="px-3 py-2 text-left report-muted sticky top-0 bg-white dark:bg-[#111827]">Hour</th>
                  <th className="px-3 py-2 text-right report-muted sticky top-0 bg-white dark:bg-[#111827]">Orders</th>
                  <th className="px-3 py-2 text-right report-muted sticky top-0 bg-white dark:bg-[#111827]">Revenue</th>
                  <th className="px-3 py-2 text-right report-muted sticky top-0 bg-white dark:bg-[#111827]">Gross Profit</th>
                  <th className="px-3 py-2 text-right report-muted sticky top-0 bg-white dark:bg-[#111827]">Avg Order Value</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.hourlyBreakdown.map((h) => (
                  <tr
                    key={h.hour}
                    className={`border-b border-slate-200/80 dark:border-[#1f2937]/50 ${periodMetrics.peakRevenueHour === h.hour && h.revenue > 0 ? 'bg-[#f59e0b]/15' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {h.hourLabel}
                      {periodMetrics.peakRevenueHour === h.hour && h.revenue > 0 && (
                        <span className="ml-2 text-xs text-[#f59e0b]">Peak</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-[#e5e7eb]">{h.orders}</td>
                    <td className="px-3 py-2 text-right report-accent-teal"><Money value={h.revenue} className="report-accent-teal" /></td>
                    <td className="px-3 py-2 text-right text-[#f59e0b]"><Money value={h.profit} className="text-[#f59e0b]" /></td>
                    <td className="px-3 py-2 text-right report-muted"><Money value={h.avgOrderValue} className="report-muted" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {periodMetrics.hourlyBreakdown.every((h) => h.orders === 0) && (
            <p className="mt-3 text-sm report-muted">No sales yet today.</p>
          )}
        </div>
      )}

      {/* Gross Profit History — vs Previous %, highlight best/worst */}
      {periodMetrics.grossProfitHistory.length > 0 && (
        <div className="report-card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
              <TrendingUp className="h-5 w-5 report-accent-blue shrink-0" />
              Gross Profit History
            </h3>
            <button
              type="button"
              onClick={() => exportToCSV('profit_history', ['Period', 'Orders', 'Revenue (UGX)', 'Gross Profit (UGX)', 'Margin %', 'vs Previous'], periodMetrics.grossProfitHistory.map((row: { periodLabel: string; orders: number; revenue: number; grossProfit: number; marginPct: number; vsPreviousPct?: number | null }) => [
                row.periodLabel, row.orders, row.revenue, row.grossProfit, row.marginPct.toFixed(1), row.vsPreviousPct != null ? `${row.vsPreviousPct >= 0 ? '+' : ''}${row.vsPreviousPct.toFixed(1)}%` : '—',
              ]))}
              className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#1f2937] px-2.5 py-2 min-h-[2.25rem] sm:min-h-0 text-xs text-slate-500 dark:text-[#9ca3af] hover:text-slate-900 dark:hover:text-slate-100 no-print touch-manipulation"
            >
              <Download className="h-3.5 w-3.5 shrink-0" /> CSV
            </button>
          </div>
          <div className="report-table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                  <th className="px-3 py-2 text-left report-muted">Period</th>
                  <th className="px-3 py-2 text-right report-muted">Orders</th>
                  <th className="px-3 py-2 text-right report-muted">Revenue</th>
                  <th className="px-3 py-2 text-right report-muted">Gross Profit</th>
                  <th className="px-3 py-2 text-right report-muted">Margin %</th>
                  <th className="px-3 py-2 text-right report-muted">vs Previous</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.grossProfitHistory.slice(0, INITIAL_LIST_SIZE).map((row: { periodLabel: string; orders: number; revenue: number; grossProfit: number; marginPct: number; vsPreviousPct?: number | null }, idx) => {
                  const isBest = row.periodLabel === periodMetrics.bestProfitPeriodLabel;
                  const isWorst = row.periodLabel === periodMetrics.worstProfitPeriodLabel && (periodMetrics.grossProfitHistory?.length ?? 0) > 1;
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-slate-200/80 dark:border-[#1f2937]/50 ${isBest ? 'bg-[#34d399]/15' : ''} ${isWorst ? 'bg-[#f87171]/15' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {row.periodLabel}
                        {isBest && <span className="ml-2 text-xs report-accent-teal">Best</span>}
                        {isWorst && <span className="ml-2 text-xs report-accent-red">Worst</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-100">{row.orders}</td>
                      <td className="px-3 py-2 text-right report-muted"><Money value={row.revenue} className="report-muted" /></td>
                      <td className="px-3 py-2 text-right font-semibold report-accent-teal"><Money value={row.grossProfit} className="font-semibold report-accent-teal" /></td>
                      <td className="px-3 py-2 text-right report-muted">{row.marginPct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">
                        {row.vsPreviousPct != null ? (
                          <span className={row.vsPreviousPct >= 0 ? 'report-accent-teal' : 'report-accent-red'}>
                            {row.vsPreviousPct >= 0 ? '+' : ''}{row.vsPreviousPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="report-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {periodMetrics.grossProfitHistory.length > INITIAL_LIST_SIZE && (
              <details className="no-print group mt-1">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm report-muted hover:text-slate-900 dark:hover:text-slate-100">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  Show {periodMetrics.grossProfitHistory.length - INITIAL_LIST_SIZE} more periods
                </summary>
                <table className="w-full text-sm mt-1">
                  <tbody>
                    {periodMetrics.grossProfitHistory.slice(INITIAL_LIST_SIZE).map((row: { periodLabel: string; orders: number; revenue: number; grossProfit: number; marginPct: number; vsPreviousPct?: number | null }, idx) => {
                      const actualIdx = INITIAL_LIST_SIZE + idx;
                      const isBest = row.periodLabel === periodMetrics.bestProfitPeriodLabel;
                      const isWorst = row.periodLabel === periodMetrics.worstProfitPeriodLabel && (periodMetrics.grossProfitHistory?.length ?? 0) > 1;
                      return (
                        <tr
                          key={actualIdx}
                          className={`border-b border-slate-200/80 dark:border-[#1f2937]/50 ${isBest ? 'bg-[#34d399]/15' : ''} ${isWorst ? 'bg-[#f87171]/15' : ''}`}
                        >
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                            {row.periodLabel}
                            {isBest && <span className="ml-2 text-xs report-accent-teal">Best</span>}
                            {isWorst && <span className="ml-2 text-xs report-accent-red">Worst</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-100">{row.orders}</td>
                          <td className="px-3 py-2 text-right report-muted"><Money value={row.revenue} className="report-muted" /></td>
                          <td className="px-3 py-2 text-right font-semibold report-accent-teal"><Money value={row.grossProfit} className="font-semibold report-accent-teal" /></td>
                          <td className="px-3 py-2 text-right report-muted">{row.marginPct.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right">
                            {row.vsPreviousPct != null ? (
                              <span className={row.vsPreviousPct >= 0 ? 'report-accent-teal' : 'report-accent-red'}>
                                {row.vsPreviousPct >= 0 ? '+' : ''}{row.vsPreviousPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="report-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Customer Analytics — New / Returning / At-risk + Top Customers */}
      <div className="report-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Users className="h-5 w-5 report-accent-blue shrink-0" />
            Customer Analytics ({periodLabel})
          </h3>
          {periodMetrics.topCustomersBySpend.length > 0 && (
            <button
              type="button"
              onClick={() => exportToCSV('top_customers', ['Name', 'Phone', 'Visits', 'Total Spent (UGX)', 'Avg per Visit (UGX)', 'Last Visit'], periodMetrics.topCustomersBySpend.map((c) => [
                c.name, c.phone, c.visits, c.totalSpent, c.avgPerVisit, new Date(c.lastVisit).toISOString().slice(0, 10),
              ]))}
              className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#1f2937] px-2.5 py-2 min-h-[2.25rem] sm:min-h-0 text-xs text-slate-500 dark:text-[#9ca3af] hover:text-slate-900 dark:hover:text-slate-100 no-print touch-manipulation"
            >
              <Download className="h-3.5 w-3.5 shrink-0" /> CSV
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-slate-100 dark:bg-[#1f2937] p-3">
            <p className="text-xs report-muted">New customers</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{periodMetrics.newCustomersCount}</p>
          </div>
          <div className="rounded-lg bg-slate-100 dark:bg-[#1f2937] p-3">
            <p className="text-xs report-muted">Returning</p>
            <p className="text-xl font-bold report-accent-teal">{periodMetrics.returningCustomersCount}</p>
          </div>
          <div className="rounded-lg bg-slate-100 dark:bg-[#1f2937] p-3">
            <p className="text-xs report-muted">At-risk</p>
            <p className="text-xl font-bold report-accent-red">{periodMetrics.atRiskCount}</p>
            <p className="text-xs report-muted">no order in 30 days</p>
          </div>
        </div>
        {periodMetrics.topCustomersBySpend.length > 0 ? (
          <div className="report-table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                  <th className="px-2 py-1.5 text-left report-muted">Name</th>
                  <th className="px-2 py-1.5 text-left report-muted">Phone</th>
                  <th className="px-2 py-1.5 text-right report-muted">Visits</th>
                  <th className="px-2 py-1.5 text-right report-muted">Total spent</th>
                  <th className="px-2 py-1.5 text-right report-muted">Avg/visit</th>
                  <th className="px-2 py-1.5 text-right report-muted">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.topCustomersBySpend.slice(0, INITIAL_LIST_SIZE).map((c) => (
                  <tr key={c.customerId} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                    <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                    <td className="px-2 py-1.5 report-muted">{c.phone}</td>
                    <td className="px-2 py-1.5 text-right text-slate-900 dark:text-slate-100">{c.visits}</td>
                    <td className="px-2 py-1.5 text-right report-accent-teal"><Money value={c.totalSpent} className="report-accent-teal" /></td>
                    <td className="px-2 py-1.5 text-right report-muted"><Money value={c.avgPerVisit} className="report-muted" /></td>
                    <td className="px-2 py-1.5 text-right report-muted">
                      {new Date(c.lastVisit).toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {periodMetrics.topCustomersBySpend.length > INITIAL_LIST_SIZE && (
              <details className="no-print group mt-1">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm report-muted hover:text-slate-900 dark:hover:text-slate-100">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  Show {periodMetrics.topCustomersBySpend.length - INITIAL_LIST_SIZE} more customers
                </summary>
                <table className="w-full text-sm mt-1">
                  <tbody>
                    {periodMetrics.topCustomersBySpend.slice(INITIAL_LIST_SIZE).map((c) => (
                      <tr key={c.customerId} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                        <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                        <td className="px-2 py-1.5 report-muted">{c.phone}</td>
                        <td className="px-2 py-1.5 text-right text-slate-900 dark:text-slate-100">{c.visits}</td>
                        <td className="px-2 py-1.5 text-right report-accent-teal"><Money value={c.totalSpent} className="report-accent-teal" /></td>
                        <td className="px-2 py-1.5 text-right report-muted"><Money value={c.avgPerVisit} className="report-muted" /></td>
                        <td className="px-2 py-1.5 text-right report-muted">
                          {new Date(c.lastVisit).toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', day: '2-digit', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        ) : (
          <p className="text-sm report-muted">No customer orders in this period.</p>
        )}
      </div>

      {/* Inventory Health — Health score, Low Stock table, Dead stock, Restock cost */}
      <div className="report-card p-4 sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
          <Package className="h-5 w-5 report-accent-amber" />
          Inventory Health
        </h3>
        <div className="flex flex-wrap items-baseline gap-4 mb-4">
          <div>
            <p className="text-xs report-muted">Health score</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{periodMetrics.inventoryHealthScore}<span className="text-lg report-muted">/100</span></p>
          </div>
          <div>
            <p className="text-xs report-muted">Low stock items</p>
            <p className="text-xl font-bold text-[#f59e0b]">{periodMetrics.lowStockCount}</p>
          </div>
          <div>
            <p className="text-xs report-muted">Dead stock (no sales 60+ days)</p>
            <p className="text-xl font-bold report-accent-red">{periodMetrics.deadStockCount}</p>
          </div>
          <div>
            <p className="text-xs report-muted">Restock cost (to min level)</p>
            <p className="text-lg font-semibold report-accent-teal"><Money value={periodMetrics.lowStockTable.reduce((s, r) => s + r.restockCost, 0)} className="text-lg font-semibold report-accent-teal" /></p>
          </div>
        </div>
        {periodMetrics.lowStockTable.length > 0 ? (
          <div className="report-table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                  <th className="px-2 py-1.5 text-left report-muted">Product</th>
                  <th className="px-2 py-1.5 text-right report-muted">Stock</th>
                  <th className="px-2 py-1.5 text-right report-muted">Min</th>
                  <th className="px-2 py-1.5 text-right report-muted">Units needed</th>
                  <th className="px-2 py-1.5 text-right report-muted">Restock cost</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.lowStockTable.slice(0, INITIAL_LIST_SIZE).map((row) => (
                  <tr key={row.id} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                    <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]" title={row.name}>{row.name}</td>
                    <td className="px-2 py-1.5 text-right text-slate-900 dark:text-slate-100">{row.stock}</td>
                    <td className="px-2 py-1.5 text-right report-muted">{row.minStockLevel}</td>
                    <td className="px-2 py-1.5 text-right text-[#f59e0b]">{row.unitsNeeded}</td>
                    <td className="px-2 py-1.5 text-right report-accent-red"><Money value={row.restockCost} className="report-accent-red" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {periodMetrics.lowStockTable.length > INITIAL_LIST_SIZE && (
              <details className="no-print group mt-1">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm report-muted hover:text-slate-900 dark:hover:text-slate-100">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  Show {periodMetrics.lowStockTable.length - INITIAL_LIST_SIZE} more low-stock items
                </summary>
                <table className="w-full text-sm mt-1">
                  <tbody>
                    {periodMetrics.lowStockTable.slice(INITIAL_LIST_SIZE).map((row) => (
                      <tr key={row.id} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                        <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]" title={row.name}>{row.name}</td>
                        <td className="px-2 py-1.5 text-right text-slate-900 dark:text-slate-100">{row.stock}</td>
                        <td className="px-2 py-1.5 text-right report-muted">{row.minStockLevel}</td>
                        <td className="px-2 py-1.5 text-right text-[#f59e0b]">{row.unitsNeeded}</td>
                        <td className="px-2 py-1.5 text-right report-accent-red"><Money value={row.restockCost} className="report-accent-red" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        ) : (
          <p className="text-sm report-muted">All products above minimum stock level.</p>
        )}
      </div>

      {/* Refund & Return Analytics */}
      <div className="report-card p-4 sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
          <Receipt className="h-5 w-5 report-accent-red" />
          Refund & Return Analytics ({periodLabel})
        </h3>
        <div className="flex flex-wrap items-baseline gap-4 mb-4">
          <div>
            <p className="text-xs report-muted">Return orders</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{periodMetrics.returnOrders}</p>
          </div>
          <div>
            <p className="text-xs report-muted">Total refunded</p>
            <p className="text-xl font-bold report-accent-red"><Money value={periodMetrics.totalRefunded} className="text-xl font-bold report-accent-red" /></p>
          </div>
          <div>
            <p className="text-xs report-muted">Return rate</p>
            <p className="text-xl font-bold report-muted">{periodMetrics.returnRate.toFixed(1)}%</p>
          </div>
        </div>
        {periodMetrics.topReturnedProducts.length > 0 ? (
          <div className="report-table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                  <th className="px-2 py-1.5 text-left report-muted">Product</th>
                  <th className="px-2 py-1.5 text-right report-muted">Qty returned</th>
                  <th className="px-2 py-1.5 text-left report-muted">Reason</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.topReturnedProducts.slice(0, INITIAL_LIST_SIZE).map((r) => (
                  <tr key={r.productId} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                    <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[180px]" title={r.name}>{r.name}</td>
                    <td className="px-2 py-1.5 text-right report-accent-red">{r.qtyReturned}</td>
                    <td className="px-2 py-1.5 report-muted truncate max-w-[200px]" title={r.reason}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {periodMetrics.topReturnedProducts.length > INITIAL_LIST_SIZE && (
              <details className="no-print group mt-1">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm report-muted hover:text-slate-900 dark:hover:text-slate-100">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  Show {periodMetrics.topReturnedProducts.length - INITIAL_LIST_SIZE} more returned products
                </summary>
                <table className="w-full text-sm mt-1">
                  <tbody>
                    {periodMetrics.topReturnedProducts.slice(INITIAL_LIST_SIZE).map((r) => (
                      <tr key={r.productId} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                        <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[180px]" title={r.name}>{r.name}</td>
                        <td className="px-2 py-1.5 text-right report-accent-red">{r.qtyReturned}</td>
                        <td className="px-2 py-1.5 report-muted truncate max-w-[200px]" title={r.reason}>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        ) : (
          <p className="text-sm report-muted">No returns in this period.</p>
        )}
      </div>

      {/* Key Metrics — 10 KPIs */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="report-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Key Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm report-muted">Avg Order Value</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100"><Money value={periodMetrics.avgOrderValue} className="font-semibold text-slate-900 dark:text-slate-100" /></span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Gross Margin %</span>
              <span className="font-semibold report-accent-teal">{periodMetrics.profitMargin.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Net Margin %</span>
              <span className={`font-semibold ${periodMetrics.netProfitMargin >= 0 ? 'report-accent-teal' : 'report-accent-red'}`}>
                {periodMetrics.netProfitMargin.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Unique Customers</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{periodMetrics.uniqueCustomers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Returning Customer Rate</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{periodMetrics.returningCustomerRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Return Rate</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{periodMetrics.returnRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Revenue per Customer</span>
              <span className="font-semibold report-accent-teal"><Money value={periodMetrics.revenuePerCustomer} className="font-semibold report-accent-teal" /></span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Avg Visits per Customer</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{periodMetrics.avgVisitsPerCustomer.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Cost-to-Revenue Ratio</span>
              <span className="font-semibold report-accent-red">{periodMetrics.costToRevenueRatio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm report-muted">Break-even Day</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{periodMetrics.breakEvenDay ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Payment Methods — donut chart + bar list with share % */}
        <div className="report-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <CreditCard className="h-4 w-4 report-accent-blue" />
              Payment Methods
            </h3>
            {periodMetrics.paymentBreakdown.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const total = periodMetrics.paymentBreakdown.reduce((s, pm) => s + pm.amount, 0);
                  const labels: Record<string, string> = { cash: 'Cash', mtn_momo: 'MTN MoMo', airtel_pay: 'Airtel Pay' };
                  exportToCSV('payment_methods', ['Method', 'Total (UGX)', 'Orders', 'Share %'], periodMetrics.paymentBreakdown.map((pm) => {
                    const share = total > 0 ? (pm.amount / total) * 100 : 0;
                    return [labels[pm.method] || pm.method, pm.amount, pm.count, share.toFixed(1)] as [string, number, number, string];
                  }));
                }}
                className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#1f2937] px-2 py-1 text-xs text-slate-500 dark:text-[#9ca3af] hover:text-slate-900 dark:hover:text-slate-100 no-print"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>
          {periodMetrics.paymentBreakdown.length === 0 ? (
            <p className="text-sm report-muted">No payments</p>
          ) : (
            <>
              {(() => {
                const total = periodMetrics.paymentBreakdown.reduce((s, pm) => s + pm.amount, 0);
                const paymentLabels: Record<string, string> = {
                  cash: 'Cash',
                  mtn_momo: 'MTN MoMo',
                  airtel_pay: 'Airtel Pay',
                };
                const COLORS = ['#34d399', '#f59e0b', '#60a5fa', '#a78bfa', '#f87171'];
                const pieData = periodMetrics.paymentBreakdown.map((pm, i) => ({
                  name: paymentLabels[pm.method] || pm.method.replace('_', ' '),
                  value: pm.amount,
                  fill: COLORS[i % COLORS.length],
                }));
                return (
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <ResponsiveContainer width="100%" height={160} className="sm:w-40 sm:shrink-0">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={64}
                          paddingAngle={2}
                          label={false}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={pieData[i].fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatUGX(v)} contentStyle={chartTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2 min-w-0">
                      {periodMetrics.paymentBreakdown.map((pm) => {
                        const label = paymentLabels[pm.method] || pm.method.replace('_', ' ');
                        const share = total > 0 ? (pm.amount / total) * 100 : 0;
                        return (
                          <div key={pm.method} className="flex items-center justify-between gap-2 text-sm">
                            <span className="report-muted truncate">{label}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="w-16 text-right font-medium text-slate-900 dark:text-slate-100 tabular-nums"><Money value={pm.amount} className="font-medium text-slate-900 dark:text-slate-100" /></span>
                              <span className="text-xs report-muted w-10 text-right">({share.toFixed(1)}%)</span>
                              <span className="text-xs report-muted">({pm.count})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Sales by Channel — icon, revenue, orders, % share bar */}
        <div className="report-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <ShoppingCart className="h-4 w-4 report-accent-blue" />
              Sales by Channel
            </h3>
            {periodMetrics.channelBreakdown.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const totalRevenue = periodMetrics.channelBreakdown.reduce((s, ch) => s + ch.revenue, 0);
                  exportToCSV('sales_by_channel', ['Channel', 'Revenue (UGX)', 'Orders', 'Share %'], periodMetrics.channelBreakdown.map((ch) => {
                    const share = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
                    return [getChannelLabel(ch.channel), ch.revenue, ch.count, share.toFixed(1)] as [string, number, number, string];
                  }));
                }}
                className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#1f2937] px-2 py-1 text-xs text-slate-500 dark:text-[#9ca3af] hover:text-slate-900 dark:hover:text-slate-100 no-print"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>
          {periodMetrics.channelBreakdown.length === 0 ? (
            <p className="text-sm report-muted">No sales</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const totalRevenue = periodMetrics.channelBreakdown.reduce((s, ch) => s + ch.revenue, 0);
                const channelIcons: Record<string, typeof Store> = {
                  physical: Store,
                  ecommerce: Globe,
                  whatsapp: MessageCircle,
                  facebook: Share2,
                  instagram: Share2,
                  tiktok: Share2,
                };
                return periodMetrics.channelBreakdown.map((ch) => {
                  const Icon = channelIcons[ch.channel] || Share2;
                  const label = getChannelLabel(ch.channel);
                  const share = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
                  return (
                    <div key={ch.channel} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                          <Icon className="h-4 w-4 report-muted shrink-0" />
                          {label}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium report-accent-teal tabular-nums"><Money value={ch.revenue} className="font-medium report-accent-teal" /></span>
                          <span className="text-xs report-muted">({ch.count} {ch.count === 1 ? 'order' : 'orders'})</span>
                          <span className="text-xs text-[#f59e0b] w-10 text-right">{share.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#1f2937] overflow-hidden">
                        <div className="h-full rounded-full bg-[#f59e0b] transition-all" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Expenses by purpose — with vs previous period change */}
        <div className="report-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Receipt className="h-4 w-4 report-accent-red" />
              Expenses by purpose ({periodLabel})
            </h3>
            {periodMetrics.expensesByPurpose.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const total = periodMetrics.expensesByPurpose.reduce((s, ep) => s + ep.amount, 0);
                  exportToCSV('expenses_by_purpose', ['Purpose', 'Amount (UGX)', 'Count', '% of Total'], periodMetrics.expensesByPurpose.map((ep) => {
                    const pct = total > 0 ? (ep.amount / total) * 100 : 0;
                    return [ep.purpose, ep.amount, ep.count, pct.toFixed(1)] as [string, number, number, string];
                  }));
                }}
                className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#1f2937] px-2 py-1 text-xs text-slate-500 dark:text-[#9ca3af] hover:text-slate-900 dark:hover:text-slate-100 no-print"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>
          {periodMetrics.expensesByPurpose.length === 0 ? (
            <p className="text-sm report-muted">No expenses in this period</p>
          ) : (
            <div className="report-table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                    <th className="px-2 py-1.5 text-left report-muted">Purpose</th>
                    <th className="px-2 py-1.5 text-right report-muted">This period</th>
                    <th className="px-2 py-1.5 text-right report-muted">vs previous</th>
                  </tr>
                </thead>
                <tbody>
                  {periodMetrics.expensesByPurpose.slice(0, INITIAL_LIST_SIZE).map((ep) => (
                    <tr key={ep.purpose} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                      <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]" title={ep.purpose}>{ep.purpose}</td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="report-accent-red font-medium"><Money value={ep.amount} className="report-accent-red font-medium" /></span>
                        <span className="ml-1 text-xs report-muted">({ep.count})</span>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {(ep.pctChange ?? 0) !== 0 ? (
                          <span className={(ep.pctChange ?? 0) > 0 ? 'report-accent-red' : 'report-accent-teal'}>
                            {(ep.pctChange ?? 0) > 0 ? '+' : ''}{(ep.pctChange ?? 0).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="report-muted">—</span>
                        )}
                        <span className="ml-1 text-xs report-muted">(<Money value={ep.prevAmount ?? 0} className="report-muted" />)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {periodMetrics.expensesByPurpose.length > INITIAL_LIST_SIZE && (
                <details className="no-print group mt-1">
                  <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm report-muted hover:text-slate-900 dark:hover:text-slate-100">
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    Show {periodMetrics.expensesByPurpose.length - INITIAL_LIST_SIZE} more expense categories
                  </summary>
                  <table className="w-full text-sm mt-1">
                    <tbody>
                      {periodMetrics.expensesByPurpose.slice(INITIAL_LIST_SIZE).map((ep) => (
                        <tr key={ep.purpose} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                          <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]" title={ep.purpose}>{ep.purpose}</td>
                          <td className="px-2 py-1.5 text-right">
                            <span className="report-accent-red font-medium"><Money value={ep.amount} className="report-accent-red font-medium" /></span>
                            <span className="ml-1 text-xs report-muted">({ep.count})</span>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {(ep.pctChange ?? 0) !== 0 ? (
                              <span className={(ep.pctChange ?? 0) > 0 ? 'report-accent-red' : 'report-accent-teal'}>
                                {(ep.pctChange ?? 0) > 0 ? '+' : ''}{(ep.pctChange ?? 0).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="report-muted">—</span>
                            )}
                            <span className="ml-1 text-xs report-muted">(<Money value={ep.prevAmount ?? 0} className="report-muted" />)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Top Selling Products — margin % badge (green/amber/red), returns column */}
      {periodMetrics.topProducts.length > 0 && (
        <div className="report-card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
              <Package className="h-5 w-5 report-accent-blue" />
              Top Selling Products ({periodLabel})
            </h3>
            <button
              type="button"
              onClick={() => exportToCSV('top_products', ['Product', 'Qty Sold', 'Revenue (UGX)', 'Gross Profit (UGX)', 'Margin %', 'Returns'], periodMetrics.topProducts.map((p) => [p.name, p.qty, p.revenue, p.profit, p.marginPct.toFixed(1), p.totalReturns]))}
              className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#1f2937] px-2 py-1 text-xs text-slate-500 dark:text-[#9ca3af] hover:text-slate-900 dark:hover:text-slate-100 no-print"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
          <div className="report-table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                  <th className="px-3 py-2 text-left report-muted">Product</th>
                  <th className="px-3 py-2 text-right report-muted">Quantity</th>
                  <th className="px-3 py-2 text-right report-muted">Revenue</th>
                  <th className="px-3 py-2 text-right report-muted">Profit</th>
                  <th className="px-3 py-2 text-right report-muted">Margin %</th>
                  <th className="px-3 py-2 text-right report-muted">Returns</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.topProducts.slice(0, INITIAL_LIST_SIZE).map((product) => {
                  const marginColor = product.marginPct > 35 ? 'report-accent-teal' : product.marginPct >= 20 ? 'text-[#f59e0b]' : 'report-accent-red';
                  return (
                    <tr key={product.productId} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]" title={product.name}>{product.name}</td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-100">{product.qty}</td>
                      <td className="px-3 py-2 text-right report-accent-teal"><Money value={product.revenue} className="report-accent-teal" /></td>
                      <td className="px-3 py-2 text-right report-accent-teal"><Money value={product.profit} className="report-accent-teal" /></td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-medium ${marginColor}`}>{product.marginPct.toFixed(1)}%</span>
                      </td>
                      <td className="px-3 py-2 text-right report-muted">{product.totalReturns}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {periodMetrics.topProducts.length > INITIAL_LIST_SIZE && (
              <details className="no-print group mt-1">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm report-muted hover:text-slate-900 dark:hover:text-slate-100">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  Show {periodMetrics.topProducts.length - INITIAL_LIST_SIZE} more products
                </summary>
                <table className="w-full text-sm mt-1">
                  <tbody>
                    {periodMetrics.topProducts.slice(INITIAL_LIST_SIZE).map((product) => {
                      const marginColor = product.marginPct > 35 ? 'report-accent-teal' : product.marginPct >= 20 ? 'text-[#f59e0b]' : 'report-accent-red';
                      return (
                        <tr key={product.productId} className="border-b border-slate-200/80 dark:border-[#1f2937]/50">
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]" title={product.name}>{product.name}</td>
                          <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-100">{product.qty}</td>
                          <td className="px-3 py-2 text-right report-accent-teal"><Money value={product.revenue} className="report-accent-teal" /></td>
                          <td className="px-3 py-2 text-right report-accent-teal"><Money value={product.profit} className="report-accent-teal" /></td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-medium ${marginColor}`}>{product.marginPct.toFixed(1)}%</span>
                          </td>
                          <td className="px-3 py-2 text-right report-muted">{product.totalReturns}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        </div>
      )}

      </div>

      {/* Revenue & Profit Trend Chart — three lines, tooltip with exact values */}
      {periodMetrics.timeSeriesData.length > 0 && (
        <div className="report-card p-4 sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
            <TrendingUp className="h-5 w-5 report-accent-blue" />
            Revenue & Profit Trend
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={periodMetrics.timeSeriesData}>
              <defs>
                <linearGradient id="reportColorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="reportColorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="reportColorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis dataKey="date" stroke={chartAxisStroke} fontSize={12} />
              <YAxis stroke={chartAxisStroke} fontSize={12} tickFormatter={(value) => formatUGX(value)} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = periodMetrics.timeSeriesData.find((d) => d.date === label);
                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-[#1f2937] bg-white dark:bg-[#111827] p-3 shadow-lg">
                      <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">{label}</p>
                      {payload.map((p) => (
                        <div key={p.dataKey} className="flex justify-between gap-4 text-sm">
                          <span className="report-muted">{p.name}</span>
                          <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100"><Money value={Number(p.value)} className="font-medium text-slate-900 dark:text-slate-100" /></span>
                        </div>
                      ))}
                      {row && row.revenue > 0 && (
                        <div className="mt-2 border-t border-slate-200 dark:border-[#1f2937] pt-2 text-xs report-muted">
                          Gross margin: {row.marginPct.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ color: isDark ? '#9ca3af' : '#64748b' }} />
              <Area type="monotone" dataKey="revenue" stroke="#34d399" fillOpacity={1} fill="url(#reportColorRevenue)" name="Revenue" />
              <Area type="monotone" dataKey="profit" stroke="#60a5fa" fillOpacity={1} fill="url(#reportColorProfit)" name="Gross Profit" />
              <Area type="monotone" dataKey="expenses" stroke="#f87171" fillOpacity={1} fill="url(#reportColorExpenses)" name="Operating Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Break-even Tracker */}
      <div className="report-card p-4 sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100">
          <BarChart3 className="h-5 w-5 text-[#f59e0b]" />
          Break-even Tracker
        </h3>
        <p className="text-sm report-muted mb-3">
          Fixed costs (Rent, Labour, Utility, Maintenance) this period: <Money value={periodMetrics.fixedCosts} className="font-medium" />
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-sm report-muted mb-1">Break-even revenue threshold</p>
            <p className="text-xl font-bold text-[#f59e0b]"><Money value={periodMetrics.breakEvenRevenue} className="text-xl font-bold text-[#f59e0b]" /></p>
          </div>
          <div>
            <p className="text-sm report-muted mb-1">Progress (current revenue vs break-even)</p>
            <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-[#1f2937] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, periodMetrics.breakEvenProgress))}%`,
                  backgroundColor: periodMetrics.breakEvenReached ? '#34d399' : '#f59e0b',
                }}
              />
            </div>
            <p className="text-xs report-muted mt-1">
              <Money value={periodMetrics.grossIncome} className="font-medium" /> / <Money value={periodMetrics.breakEvenRevenue} className="font-medium" /> ({periodMetrics.breakEvenProgress.toFixed(0)}%)
            </p>
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {periodMetrics.breakEvenReached
              ? (periodMetrics.breakEvenDay
                  ? `Break-even reached on ${periodMetrics.breakEvenDay}`
                  : 'Break-even reached this period')
              : periodMetrics.breakEvenRevenue > 0
                ? `Need ${formatUGX(Math.max(0, periodMetrics.breakEvenRevenue - periodMetrics.grossIncome))} more to break even`
                : 'Set fixed costs and earn revenue to see break-even'}
          </p>
        </div>
      </div>

      {/* ——— Shareholder / Executive Summary (bottom) ——— */}
      <div className="border-t border-slate-200 dark:border-[#1f2937] pt-8 print:border-t-slate-300">
        <h2 className="mb-4 report-heading text-xl font-bold text-slate-900 dark:text-slate-100">For shareholders &amp; stakeholders</h2>

        {/* Report header: business name + period + generated timestamp (EAT) */}
        <div className="report-card border-l-4 border-l-[#60a5fa] p-5 print:bg-white print:border-slate-200 print:border-l-slate-400">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="report-heading text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 print:text-black">
                {REPORT_BUSINESS_NAME}
              </h3>
              <p className="mt-1 text-sm report-muted print:text-slate-600">
                Sales &amp; Performance Report · {periodLabel} · {periodRangeLabel}
              </p>
              <p className="mt-1 text-xs report-muted print:text-slate-500">
                Generated on {generatedAt} (EAT)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#f59e0b] px-5 py-2.5 text-sm font-semibold text-[#0d1117] hover:opacity-90"
                aria-label="Print or save as PDF"
              >
                <Printer className="h-4 w-4" />
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>

        {/* Executive summary bullets */}
        <div className="report-card border-l-4 border-l-[#34d399] p-5 print:bg-white print:border-slate-200 print:border-l-slate-400 mt-6">
          <h3 className="mb-3 flex items-center gap-2 report-heading text-lg font-semibold text-slate-900 dark:text-slate-100 print:text-black">
            <FileText className="h-5 w-5 report-accent-blue print:text-slate-600" />
            Executive Summary
          </h3>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-[#e5e7eb] print:text-slate-700">
            <li>
              <strong>Revenue</strong> for {periodLabel.toLowerCase()} was <strong className="report-accent-teal print:text-emerald-700"><Money value={periodMetrics.grossIncome} className="report-accent-teal print:text-emerald-700" /></strong>
              {periodMetrics.revenueGrowth !== 0 && (
                <span className={periodMetrics.revenueGrowth > 0 ? 'report-accent-teal print:text-emerald-600' : 'report-accent-red print:text-red-600'}>
                  {' '}({periodMetrics.revenueGrowth > 0 ? '+' : ''}{periodMetrics.revenueGrowth.toFixed(1)}% vs {prevPeriodLabel.toLowerCase()}).
                </span>
              )}
            </li>
            <li>
              <strong>Gross profit</strong> was <strong className="report-accent-teal print:text-emerald-700"><Money value={periodMetrics.grossProfit} className="report-accent-teal print:text-emerald-700" /></strong>
              {periodMetrics.profitGrowth !== 0 && (
                <span className={periodMetrics.profitGrowth > 0 ? 'report-accent-teal print:text-emerald-600' : 'report-accent-red print:text-red-600'}>
                  {' '}({periodMetrics.profitGrowth > 0 ? '+' : ''}{periodMetrics.profitGrowth.toFixed(1)}% vs {prevPeriodLabel.toLowerCase()})
                </span>
              )}
              , with a <strong>gross margin</strong> of {periodMetrics.profitMargin.toFixed(1)}%.
            </li>
            <li>
              <strong>Net profit</strong> (after operating expenses, excluding stock purchases) was{' '}
              <strong className={periodMetrics.netProfit >= 0 ? 'report-accent-teal print:text-emerald-700' : 'report-accent-red print:text-red-700'}>
                <Money value={periodMetrics.netProfit} className="font-semibold" />
              </strong>
              {periodMetrics.netProfitGrowth !== 0 && (
                <span className={periodMetrics.netProfitGrowth > 0 ? 'report-accent-teal print:text-emerald-600' : 'report-accent-red print:text-red-600'}>
                  {' '}({periodMetrics.netProfitGrowth > 0 ? '+' : ''}{periodMetrics.netProfitGrowth.toFixed(1)}% vs {prevPeriodLabel.toLowerCase()}).
                </span>
              )}
            </li>
            <li>
              {ordersPeriod} orders in period · Average order value <Money value={periodMetrics.avgOrderValue} className="report-muted" /> · {periodMetrics.uniqueCustomers} unique customers.
            </li>
          </ul>
        </div>

        {/* Expandable definitions */}
        <details className="no-print group report-card overflow-hidden mt-6">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
            Understanding this report
          </summary>
          <div className="border-t border-slate-200 dark:border-[#1f2937] px-4 pb-4 pt-2 text-sm report-muted">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="font-medium text-slate-900 dark:text-slate-100">Revenue</dt><dd>Total sales (before any deductions).</dd></div>
              <div><dt className="font-medium text-slate-900 dark:text-slate-100">Gross profit</dt><dd>Revenue minus cost of goods sold (what we paid for products).</dd></div>
              <div><dt className="font-medium text-slate-900 dark:text-slate-100">Gross margin</dt><dd>Gross profit as a % of revenue.</dd></div>
              <div><dt className="font-medium text-slate-900 dark:text-slate-100">Operating expenses</dt><dd>Day-to-day costs (rent, utilities, salaries, etc.), excluding stock purchases.</dd></div>
              <div><dt className="font-medium text-slate-900 dark:text-slate-100">Restock / Stock</dt><dd>Money spent on buying inventory; shown separately and not deducted from profit here.</dd></div>
              <div><dt className="font-medium text-slate-900 dark:text-slate-100">Payment to suppliers</dt><dd>Recorded in the Suppliers section when paying money owed; not part of expenses or operating expenses.</dd></div>
              <div><dt className="font-medium text-slate-900 dark:text-slate-100">Net profit</dt><dd>Gross profit minus operating expenses.</dd></div>
            </dl>
          </div>
        </details>
      </div>
    </div>
  );
}
