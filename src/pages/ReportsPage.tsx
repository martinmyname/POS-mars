import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, subDays, subWeeks, subMonths, subYears, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Package, Users, CreditCard, ShoppingCart, BarChart3 } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ProductSales {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  profit: number;
}

interface PaymentMethodBreakdown {
  method: string;
  count: number;
  amount: number;
}

export default function ReportsPage() {
  const db = useRxDB();
  const { '*': splat } = useParams();
  const period: Period = splat === 'weekly' ? 'weekly' : splat === 'monthly' ? 'monthly' : splat === 'yearly' ? 'yearly' : 'daily';

  const [ordersToday, setOrdersToday] = useState<number>(0);
  const [revenueToday, setRevenueToday] = useState<number>(0);
  const [profitToday, setProfitToday] = useState<number>(0);
  const [expensesToday, setExpensesToday] = useState<number>(0);
  const [ordersPeriod, setOrdersPeriod] = useState<number>(0);
  const [revenuePeriod, setRevenuePeriod] = useState<number>(0);
  const [profitPeriod, setProfitPeriod] = useState<number>(0);
  const [expensesPeriod, setExpensesPeriod] = useState<number>(0);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [previousPeriodOrders, setPreviousPeriodOrders] = useState<number>(0);
  const [previousPeriodRevenue, setPreviousPeriodRevenue] = useState<number>(0);
  const [previousPeriodProfit, setPreviousPeriodProfit] = useState<number>(0);
  const [previousPeriodExpenses, setPreviousPeriodExpenses] = useState<number>(0);

  useEffect(() => {
    if (!db) return;

    const today = startOfDay(new Date()).toISOString();
    const tomorrow = startOfDay(subDays(new Date(), -1)).toISOString();

    const start =
      period === 'daily'
        ? today
        : period === 'weekly'
          ? startOfWeek(new Date()).toISOString()
          : period === 'monthly'
            ? startOfMonth(new Date()).toISOString()
            : startOfYear(new Date()).toISOString();
    const end =
      period === 'daily'
        ? tomorrow
        : period === 'weekly'
          ? startOfWeek(subWeeks(new Date(), -1)).toISOString()
          : period === 'monthly'
            ? startOfMonth(subMonths(new Date(), -1)).toISOString()
            : startOfYear(subYears(new Date(), -1)).toISOString();

    // Previous period for comparison
    const prevStart =
      period === 'daily'
        ? startOfDay(subDays(new Date(), 1)).toISOString()
        : period === 'weekly'
          ? startOfWeek(subWeeks(new Date(), 1)).toISOString()
          : period === 'monthly'
            ? startOfMonth(subMonths(new Date(), 1)).toISOString()
            : startOfYear(subYears(new Date(), 1)).toISOString();
    const prevEnd = start;

    const subOrders = db.orders.find().$.subscribe((docs) => {
      const list = docs.filter((d) => !(d as { _deleted?: boolean })._deleted);
      const todayList = list.filter((o) => o.createdAt >= today && o.createdAt < tomorrow);
      const periodList = list.filter((o) => o.createdAt >= start && o.createdAt < end);
      const prevPeriodList = list.filter((o) => o.createdAt >= prevStart && o.createdAt < prevEnd);

      setOrdersToday(todayList.length);
      setRevenueToday(todayList.reduce((s, o) => s + o.total, 0));
      setProfitToday(todayList.reduce((s, o) => s + o.grossProfit, 0));

      setOrdersPeriod(periodList.length);
      setRevenuePeriod(periodList.reduce((s, o) => s + o.total, 0));
      setProfitPeriod(periodList.reduce((s, o) => s + o.grossProfit, 0));

      setPreviousPeriodOrders(prevPeriodList.length);
      setPreviousPeriodRevenue(prevPeriodList.reduce((s, o) => s + o.total, 0));
      setPreviousPeriodProfit(prevPeriodList.reduce((s, o) => s + o.grossProfit, 0));

      setAllOrders(list);
    });

    const subExpenses = db.expenses.find().$.subscribe((docs) => {
      const list = docs.filter((d) => !(d as { _deleted?: boolean })._deleted);
      const todayStr = today.slice(0, 10);
      const todayList = list.filter((e) => {
        const expenseDate = e.date.slice(0, 10);
        return expenseDate === todayStr;
      });
      const periodList = list.filter((e) => {
        const expenseDate = e.date.slice(0, 10);
        return expenseDate >= start.slice(0, 10) && expenseDate < end.slice(0, 10);
      });
      const prevPeriodList = list.filter((e) => {
        const expenseDate = e.date.slice(0, 10);
        return expenseDate >= prevStart.slice(0, 10) && expenseDate < prevEnd.slice(0, 10);
      });

      setExpensesToday(todayList.reduce((s, e) => s + e.amount, 0));
      setExpensesPeriod(periodList.reduce((s, e) => s + e.amount, 0));
      setPreviousPeriodExpenses(prevPeriodList.reduce((s, e) => s + e.amount, 0));
      setAllExpenses(list);
    });

    const subProducts = db.products.find().$.subscribe((docs) => {
      setAllProducts(docs.filter((d) => !(d as { _deleted?: boolean })._deleted));
    });

    const subCustomers = db.customers.find().$.subscribe((docs) => {
      setAllCustomers(docs.filter((d) => !(d as { _deleted?: boolean })._deleted));
    });

    return () => {
      subOrders.unsubscribe();
      subExpenses.unsubscribe();
      subProducts.unsubscribe();
      subCustomers.unsubscribe();
    };
  }, [db, period]);

  // Calculate period-specific metrics
  const periodMetrics = useMemo(() => {
    const today = startOfDay(new Date()).toISOString();
    const tomorrow = startOfDay(subDays(new Date(), -1)).toISOString();
    const start =
      period === 'daily'
        ? today
        : period === 'weekly'
          ? startOfWeek(new Date()).toISOString()
          : period === 'monthly'
            ? startOfMonth(new Date()).toISOString()
            : startOfYear(new Date()).toISOString();
    const end =
      period === 'daily'
        ? tomorrow
        : period === 'weekly'
          ? startOfWeek(subWeeks(new Date(), -1)).toISOString()
          : period === 'monthly'
            ? startOfMonth(subMonths(new Date(), -1)).toISOString()
            : startOfYear(subYears(new Date(), -1)).toISOString();

    const periodOrders = allOrders.filter((o) => o.createdAt >= start && o.createdAt < end);
    const periodExpenses = allExpenses.filter((e) => {
      const expenseDate = e.date.slice(0, 10);
      return expenseDate >= start.slice(0, 10) && expenseDate < end.slice(0, 10);
    });

    const grossIncome = revenuePeriod;
    const expenses = expensesPeriod;
    const netProfit = profitPeriod - expenses;

    // Average order value
    const avgOrderValue = ordersPeriod > 0 ? grossIncome / ordersPeriod : 0;

    // Profit margin percentage
    const profitMargin = grossIncome > 0 ? (profitPeriod / grossIncome) * 100 : 0;
    const netProfitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

    // Top selling products
    const productSalesMap = new Map<string, ProductSales>();
    periodOrders.forEach((order) => {
      (order.items || []).forEach((item: any) => {
        const product = allProducts.find((p) => p.id === item.productId);
        if (product) {
          const existing = productSalesMap.get(item.productId) || {
            productId: item.productId,
            name: product.name,
            qty: 0,
            revenue: 0,
            profit: 0,
          };
          existing.qty += item.qty;
          existing.revenue += item.sellingPrice * item.qty;
          existing.profit += (item.sellingPrice - item.costPrice) * item.qty;
          productSalesMap.set(item.productId, existing);
        }
      });
    });
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Payment method breakdown
    const paymentMap = new Map<string, PaymentMethodBreakdown>();
    periodOrders.forEach((order) => {
      const method = order.paymentMethod || 'cash';
      const existing = paymentMap.get(method) || { method, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += order.total;
      paymentMap.set(method, existing);
    });
    const paymentBreakdown = Array.from(paymentMap.values()).sort((a, b) => b.amount - a.amount);

    // Sales by channel
    const channelMap = new Map<string, { channel: string; count: number; revenue: number }>();
    periodOrders.forEach((order) => {
      const channel = order.channel || 'physical';
      const existing = channelMap.get(channel) || { channel, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += order.total;
      channelMap.set(channel, existing);
    });
    const channelBreakdown = Array.from(channelMap.values()).sort((a, b) => b.revenue - a.revenue);

    // Unique customers
    const uniqueCustomers = new Set(
      periodOrders.filter((o) => o.customerId).map((o) => o.customerId)
    ).size;

    // Return rate
    const returnOrders = periodOrders.filter((o) => o.orderType === 'return').length;
    const returnRate = ordersPeriod > 0 ? (returnOrders / ordersPeriod) * 100 : 0;

    // Growth calculations
    const revenueGrowth =
      previousPeriodRevenue > 0
        ? ((grossIncome - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : 0;
    const profitGrowth =
      previousPeriodProfit > 0
        ? ((profitPeriod - previousPeriodProfit) / previousPeriodProfit) * 100
        : 0;
    const ordersGrowth =
      previousPeriodOrders > 0
        ? ((ordersPeriod - previousPeriodOrders) / previousPeriodOrders) * 100
        : 0;

    // Time series data for trends
    const timeSeriesData: Array<{ date: string; revenue: number; profit: number; expenses: number; orders: number }> = [];
    
    if (period === 'daily') {
      // Last 7 days
      const days = eachDayOfInterval({
        start: subDays(new Date(), 6),
        end: new Date(),
      });
      days.forEach((day) => {
        const dayStart = startOfDay(day).toISOString();
        const dayEnd = startOfDay(subDays(day, -1)).toISOString();
        const dayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
        const dayExpenses = allExpenses.filter((e) => {
          const expenseDate = e.date.slice(0, 10);
          return expenseDate === day.toISOString().slice(0, 10);
        });
        timeSeriesData.push({
          date: format(day, 'MMM dd'),
          revenue: dayOrders.reduce((s, o) => s + o.total, 0),
          profit: dayOrders.reduce((s, o) => s + o.grossProfit, 0),
          expenses: dayExpenses.reduce((s, e) => s + e.amount, 0),
          orders: dayOrders.length,
        });
      });
    } else if (period === 'weekly') {
      // Last 8 weeks
      const weeks = eachWeekOfInterval(
        {
          start: subWeeks(new Date(), 7),
          end: new Date(),
        },
        { weekStartsOn: 1 }
      );
      weeks.forEach((week) => {
        const weekStart = startOfWeek(week).toISOString();
        const weekEnd = startOfWeek(subWeeks(week, -1)).toISOString();
        const weekOrders = allOrders.filter((o) => o.createdAt >= weekStart && o.createdAt < weekEnd);
        const weekExpenses = allExpenses.filter((e) => {
          const expenseDate = e.date.slice(0, 10);
          return expenseDate >= weekStart.slice(0, 10) && expenseDate < weekEnd.slice(0, 10);
        });
        timeSeriesData.push({
          date: format(week, 'MMM dd'),
          revenue: weekOrders.reduce((s, o) => s + o.total, 0),
          profit: weekOrders.reduce((s, o) => s + o.grossProfit, 0),
          expenses: weekExpenses.reduce((s, e) => s + e.amount, 0),
          orders: weekOrders.length,
        });
      });
    } else if (period === 'monthly') {
      // Last 12 months
      const months = eachMonthOfInterval({
        start: subMonths(new Date(), 11),
        end: new Date(),
      });
      months.forEach((month) => {
        const monthStart = startOfMonth(month).toISOString();
        const monthEnd = startOfMonth(subMonths(month, -1)).toISOString();
        const monthOrders = allOrders.filter((o) => o.createdAt >= monthStart && o.createdAt < monthEnd);
        const monthExpenses = allExpenses.filter((e) => {
          const expenseDate = e.date.slice(0, 10);
          return expenseDate >= monthStart.slice(0, 10) && expenseDate < monthEnd.slice(0, 10);
        });
        timeSeriesData.push({
          date: format(month, 'MMM yyyy'),
          revenue: monthOrders.reduce((s, o) => s + o.total, 0),
          profit: monthOrders.reduce((s, o) => s + o.grossProfit, 0),
          expenses: monthExpenses.reduce((s, e) => s + e.amount, 0),
          orders: monthOrders.length,
        });
      });
    } else {
      // Yearly - last 5 years
      for (let i = 4; i >= 0; i--) {
        const year = subYears(new Date(), i);
        const yearStart = startOfYear(year).toISOString();
        const yearEnd = startOfYear(subYears(year, -1)).toISOString();
        const yearOrders = allOrders.filter((o) => o.createdAt >= yearStart && o.createdAt < yearEnd);
        const yearExpenses = allExpenses.filter((e) => {
          const expenseDate = e.date.slice(0, 10);
          return expenseDate >= yearStart.slice(0, 10) && expenseDate < yearEnd.slice(0, 10);
        });
        timeSeriesData.push({
          date: format(year, 'yyyy'),
          revenue: yearOrders.reduce((s, o) => s + o.total, 0),
          profit: yearOrders.reduce((s, o) => s + o.grossProfit, 0),
          expenses: yearExpenses.reduce((s, e) => s + e.amount, 0),
          orders: yearOrders.length,
        });
      }
    }

    return {
      grossIncome,
      expenses,
      netProfit,
      avgOrderValue,
      profitMargin,
      netProfitMargin,
      topProducts,
      paymentBreakdown,
      channelBreakdown,
      uniqueCustomers,
      returnRate,
      revenueGrowth,
      profitGrowth,
      ordersGrowth,
      timeSeriesData,
    };
  }, [allOrders, allExpenses, allProducts, period, revenuePeriod, expensesPeriod, profitPeriod, ordersPeriod, previousPeriodRevenue, previousPeriodProfit, previousPeriodOrders]);

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading database…
      </div>
    );
  }

  const periodLabel =
    period === 'daily'
      ? 'Today'
      : period === 'weekly'
        ? 'This week'
        : period === 'monthly'
          ? 'This month'
          : 'This year';

  const prevPeriodLabel =
    period === 'daily'
      ? 'Yesterday'
      : period === 'weekly'
        ? 'Last week'
        : period === 'monthly'
          ? 'Last month'
          : 'Last year';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black">Reports</h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">
          ← Dashboard
        </Link>
      </div>

      <nav className="flex gap-2">
        <Link
          to="/reports/daily"
          className={`rounded-xl px-4 py-2.5 font-medium transition ${
            period === 'daily' ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          Daily
        </Link>
        <Link
          to="/reports/weekly"
          className={`rounded-xl px-4 py-2.5 font-medium transition ${
            period === 'weekly' ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          Weekly
        </Link>
        <Link
          to="/reports/monthly"
          className={`rounded-xl px-4 py-2.5 font-medium transition ${
            period === 'monthly' ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          Monthly
        </Link>
        <Link
          to="/reports/yearly"
          className={`rounded-xl px-4 py-2.5 font-medium transition ${
            period === 'yearly' ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          Yearly
        </Link>
      </nav>

      {/* Today's Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4 sm:p-5">
          <p className="text-xs sm:text-sm text-slate-600">Today – Orders</p>
          <p className="text-lg sm:text-2xl font-bold truncate">{ordersToday}</p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-xs sm:text-sm font-medium text-slate-500">Today – Revenue</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">{formatUGX(revenueToday)}</p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-xs sm:text-sm font-medium text-slate-500">Today – Profit</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">{formatUGX(profitToday)}</p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-xs sm:text-sm font-medium text-slate-500">Today – Expenses</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600 truncate">{formatUGX(expensesToday)}</p>
        </div>
      </div>

      {/* Period Overview */}
      <div className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
          <BarChart3 className="h-5 w-5 text-tufts-blue" />
          {periodLabel} Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-slate-600">Orders</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold">{ordersPeriod}</p>
              {periodMetrics.ordersGrowth !== 0 && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    periodMetrics.ordersGrowth > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {periodMetrics.ordersGrowth > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(periodMetrics.ordersGrowth).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">vs {prevPeriodLabel}: {previousPeriodOrders}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Gross Income</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-emerald-700">{formatUGX(periodMetrics.grossIncome)}</p>
              {periodMetrics.revenueGrowth !== 0 && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    periodMetrics.revenueGrowth > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {periodMetrics.revenueGrowth > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(periodMetrics.revenueGrowth).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">vs {prevPeriodLabel}: {formatUGX(previousPeriodRevenue)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Expenses</p>
            <p className="text-xl font-bold text-red-700">{formatUGX(periodMetrics.expenses)}</p>
            <p className="text-xs text-slate-500">vs {prevPeriodLabel}: {formatUGX(previousPeriodExpenses)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Net Profit</p>
            <div className="flex items-baseline gap-2">
              <p
                className={`text-xl font-bold ${
                  periodMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {formatUGX(periodMetrics.netProfit)}
              </p>
              {periodMetrics.profitGrowth !== 0 && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    periodMetrics.profitGrowth > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {periodMetrics.profitGrowth > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(periodMetrics.profitGrowth).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Margin: {periodMetrics.netProfitMargin.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Key Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Average Order Value</span>
              <span className="font-semibold">{formatUGX(periodMetrics.avgOrderValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Gross Profit Margin</span>
              <span className="font-semibold text-emerald-700">
                {periodMetrics.profitMargin.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Net Profit Margin</span>
              <span
                className={`font-semibold ${
                  periodMetrics.netProfitMargin >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {periodMetrics.netProfitMargin.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Unique Customers</span>
              <span className="font-semibold">{periodMetrics.uniqueCustomers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Return Rate</span>
              <span className="font-semibold">{periodMetrics.returnRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CreditCard className="h-4 w-4" />
            Payment Methods
          </h3>
          <div className="space-y-2">
            {periodMetrics.paymentBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">No payments</p>
            ) : (
              periodMetrics.paymentBreakdown.map((pm) => {
                const paymentLabels: Record<string, string> = {
                  cash: 'Cash',
                  mtn_momo: 'MTN MoMo',
                  airtel_pay: 'Airtel Pay',
                };
                const label = paymentLabels[pm.method] || pm.method.replace('_', ' ');
                return (
                  <div key={pm.method} className="flex justify-between text-sm">
                    <span className="text-slate-600">{label}</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatUGX(pm.amount)}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        ({pm.count} {pm.count === 1 ? 'order' : 'orders'})
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sales by Channel */}
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ShoppingCart className="h-4 w-4" />
            Sales by Channel
          </h3>
          <div className="space-y-2">
            {periodMetrics.channelBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">No sales</p>
            ) : (
              periodMetrics.channelBreakdown.map((ch) => {
                const channelLabels: Record<string, string> = {
                  physical: 'Physical Store',
                  ecommerce: 'Website / E-commerce',
                  whatsapp: 'WhatsApp',
                  facebook: 'Facebook',
                  instagram: 'Instagram',
                  tiktok: 'TikTok',
                };
                const channelLabel = channelLabels[ch.channel] || ch.channel;
                return (
                  <div key={ch.channel} className="flex justify-between text-sm">
                    <span className="text-slate-600">{channelLabel}</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatUGX(ch.revenue)}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        ({ch.count} {ch.count === 1 ? 'order' : 'orders'})
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top Products */}
      {periodMetrics.topProducts.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            <Package className="h-5 w-5 text-tufts-blue" />
            Top Selling Products ({periodLabel})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-slate-600">Product</th>
                  <th className="px-3 py-2 text-right text-slate-600">Quantity</th>
                  <th className="px-3 py-2 text-right text-slate-600">Revenue</th>
                  <th className="px-3 py-2 text-right text-slate-600">Profit</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.topProducts.map((product) => (
                  <tr key={product.productId} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{product.name}</td>
                    <td className="px-3 py-2 text-right">{product.qty}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                      {formatUGX(product.revenue)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {formatUGX(product.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue & Profit Trend Chart */}
      {periodMetrics.timeSeriesData.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            <TrendingUp className="h-5 w-5 text-tufts-blue" />
            Revenue & Profit Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={periodMetrics.timeSeriesData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => formatUGX(value)} />
              <Tooltip
                formatter={(value: number) => formatUGX(value)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorProfit)"
                name="Profit"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
