import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { useDayBoundaryTick } from '@/hooks/useDayBoundaryTick';
import { formatUGX } from '@/lib/formatUGX';
import {
  getTodayInAppTz,
  getStartOfDayAppTzAsUTC,
  getEndOfDayAppTzAsUTC,
  addDaysToDateStr,
  getWeekRangeInAppTz,
  getMonthRangeInAppTz,
  getYearRangeInAppTz,
} from '@/lib/appTimezone';
import { TrendingUp, TrendingDown, Package, CreditCard, ShoppingCart, BarChart3, AlertTriangle, Receipt } from 'lucide-react';
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
  const dayTick = useDayBoundaryTick();
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
  const [, setAllCustomers] = useState<any[]>([]);
  const [previousPeriodOrders, setPreviousPeriodOrders] = useState<number>(0);
  const [previousPeriodRevenue, setPreviousPeriodRevenue] = useState<number>(0);
  const [previousPeriodProfit, setPreviousPeriodProfit] = useState<number>(0);
  const [previousPeriodExpenses, setPreviousPeriodExpenses] = useState<number>(0);

  useEffect(() => {
    if (!db) return;

    const todayStr = getTodayInAppTz();
    const today = getStartOfDayAppTzAsUTC(todayStr).toISOString();
    const tomorrow = getEndOfDayAppTzAsUTC(todayStr).toISOString();

    let start: string;
    let end: string;
    let prevStart: string;
    let prevEnd: string;

    if (period === 'daily') {
      start = today;
      end = tomorrow;
      const yesterdayStr = addDaysToDateStr(todayStr, -1);
      prevStart = getStartOfDayAppTzAsUTC(yesterdayStr).toISOString();
      prevEnd = today;
    } else if (period === 'weekly') {
      const thisWeek = getWeekRangeInAppTz(todayStr);
      start = thisWeek.start;
      end = thisWeek.end;
      const mondayStr = new Date(thisWeek.start).toLocaleDateString('en-CA', {
        timeZone: 'Africa/Kampala',
      });
      const lastMondayStr = addDaysToDateStr(mondayStr, -7);
      const prevWeek = getWeekRangeInAppTz(lastMondayStr);
      prevStart = prevWeek.start;
      prevEnd = start;
    } else if (period === 'monthly') {
      const thisMonth = getMonthRangeInAppTz(todayStr);
      start = thisMonth.start;
      end = thisMonth.end;
      const [y, m] = todayStr.split('-').map(Number);
      const lastMonthStr =
        m === 1
          ? `${y - 1}-12-01`
          : `${y}-${String(m - 1).padStart(2, '0')}-01`;
      const prevMonth = getMonthRangeInAppTz(lastMonthStr);
      prevStart = prevMonth.start;
      prevEnd = start;
    } else {
      const thisYear = getYearRangeInAppTz(todayStr);
      start = thisYear.start;
      end = thisYear.end;
      const [y] = todayStr.split('-').map(Number);
      const lastYearStr = `${y - 1}-01-01`;
      const prevYear = getYearRangeInAppTz(lastYearStr);
      prevStart = prevYear.start;
      prevEnd = start;
    }

    const subOrders = db.orders.find().$.subscribe((docs) => {
      const list = docs.filter((d) => !(d as { _deleted?: boolean })._deleted);
      const todayList = list.filter((o) => o.createdAt >= today && o.createdAt < tomorrow);
      const periodList = list.filter((o) => o.createdAt >= start && o.createdAt < end);
      const prevPeriodList = list.filter((o) => o.createdAt >= prevStart && o.createdAt < prevEnd);

      setOrdersToday(todayList.length);
      setRevenueToday(todayList.reduce((s, o) => s + (Number(o.total) || 0), 0));
      setProfitToday(todayList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0));

      setOrdersPeriod(periodList.length);
      setRevenuePeriod(periodList.reduce((s, o) => s + (Number(o.total) || 0), 0));
      setProfitPeriod(periodList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0));

      setPreviousPeriodOrders(prevPeriodList.length);
      setPreviousPeriodRevenue(prevPeriodList.reduce((s, o) => s + (Number(o.total) || 0), 0));
      setPreviousPeriodProfit(prevPeriodList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0));

      setAllOrders(list);
    });

    // Calendar date bounds in Uganda for expense filtering (expense.date is YYYY-MM-DD)
    const periodStartDateStr =
      period === 'daily'
        ? todayStr
        : period === 'weekly'
          ? new Date(start).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
          : period === 'monthly'
            ? todayStr.slice(0, 7) + '-01'
            : todayStr.slice(0, 4) + '-01-01';
    const periodEndDateStr =
      period === 'daily'
        ? todayStr
        : period === 'weekly'
          ? addDaysToDateStr(new Date(start).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' }), 6)
          : period === 'monthly'
            ? (() => {
                const [y, m] = todayStr.split('-').map(Number);
                const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate();
                return `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
              })()
            : todayStr.slice(0, 4) + '-12-31';
    const prevStartDateStr = new Date(prevStart).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
    const prevEndDateStr = new Date(prevEnd).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });

    const subExpenses = db.expenses.find().$.subscribe((docs) => {
      const list = docs.filter((d) => !(d as { _deleted?: boolean })._deleted);
      const todayList = list.filter((e) => e.date.slice(0, 10) === todayStr);
      const periodList = list.filter((e) => {
        const d = e.date.slice(0, 10);
        return d >= periodStartDateStr && d <= periodEndDateStr;
      });
      const prevPeriodList = list.filter((e) => {
        const d = e.date.slice(0, 10);
        return d >= prevStartDateStr && d < prevEndDateStr;
      });

      setExpensesToday(todayList.reduce((s, e) => s + (Number(e.amount) || 0), 0));
      setExpensesPeriod(periodList.reduce((s, e) => s + (Number(e.amount) || 0), 0));
      setPreviousPeriodExpenses(prevPeriodList.reduce((s, e) => s + (Number(e.amount) || 0), 0));
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
  }, [db, period, dayTick]);

  // Calculate period-specific metrics (same Uganda/EAT ranges as in the effect)
  const periodMetrics = useMemo(() => {
    const todayStr = getTodayInAppTz();
    const today = getStartOfDayAppTzAsUTC(todayStr).toISOString();
    const tomorrow = getEndOfDayAppTzAsUTC(todayStr).toISOString();

    let start: string;
    let end: string;
    let periodStartDateStr: string;
    let periodEndDateStr: string;
    let prevStartDateStr: string;
    let prevEndDateStr: string;

    if (period === 'daily') {
      start = today;
      end = tomorrow;
      const yesterdayStr = addDaysToDateStr(todayStr, -1);
      periodStartDateStr = todayStr;
      periodEndDateStr = todayStr;
      prevStartDateStr = yesterdayStr;
      prevEndDateStr = todayStr;
    } else if (period === 'weekly') {
      const thisWeek = getWeekRangeInAppTz(todayStr);
      start = thisWeek.start;
      end = thisWeek.end;
      const mondayStr = new Date(thisWeek.start).toLocaleDateString('en-CA', {
        timeZone: 'Africa/Kampala',
      });
      const lastMondayStr = addDaysToDateStr(mondayStr, -7);
      periodStartDateStr = mondayStr;
      periodEndDateStr = addDaysToDateStr(mondayStr, 6);
      prevStartDateStr = lastMondayStr;
      prevEndDateStr = mondayStr;
    } else if (period === 'monthly') {
      const thisMonth = getMonthRangeInAppTz(todayStr);
      start = thisMonth.start;
      end = thisMonth.end;
      const [y, m] = todayStr.split('-').map(Number);
      const lastMonthStr = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
      periodStartDateStr = todayStr.slice(0, 7) + '-01';
      const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate();
      periodEndDateStr = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
      prevStartDateStr = lastMonthStr;
      prevEndDateStr = todayStr.slice(0, 7) + '-01';
    } else {
      const thisYear = getYearRangeInAppTz(todayStr);
      start = thisYear.start;
      end = thisYear.end;
      const [y] = todayStr.split('-').map(Number);
      const lastYearStr = `${y - 1}-01-01`;
      periodStartDateStr = todayStr.slice(0, 4) + '-01-01';
      periodEndDateStr = todayStr.slice(0, 4) + '-12-31';
      prevStartDateStr = lastYearStr;
      prevEndDateStr = todayStr.slice(0, 4) + '-01-01';
    }

    const periodOrders = allOrders.filter((o) => o.createdAt >= start && o.createdAt < end);

    const grossIncome = Number(revenuePeriod) || 0;

    const periodExpensesList = allExpenses.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= periodStartDateStr && d <= periodEndDateStr;
    });
    const INVENTORY_PURCHASE_PURPOSE = 'Inventory purchase';
    const operatingExpenses = periodExpensesList
      .filter((e) => (e.purpose || '').trim() !== INVENTORY_PURCHASE_PURPOSE)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expenses = Number(expensesPeriod) || 0;
    const netProfit = (Number(profitPeriod) || 0) - operatingExpenses;

    // Average order value
    const avgOrderValue = ordersPeriod > 0 ? grossIncome / ordersPeriod : 0;

    // Profit margin percentage
    const profitMargin = grossIncome > 0 ? (profitPeriod / grossIncome) * 100 : 0;
    const netProfitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

    // Top selling products (include returns as negative so net revenue/profit is correct)
    const productSalesMap = new Map<string, ProductSales>();
    periodOrders.forEach((order) => {
      const isReturn = order.orderType === 'return';
      const sign = isReturn ? -1 : 1;
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
          const qty = Number(item.qty) || 0;
          const sellingPrice = Number(item.sellingPrice) || 0;
          const costPrice = Number(item.costPrice) || 0;
          existing.qty += sign * qty;
          existing.revenue += sign * sellingPrice * qty;
          existing.profit += sign * (sellingPrice - costPrice) * qty;
          productSalesMap.set(item.productId, existing);
        }
      });
    });
    const topProducts = Array.from(productSalesMap.values())
      .filter((p) => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Payment method breakdown (use paymentSplits when present so split payments are accurate)
    const paymentMap = new Map<string, PaymentMethodBreakdown>();
    periodOrders.forEach((order) => {
      const splits = order.paymentSplits && order.paymentSplits.length > 0 ? order.paymentSplits : null;
      if (splits) {
        splits.forEach((split: { method: string; amount: number }) => {
          const method = split.method || 'cash';
          const amount = Number(split.amount) || 0;
          const existing = paymentMap.get(method) || { method, count: 0, amount: 0 };
          existing.count += 1;
          existing.amount += amount;
          paymentMap.set(method, existing);
        });
      } else {
        const method = order.paymentMethod || 'cash';
        const amount = Number(order.total) || 0;
        const existing = paymentMap.get(method) || { method, count: 0, amount: 0 };
        existing.count += 1;
        existing.amount += amount;
        paymentMap.set(method, existing);
      }
    });
    const paymentBreakdown = Array.from(paymentMap.values()).sort((a, b) => b.amount - a.amount);

    // Sales by channel
    const channelMap = new Map<string, { channel: string; count: number; revenue: number }>();
    periodOrders.forEach((order) => {
      const channel = order.channel || 'physical';
      const existing = channelMap.get(channel) || { channel, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(order.total) || 0;
      channelMap.set(channel, existing);
    });
    const channelBreakdown = Array.from(channelMap.values()).sort((a, b) => b.revenue - a.revenue);

    // Expenses by purpose (for period)
    const expensesByPurposeMap = new Map<string, { purpose: string; count: number; amount: number }>();
    periodExpensesList.forEach((e) => {
      const purpose = (e.purpose || 'Other').trim();
      const amount = Number(e.amount) || 0;
      const existing = expensesByPurposeMap.get(purpose) || { purpose, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += amount;
      expensesByPurposeMap.set(purpose, existing);
    });
    const expensesByPurpose = Array.from(expensesByPurposeMap.values()).sort((a, b) => b.amount - a.amount);

    // Low stock products (current inventory)
    const lowStockProducts = allProducts.filter(
      (p) => (Number(p.stock) || 0) <= (Number(p.minStockLevel) || 0)
    );
    const lowStockCount = lowStockProducts.length;
    const lowStockValue = lowStockProducts.reduce(
      (sum, p) => sum + (Number(p.stock) || 0) * (Number(p.costPrice) || 0),
      0
    );

    // Unique customers
    const uniqueCustomers = new Set(
      periodOrders.filter((o) => o.customerId).map((o) => o.customerId)
    ).size;

    // Return rate
    const returnOrders = periodOrders.filter((o) => o.orderType === 'return').length;
    const returnRate = ordersPeriod > 0 ? (returnOrders / ordersPeriod) * 100 : 0;

    // Growth calculations (avoid division by zero; treat 0 previous as no change)
    const revenueGrowth =
      previousPeriodRevenue > 0
        ? ((grossIncome - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : grossIncome > 0 ? 100 : 0;
    const profitGrowth =
      previousPeriodProfit > 0
        ? ((profitPeriod - previousPeriodProfit) / previousPeriodProfit) * 100
        : profitPeriod > 0 ? 100 : 0;
    const ordersGrowth =
      previousPeriodOrders > 0
        ? ((ordersPeriod - previousPeriodOrders) / previousPeriodOrders) * 100
        : ordersPeriod > 0 ? 100 : 0;
    const prevPeriodExpensesList = allExpenses.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= prevStartDateStr && d < prevEndDateStr;
    });
    const prevOperatingExpenses = prevPeriodExpensesList
      .filter((e) => (e.purpose || '').trim() !== INVENTORY_PURCHASE_PURPOSE)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const prevExpenses = Number(previousPeriodExpenses) || 0;
    const expenseGrowth =
      prevExpenses > 0
        ? ((expenses - prevExpenses) / prevExpenses) * 100
        : expenses > 0 ? 100 : 0;
    const prevNetProfit = (Number(previousPeriodProfit) || 0) - prevOperatingExpenses;
    const netProfitGrowth =
      prevNetProfit !== 0
        ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100
        : netProfit !== 0 ? 100 : 0;

    // Time series data for trends (Uganda/EAT)
    const timeSeriesData: Array<{ date: string; revenue: number; profit: number; expenses: number; orders: number }> = [];
    const formatDayLabel = (dayStr: string) =>
      new Date(getStartOfDayAppTzAsUTC(dayStr).getTime()).toLocaleDateString('en-GB', {
        timeZone: 'Africa/Kampala',
        month: 'short',
        day: '2-digit',
      });

    if (period === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const dayStr = addDaysToDateStr(todayStr, -i);
        const dayStart = getStartOfDayAppTzAsUTC(dayStr).toISOString();
        const dayEnd = getEndOfDayAppTzAsUTC(dayStr).toISOString();
        const dayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
        const dayExpenses = allExpenses.filter((e) => e.date.slice(0, 10) === dayStr);
        timeSeriesData.push({
          date: formatDayLabel(dayStr),
          revenue: dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
          profit: dayOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0),
          expenses: dayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
          orders: dayOrders.length,
        });
      }
    } else if (period === 'weekly') {
      const mondayStr = new Date(getWeekRangeInAppTz(todayStr).start).toLocaleDateString('en-CA', {
        timeZone: 'Africa/Kampala',
      });
      for (let i = 7; i >= 0; i--) {
        const weekMondayStr = addDaysToDateStr(mondayStr, -7 * i);
        const weekRange = getWeekRangeInAppTz(weekMondayStr);
        const weekOrders = allOrders.filter(
          (o) => o.createdAt >= weekRange.start && o.createdAt < weekRange.end
        );
        const weekEndDateStr = addDaysToDateStr(weekMondayStr, 6);
        const weekExpenses = allExpenses.filter((e) => {
          const d = e.date.slice(0, 10);
          return d >= weekMondayStr && d <= weekEndDateStr;
        });
        timeSeriesData.push({
          date: formatDayLabel(weekMondayStr),
          revenue: weekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
          profit: weekOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0),
          expenses: weekExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
          orders: weekOrders.length,
        });
      }
    } else if (period === 'monthly') {
      const [y, m] = todayStr.split('-').map(Number);
      for (let i = 11; i >= 0; i--) {
        const month = m - i <= 0 ? m - i + 12 : m - i;
        const year = m - i <= 0 ? y - 1 : y;
        const monthFirstStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const monthRange = getMonthRangeInAppTz(monthFirstStr);
        const monthOrders = allOrders.filter(
          (o) => o.createdAt >= monthRange.start && o.createdAt < monthRange.end
        );
        const lastD = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const monthLastStr = `${year}-${String(month).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const monthExpenses = allExpenses.filter((e) => {
          const d = e.date.slice(0, 10);
          return d >= monthFirstStr && d <= monthLastStr;
        });
        timeSeriesData.push({
          date: new Date(getStartOfDayAppTzAsUTC(monthFirstStr).getTime()).toLocaleDateString('en-GB', {
            timeZone: 'Africa/Kampala',
            month: 'short',
            year: 'numeric',
          }),
          revenue: monthOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
          profit: monthOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0),
          expenses: monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
          orders: monthOrders.length,
        });
      }
    } else {
      const [y] = todayStr.split('-').map(Number);
      for (let i = 4; i >= 0; i--) {
        const yearStr = `${y - i}-01-01`;
        const yearRange = getYearRangeInAppTz(yearStr);
        const yearOrders = allOrders.filter(
          (o) => o.createdAt >= yearRange.start && o.createdAt < yearRange.end
        );
        const yearEndStr = `${y - i}-12-31`;
        const yearExpenses = allExpenses.filter((e) => {
          const d = e.date.slice(0, 10);
          return d >= yearStr && d <= yearEndStr;
        });
        timeSeriesData.push({
          date: String(y - i),
          revenue: yearOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
          profit: yearOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0),
          expenses: yearExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
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
      expensesByPurpose,
      lowStockCount,
      lowStockValue,
      uniqueCustomers,
      returnRate,
      revenueGrowth,
      profitGrowth,
      ordersGrowth,
      expenseGrowth,
      netProfitGrowth,
      timeSeriesData,
    };
  }, [allOrders, allExpenses, allProducts, period, revenuePeriod, expensesPeriod, profitPeriod, ordersPeriod, previousPeriodRevenue, previousPeriodProfit, previousPeriodOrders, previousPeriodExpenses]);

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
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-red-700">{formatUGX(periodMetrics.expenses)}</p>
              {periodMetrics.expenseGrowth !== 0 && (
                <span
                  className={`text-xs ${periodMetrics.expenseGrowth > 0 ? 'text-red-600' : 'text-emerald-600'}`}
                >
                  {periodMetrics.expenseGrowth > 0 ? '+' : ''}{periodMetrics.expenseGrowth.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">vs {prevPeriodLabel}: {formatUGX(previousPeriodExpenses)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Net Profit</p>
            <p className="text-xs text-slate-500">(after expenses, excl. inventory purchase)</p>
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
              {periodMetrics.netProfitGrowth !== 0 && (
                <span className="ml-1">
                  · Net vs prev: {periodMetrics.netProfitGrowth > 0 ? '+' : ''}{periodMetrics.netProfitGrowth.toFixed(1)}%
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Low stock summary */}
      {(periodMetrics.lowStockCount > 0 || period === 'daily') && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Low stock
          </h3>
          <div className="flex flex-wrap items-baseline gap-4">
            <div>
              <p className="text-2xl font-bold text-amber-700">{periodMetrics.lowStockCount}</p>
              <p className="text-xs text-slate-500">products at or below min level</p>
            </div>
            {periodMetrics.lowStockCount > 0 && (
              <div>
                <p className="text-lg font-semibold text-slate-700">{formatUGX(periodMetrics.lowStockValue)}</p>
                <p className="text-xs text-slate-500">cost value of low stock</p>
              </div>
            )}
          </div>
        </div>
      )}

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

        {/* Expenses by purpose */}
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Receipt className="h-4 w-4" />
            Expenses by purpose ({periodLabel})
          </h3>
          <div className="space-y-2">
            {periodMetrics.expensesByPurpose.length === 0 ? (
              <p className="text-sm text-slate-500">No expenses in this period</p>
            ) : (
              periodMetrics.expensesByPurpose.slice(0, 8).map((ep) => (
                <div key={ep.purpose} className="flex justify-between text-sm">
                  <span className="text-slate-600 truncate max-w-[60%]" title={ep.purpose}>{ep.purpose}</span>
                  <div className="text-right shrink-0">
                    <span className="font-semibold text-red-700">{formatUGX(ep.amount)}</span>
                    <span className="ml-2 text-xs text-slate-500">({ep.count})</span>
                  </div>
                </div>
              ))
            )}
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
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorExpenses)"
                name="Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
