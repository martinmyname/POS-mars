import { useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProducts, useOrders, useExpenses } from '@/hooks/useData';
import { useDayBoundaryTick } from '@/hooks/useDayBoundaryTick';
import { useLowStockMetrics } from '@/hooks/useLowStockMetrics';
import { useCustomerSummary } from '@/hooks/useCustomerSummary';
import { formatUGX } from '@/lib/formatUGX';
import { FIXED_COST_PURPOSES } from '@/lib/expenseConstants';
import { getTodayInAppTz, getStartOfDayAppTzAsUTC, getEndOfDayAppTzAsUTC, addDaysToDateStr } from '@/lib/appTimezone';
import { getDailyGoals, getEffectiveDailyGoals } from '@/lib/dailyGoalsStorage';
import { format, parseISO } from 'date-fns';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  Receipt,
  RotateCcw,
  Wallet,
  Archive,
  BarChart3,
  Tag,
  Users,
  Settings,
  AlertTriangle,
  Bike,
  Truck,
  DollarSign,
  Lock,
  CalendarClock,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: productsList, loading: productsLoading } = useProducts({ realtime: true });
  const { data: ordersList } = useOrders({ realtime: true });
  const { data: expensesList } = useExpenses({ realtime: true });
  useDayBoundaryTick(); // keep day boundary for any future use
  const reminderNotifiedRef = useRef(false);

  const todayStr = getTodayInAppTz();
  const today = getStartOfDayAppTzAsUTC(todayStr).toISOString();
  const tomorrow = getEndOfDayAppTzAsUTC(todayStr).toISOString();

  const CANCELLED = 'cancelled';
  const { productCount, lowStockCount, ordersToday, revenueToday, profitToday, expensesToday, scheduledDueToday, scheduledUpcoming, ordersTodayPct, revenueTodayPct, profitTodayPct, sameDayLastWeekLabel, effectiveGoals } = useMemo(() => {
    const productCount = productsList.length;
    const lowStockCount = productsList.filter((p) => p.stock <= p.minStockLevel).length;
    const todayOrders = ordersList.filter((o) => (o.status ?? '') !== CANCELLED && o.createdAt >= today && o.createdAt < tomorrow);
    const ordersToday = todayOrders.length;
    const revenueToday = todayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    // Gross profit today: same formula as Reports — sum of (sellingPrice − costPrice) × qty per line, with sign for returns
    const profitToday = todayOrders.reduce((sum, order) => {
      const sign = order.orderType === 'return' ? -1 : 1;
      const items = (order.items || []) as Array<{ sellingPrice?: number; costPrice?: number; qty?: number }>;
      const lineProfit = items.reduce((s, item) => {
        const sell = Number(item.sellingPrice) || 0;
        const cost = Number(item.costPrice) || 0;
        const qty = Number(item.qty) || 0;
        return s + sign * (sell - cost) * qty;
      }, 0);
      return sum + lineProfit;
    }, 0);
    const yesterdayStr = addDaysToDateStr(todayStr, -1);
    const yesterdayStart = getStartOfDayAppTzAsUTC(yesterdayStr).toISOString();
    const yesterdayEnd = getEndOfDayAppTzAsUTC(yesterdayStr).toISOString();
    const yesterdayOrders = ordersList.filter((o) => (o.status ?? '') !== CANCELLED && o.createdAt >= yesterdayStart && o.createdAt < yesterdayEnd);
    const ordersYesterday = yesterdayOrders.length;
    const revenueYesterday = yesterdayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const profitYesterday = yesterdayOrders.reduce((sum, order) => {
      const sign = order.orderType === 'return' ? -1 : 1;
      const items = (order.items || []) as Array<{ sellingPrice?: number; costPrice?: number; qty?: number }>;
      const lineProfit = items.reduce((s, item) => {
        const sell = Number(item.sellingPrice) || 0;
        const cost = Number(item.costPrice) || 0;
        const qty = Number(item.qty) || 0;
        return s + sign * (sell - cost) * qty;
      }, 0);
      return sum + lineProfit;
    }, 0);
    const todayExp = expensesList.filter((e) => e.date.slice(0, 10) === todayStr);
    const expensesToday = todayExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const scheduled = ordersList.filter((o) => o.scheduledFor);
    const dueToday = scheduled.filter((o) => o.scheduledFor === todayStr);
    const upcoming = scheduled
      .filter((o) => (o.scheduledFor ?? '') > todayStr)
      .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
      .slice(0, 5);
    const scheduledDueToday = dueToday.map((d) => ({
      id: d.id,
      orderNumber: d.orderNumber,
      total: d.total,
      scheduledFor: d.scheduledFor ?? '',
    }));
    const scheduledUpcoming = upcoming.map((d) => ({
      id: d.id,
      orderNumber: d.orderNumber,
      total: d.total,
      scheduledFor: d.scheduledFor ?? '',
    }));
    // Vs same day last week (for badges)
    const sameDayLastWeekStr = addDaysToDateStr(todayStr, -7);
    const lastWeekStart = getStartOfDayAppTzAsUTC(sameDayLastWeekStr).toISOString();
    const lastWeekEnd = getEndOfDayAppTzAsUTC(sameDayLastWeekStr).toISOString();
    const lastWeekOrders = ordersList.filter((o) => (o.status ?? '') !== CANCELLED && o.createdAt >= lastWeekStart && o.createdAt < lastWeekEnd);
    const ordersSameDayLastWeek = lastWeekOrders.length;
    const revenueSameDayLastWeek = lastWeekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const profitSameDayLastWeek = lastWeekOrders.reduce((sum, order) => {
      const sign = order.orderType === 'return' ? -1 : 1;
      const items = (order.items || []) as Array<{ sellingPrice?: number; costPrice?: number; qty?: number }>;
      const lineProfit = items.reduce((s, item) => {
        const sell = Number(item.sellingPrice) || 0;
        const cost = Number(item.costPrice) || 0;
        const qty = Number(item.qty) || 0;
        return s + sign * (sell - cost) * qty;
      }, 0);
      return sum + lineProfit;
    }, 0);
    const pctChange = (curr: number, prev: number) =>
      prev !== 0 ? ((curr - prev) / prev) * 100 : curr !== 0 ? 100 : 0;
    const ordersTodayPct = pctChange(ordersToday, ordersSameDayLastWeek);
    const revenueTodayPct = pctChange(revenueToday, revenueSameDayLastWeek);
    const profitTodayPct = pctChange(profitToday, profitSameDayLastWeek);
    const sameDayLastWeekLabel = format(parseISO(sameDayLastWeekStr), 'EEE');
    const effectiveGoals = getEffectiveDailyGoals(getDailyGoals(), { revenue: revenueYesterday, orders: ordersYesterday, profit: profitYesterday });
    return {
      productCount,
      lowStockCount,
      ordersToday,
      revenueToday,
      profitToday,
      expensesToday,
      scheduledDueToday,
      scheduledUpcoming,
      ordersTodayPct,
      revenueTodayPct,
      profitTodayPct,
      sameDayLastWeekLabel,
      effectiveGoals,
    };
  }, [productsList, ordersList, expensesList, today, tomorrow, todayStr]);

  const { totalRestockCost, lowStockCount: lowStockMetricCount } = useLowStockMetrics(productsList);
  const ordersForSummary = useMemo(
    () => (ordersList ?? []).map((o) => ({ customerId: o.customerId, createdAt: o.createdAt, status: o.status, orderType: o.orderType })),
    [ordersList]
  );
  const { atRiskCount } = useCustomerSummary(ordersForSummary, 'monthly');

  const { breakEvenRevenueToday, deadStockCount } = useMemo(() => {
    const FIXED_COST_SET = new Set(FIXED_COST_PURPOSES.map((p) => p.toLowerCase()));
    const todayExp = expensesList.filter((e) => e.date.slice(0, 10) === todayStr);
    const fixedCostsToday = todayExp
      .filter((e) => FIXED_COST_SET.has((e.purpose || '').trim().toLowerCase()))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const grossMarginPct = revenueToday > 0 ? profitToday / revenueToday : 0;
    const breakEvenRevenueToday = grossMarginPct > 0 ? fixedCostsToday / grossMarginPct : 0;
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const productIdsSoldLast60 = new Set<string>();
    (ordersList ?? []).filter((o) => (o.status ?? '') !== CANCELLED && o.orderType !== 'return' && o.createdAt >= sixtyDaysAgo).forEach((o) => {
      ((o.items || []) as Array<{ productId?: string }>).forEach((item) => {
        if (item.productId) productIdsSoldLast60.add(item.productId);
      });
    });
    const deadStockCount = productsList.filter((p) => (Number(p.stock) || 0) > 0 && !productIdsSoldLast60.has(p.id)).length;
    return { breakEvenRevenueToday, deadStockCount };
  }, [expensesList, todayStr, revenueToday, profitToday, ordersList, productsList]);

  const alerts = useMemo(() => {
    const list: { severity: number; key: string; message: string; link: string; linkLabel: string }[] = [];
    if (breakEvenRevenueToday > 0 && revenueToday < breakEvenRevenueToday) {
      const need = Math.round(breakEvenRevenueToday - revenueToday);
      list.push({ severity: 4, key: 'break-even', message: `Revenue today is ${formatUGX(revenueToday)} — need ${formatUGX(need)} more to break even.`, link: '/reports/daily', linkLabel: 'View cash flow → Reports' });
    }
    if (atRiskCount > 0) {
      list.push({ severity: 3, key: 'at-risk', message: `${atRiskCount} customer${atRiskCount === 1 ? '' : 's'} haven't ordered in 30+ days.`, link: '/reports/daily', linkLabel: 'View customer analytics → Reports' });
    }
    if (lowStockMetricCount > 0) {
      list.push({ severity: 2, key: 'low-stock', message: `${lowStockMetricCount} item${lowStockMetricCount === 1 ? '' : 's'} low on stock. Restock cost: ${formatUGX(totalRestockCost)}`, link: '/inventory', linkLabel: 'View inventory' });
    }
    if (deadStockCount > 0) {
      list.push({ severity: 1, key: 'dead-stock', message: `${deadStockCount} product${deadStockCount === 1 ? '' : 's'} with no sales in 60+ days.`, link: '/reports/daily', linkLabel: 'View inventory health → Reports' });
    }
    return list.sort((a, b) => b.severity - a.severity).slice(0, 4);
  }, [breakEvenRevenueToday, revenueToday, atRiskCount, lowStockMetricCount, totalRestockCost, deadStockCount]);

  // One-time browser notification when there are orders due today
  useEffect(() => {
    if (scheduledDueToday.length === 0 || reminderNotifiedRef.current) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    reminderNotifiedRef.current = true;
    const show = () => {
      if (Notification.permission === 'granted') {
        new Notification('Orders due today', {
          body: `${scheduledDueToday.length} scheduled order(s) are due today. Check the dashboard.`,
          icon: '/logo.png',
        });
      }
    };
    if (Notification.permission === 'granted') show();
    else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((p) => { if (p === 'granted') show(); });
    }
  }, [scheduledDueToday.length]);

  const navItems = [
    { to: '/pos', label: 'POS Checkout', icon: ShoppingCart, primary: true },
    { to: '/deliveries', label: 'Deliveries', icon: Bike },
    { to: '/layaways', label: 'Layaways', icon: DollarSign },
    { to: '/cash', label: 'Cash Management', icon: Lock },
    { to: '/returns', label: 'Returns', icon: RotateCcw },
    { to: '/expenses', label: 'Expenses', icon: Wallet },
    { to: '/inventory', label: 'Inventory', icon: Archive },
    { to: '/suppliers', label: 'Suppliers', icon: Truck },
    { to: '/reports/daily', label: 'Reports', icon: BarChart3 },
    { to: '/promotions', label: 'Promotions', icon: Tag },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  if (productsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-tufts-blue border-t-transparent"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your store today</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {productCount > 0 ? (
            <Link to="/inventory" className="card-hover card block p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Products</p>
                  <p className="text-lg sm:text-2xl font-bold text-smoky-black truncate">{productCount}</p>
                </div>
              </div>
            </Link>
          ) : (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Products</p>
                  <p className="text-lg sm:text-2xl font-bold text-smoky-black truncate">{productCount}</p>
                </div>
              </div>
            </div>
          )}
          {ordersToday > 0 ? (
            <Link to="/reports/daily" className="card-hover card block p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Orders today</p>
                  <p className="text-lg sm:text-2xl font-bold text-smoky-black truncate">{ordersToday}</p>
                  {ordersTodayPct !== 0 && (
                    <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${ordersTodayPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {ordersTodayPct > 0 && <TrendingUp className="h-3 w-3" />}
                      {ordersTodayPct < 0 && <TrendingDown className="h-3 w-3" />}
                      {ordersTodayPct > 0 ? '+' : ''}{ordersTodayPct.toFixed(1)}%
                      <span className="text-slate-500"> vs last {sameDayLastWeekLabel}</span>
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Orders today</p>
                  <p className="text-lg sm:text-2xl font-bold text-smoky-black truncate">{ordersToday}</p>
                  {ordersTodayPct !== 0 && (
                    <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${ordersTodayPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {ordersTodayPct > 0 && <TrendingUp className="h-3 w-3" />}
                      {ordersTodayPct < 0 && <TrendingDown className="h-3 w-3" />}
                      {ordersTodayPct > 0 ? '+' : ''}{ordersTodayPct.toFixed(1)}%
                      <span className="text-slate-500"> vs last {sameDayLastWeekLabel}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          {revenueToday > 0 ? (
            <Link to="/reports/daily" className="card-hover card block p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-emerald-100 p-2">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Revenue today</p>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">{formatUGX(revenueToday)}</p>
                  {revenueTodayPct !== 0 && (
                    <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${revenueTodayPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {revenueTodayPct > 0 && <TrendingUp className="h-3 w-3" />}
                      {revenueTodayPct < 0 && <TrendingDown className="h-3 w-3" />}
                      {revenueTodayPct > 0 ? '+' : ''}{revenueTodayPct.toFixed(1)}%
                      <span className="text-slate-500"> vs last {sameDayLastWeekLabel}</span>
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-emerald-100 p-2">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Revenue today</p>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">{formatUGX(revenueToday)}</p>
                  {revenueTodayPct !== 0 && (
                    <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${revenueTodayPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {revenueTodayPct > 0 && <TrendingUp className="h-3 w-3" />}
                      {revenueTodayPct < 0 && <TrendingDown className="h-3 w-3" />}
                      {revenueTodayPct > 0 ? '+' : ''}{revenueTodayPct.toFixed(1)}%
                      <span className="text-slate-500"> vs last {sameDayLastWeekLabel}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          {profitToday !== 0 ? (
            <Link to="/reports/daily" className="card-hover card block p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-teal-100 p-2">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-teal-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Gross profit today</p>
                  <p className="text-lg sm:text-2xl font-bold text-teal-700 truncate">{formatUGX(profitToday)}</p>
                  {profitTodayPct !== 0 && (
                    <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${profitTodayPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {profitTodayPct > 0 && <TrendingUp className="h-3 w-3" />}
                      {profitTodayPct < 0 && <TrendingDown className="h-3 w-3" />}
                      {profitTodayPct > 0 ? '+' : ''}{profitTodayPct.toFixed(1)}%
                      <span className="text-slate-500"> vs last {sameDayLastWeekLabel}</span>
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-teal-100 p-2">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-teal-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Gross profit today</p>
                  <p className="text-lg sm:text-2xl font-bold text-teal-700 truncate">{formatUGX(profitToday)}</p>
                  {profitTodayPct !== 0 && (
                    <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${profitTodayPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {profitTodayPct > 0 && <TrendingUp className="h-3 w-3" />}
                      {profitTodayPct < 0 && <TrendingDown className="h-3 w-3" />}
                      {profitTodayPct > 0 ? '+' : ''}{profitTodayPct.toFixed(1)}%
                      <span className="text-slate-500"> vs last {sameDayLastWeekLabel}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          {expensesToday > 0 ? (
            <Link to="/expenses" className="card-hover card block p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-red-50 p-2">
                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Expenses today</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-600 truncate">{formatUGX(expensesToday)}</p>
                </div>
              </div>
            </Link>
          ) : (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg bg-red-50 p-2">
                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Expenses today</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-600 truncate">{formatUGX(expensesToday)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Today's Goals — general goal, or yesterday's actual if higher (see Reports to edit base goals) */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-smoky-black sm:text-lg">Today&apos;s Goals</h2>
          <Link to="/reports/daily" className="text-xs font-medium text-tufts-blue hover:underline sm:text-sm">
            Edit goals → Reports
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Revenue</p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${effectiveGoals.revenueTarget > 0 ? Math.min(100, (revenueToday / effectiveGoals.revenueTarget) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatUGX(revenueToday)} / {formatUGX(effectiveGoals.revenueTarget)}
              {effectiveGoals.revenueTarget > 0 && (
                <span className="ml-1 font-medium text-slate-700">
                  ({Math.min(100, (revenueToday / effectiveGoals.revenueTarget) * 100).toFixed(0)}%)
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Orders</p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${effectiveGoals.ordersTarget > 0 ? Math.min(100, (ordersToday / effectiveGoals.ordersTarget) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {ordersToday} / {effectiveGoals.ordersTarget} orders
              {effectiveGoals.ordersTarget > 0 && (
                <span className="ml-1 font-medium text-slate-700">
                  ({Math.min(100, (ordersToday / effectiveGoals.ordersTarget) * 100).toFixed(0)}%)
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Gross Profit</p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${effectiveGoals.profitTarget > 0 ? Math.min(100, (profitToday / effectiveGoals.profitTarget) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatUGX(profitToday)} / {formatUGX(effectiveGoals.profitTarget)}
              {effectiveGoals.profitTarget > 0 && (
                <span className="ml-1 font-medium text-slate-700">
                  ({Math.min(100, (profitToday / effectiveGoals.profitTarget) * 100).toFixed(0)}%)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card col-span-full space-y-2 p-4 sm:p-5">
          <h2 className="font-heading text-sm font-semibold text-smoky-black">Alerts</h2>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span>
                  {a.key === 'break-even' && <span className="text-red-600" aria-hidden>🔴</span>}
                  {a.key === 'at-risk' && <span className="text-amber-600" aria-hidden>🟡</span>}
                  {a.key === 'low-stock' && <span className="text-orange-500" aria-hidden>🟠</span>}
                  {a.key === 'dead-stock' && <span className="text-slate-500" aria-hidden>⚪</span>}
                </span>
                <span className="text-slate-700 dark:text-slate-300">{a.message}</span>
                <Link to={a.link} className="shrink-0 text-xs font-medium text-tufts-blue hover:underline">
                  {a.linkLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lowStockCount > 0 && (
            <Link
              to="/inventory"
              className="card-hover col-span-full flex items-center gap-3 rounded-xl border-amber-200 bg-amber-50/80 p-4 text-amber-900 sm:col-span-2 touch-target sm:p-5"
            >
              <div className="rounded-lg bg-amber-200/60 p-2">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Low stock alert</p>
                <p className="text-sm text-amber-800">{lowStockCount} product(s) at or below minimum</p>
              </div>
            </Link>
          )}
          {(scheduledDueToday.length > 0 || scheduledUpcoming.length > 0) && (
            <Link to="/deliveries" className="col-span-full card-hover card block p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold text-smoky-black sm:text-lg">
                <CalendarClock className="h-5 w-5 text-tufts-blue" />
                Scheduled orders
              </h2>
              {scheduledDueToday.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="mb-2 text-sm font-semibold text-amber-900">Due today – reminder</p>
                  <ul className="space-y-1.5 text-sm text-amber-800">
                    {scheduledDueToday.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <span>Order #{o.orderNumber ?? o.id.slice(-8)}</span>
                        <span className="font-medium">{formatUGX(o.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="mt-2 inline-block text-sm font-medium text-amber-800 underline">View deliveries →</span>
                </div>
              )}
              {scheduledUpcoming.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Upcoming</p>
                  <ul className="space-y-1.5 text-sm text-slate-600">
                    {scheduledUpcoming.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <span>
                          Order #{o.orderNumber ?? o.id.slice(-8)} · {format(parseISO(o.scheduledFor), 'EEE, d MMM')}
                        </span>
                        <span className="font-medium text-slate-800">{formatUGX(o.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Link>
          )}

      <div>
        <h2 className="mb-3 sm:mb-4 font-heading text-base font-semibold text-smoky-black sm:text-lg">Quick actions</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {navItems.map(({ to, label, icon: Icon, primary }) => (
            <Link
              key={to}
              to={to}
              className={
                primary
                  ? 'card-hover flex items-center gap-3 rounded-xl bg-tufts-blue p-4 text-white touch-target'
                  : 'card-hover flex items-center gap-3 rounded-xl p-4 touch-target'
              }
            >
              <div
                className={
                  primary ? 'rounded-lg bg-white/20 p-2 shrink-0' : 'rounded-lg bg-slate-100 p-2 shrink-0'
                }
              >
                <Icon className={`h-5 w-5 ${primary ? 'text-white' : 'text-slate-600'}`} />
              </div>
              <span className="font-medium text-sm sm:text-base truncate">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
