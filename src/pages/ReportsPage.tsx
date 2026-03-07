import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useOrders, useExpenses, useProducts, useCustomers } from '@/hooks/useData';
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
import { EXPENSE_PURPOSE_OPTIONS } from '@/lib/expenseConstants';
import { TrendingUp, TrendingDown, Package, CreditCard, ShoppingCart, BarChart3, AlertTriangle, Receipt, Printer, FileText, ChevronRight } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';

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
  const { data: ordersList, loading } = useOrders({ realtime: true });
  const { data: expensesList } = useExpenses({ realtime: true });
  const { data: productsList } = useProducts({ realtime: true });
  const { data: customersList } = useCustomers({ realtime: true });
  useDayBoundaryTick();
  const { '*': splat } = useParams();
  const period: Period = splat === 'weekly' ? 'weekly' : splat === 'monthly' ? 'monthly' : splat === 'yearly' ? 'yearly' : 'daily';

  const todayStr = getTodayInAppTz();
  const today = getStartOfDayAppTzAsUTC(todayStr).toISOString();
  const tomorrow = getEndOfDayAppTzAsUTC(todayStr).toISOString();

  const reportData = useMemo(() => {
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
      const lastMondayStr = addDaysToDateStr(new Date(thisWeek.start).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' }), -7);
      const prevWeek = getWeekRangeInAppTz(lastMondayStr);
      prevStart = prevWeek.start;
      prevEnd = start;
    } else if (period === 'monthly') {
      const thisMonth = getMonthRangeInAppTz(todayStr);
      start = thisMonth.start;
      end = thisMonth.end;
      const [y, m] = todayStr.split('-').map(Number);
      const lastMonthStr = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
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
    const periodStartDateStr = period === 'daily' ? todayStr : period === 'weekly' ? new Date(start).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' }) : period === 'monthly' ? todayStr.slice(0, 7) + '-01' : todayStr.slice(0, 4) + '-01-01';
    const periodEndDateStr = period === 'daily' ? todayStr : period === 'weekly' ? addDaysToDateStr(new Date(start).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' }), 6) : period === 'monthly' ? (() => { const [yr, mo] = todayStr.split('-').map(Number); const lastD = new Date(Date.UTC(yr, mo, 0)).getUTCDate(); return `${yr}-${String(mo).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`; })() : todayStr.slice(0, 4) + '-12-31';
    const prevStartDateStr = new Date(prevStart).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
    const prevEndDateStr = new Date(prevEnd).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });

    const list = ordersList;
    const todayList = list.filter((o) => o.createdAt >= today && o.createdAt < tomorrow);
    const periodList = list.filter((o) => o.createdAt >= start && o.createdAt < end);
    const prevPeriodList = list.filter((o) => o.createdAt >= prevStart && o.createdAt < prevEnd);
    const ordersToday = todayList.length;
    const revenueToday = todayList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const profitToday = todayList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
    const ordersPeriod = periodList.length;
    const revenuePeriod = periodList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const profitPeriod = periodList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
    const previousPeriodOrders = prevPeriodList.length;
    const previousPeriodRevenue = prevPeriodList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const previousPeriodProfit = prevPeriodList.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);

    const expList = expensesList;
    const todayExpList = expList.filter((e) => e.date.slice(0, 10) === todayStr);
    const periodExpList = expList.filter((e) => { const d = e.date.slice(0, 10); return d >= periodStartDateStr && d <= periodEndDateStr; });
    const prevPeriodExpList = expList.filter((e) => { const d = e.date.slice(0, 10); return d >= prevStartDateStr && d < prevEndDateStr; });
    const expensesToday = todayExpList.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expensesPeriod = periodExpList.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const previousPeriodExpenses = prevPeriodExpList.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    return {
      ordersToday,
      revenueToday,
      profitToday,
      expensesToday,
      ordersPeriod,
      revenuePeriod,
      profitPeriod,
      expensesPeriod,
      previousPeriodOrders,
      previousPeriodRevenue,
      previousPeriodProfit,
      previousPeriodExpenses,
      allOrders: list,
      allExpenses: expList,
      allProducts: productsList,
    };
  }, [ordersList, expensesList, productsList, customersList, period, todayStr, today, tomorrow]);

  const { ordersToday, revenueToday, profitToday, expensesToday, ordersPeriod, revenuePeriod, profitPeriod, expensesPeriod, previousPeriodOrders, previousPeriodRevenue, previousPeriodProfit, previousPeriodExpenses, allOrders, allExpenses, allProducts } = reportData;

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
    const RESTOCK_PURPOSE = 'Stock';
    // Restock expenses (Stock purpose) - separate from operating expenses
    const restockExpenses = periodExpensesList
      .filter((e) => (e.purpose || '').trim() === RESTOCK_PURPOSE)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    // Operating expenses exclude both Inventory purchase (legacy) and Stock (restock)
    const operatingExpenses = periodExpensesList
      .filter((e) => {
        const purpose = (e.purpose || '').trim();
        return purpose !== INVENTORY_PURCHASE_PURPOSE && purpose !== RESTOCK_PURPOSE;
      })
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expenses = Number(expensesPeriod) || 0;
    const netProfit = (Number(profitPeriod) || 0) - operatingExpenses;

    // Average order value
    const avgOrderValue = ordersPeriod > 0 ? grossIncome / ordersPeriod : 0;

    // Profit margin percentage
    const profitMargin = grossIncome > 0 ? (profitPeriod / grossIncome) * 100 : 0;
    const netProfitMargin = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

    // Top selling products (include returns as negative so net revenue/profit is correct)
    // Only count paid orders to ensure we're tracking actual sales
    const productSalesMap = new Map<string, ProductSales>();
    periodOrders
      .filter((order) => order.status === 'paid')
      .forEach((order) => {
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
        (splits as { method: string; amount: number }[]).forEach((split) => {
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

    // Expenses by purpose (for period) - only show predefined purposes, exclude Stock (shown separately)
    const expensesByPurposeMap = new Map<string, { purpose: string; count: number; amount: number }>();
    
    // Initialize all predefined purposes with zero values (except Stock)
    EXPENSE_PURPOSE_OPTIONS.forEach((purpose) => {
      if (purpose !== RESTOCK_PURPOSE) {
        expensesByPurposeMap.set(purpose, { purpose, count: 0, amount: 0 });
      }
    });
    
    // Aggregate expenses, mapping non-standard purposes to 'other', excluding Stock
    periodExpensesList.forEach((e) => {
      const purpose = (e.purpose || '').trim();
      // Skip Stock expenses - they're shown separately
      if (purpose === RESTOCK_PURPOSE) return;
      const normalizedPurpose = (EXPENSE_PURPOSE_OPTIONS as readonly string[]).includes(purpose) ? purpose : 'other';
      const amount = Number(e.amount) || 0;
      const existing = expensesByPurposeMap.get(normalizedPurpose) || { purpose: normalizedPurpose, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += amount;
      expensesByPurposeMap.set(normalizedPurpose, existing);
    });
    
    // Filter out purposes with zero expenses and sort by amount
    const expensesByPurpose = Array.from(expensesByPurposeMap.values())
      .filter((ep) => ep.amount > 0 || ep.count > 0)
      .sort((a, b) => b.amount - a.amount);

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
      .filter((e) => {
        const purpose = (e.purpose || '').trim();
        return purpose !== INVENTORY_PURCHASE_PURPOSE && purpose !== RESTOCK_PURPOSE;
      })
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

    // Time series data for trends (Uganda/EAT) — include margin % for gross profit analytics
    const timeSeriesData: Array<{
      date: string;
      revenue: number;
      profit: number;
      expenses: number;
      orders: number;
      marginPct: number;
    }> = [];
    const formatDayLabel = (dayStr: string) =>
      new Date(getStartOfDayAppTzAsUTC(dayStr).getTime()).toLocaleDateString('en-GB', {
        timeZone: 'Africa/Kampala',
        month: 'short',
        day: '2-digit',
      });

    if (period === 'daily') {
      for (let i = 13; i >= 0; i--) {
        const dayStr = addDaysToDateStr(todayStr, -i);
        const dayStart = getStartOfDayAppTzAsUTC(dayStr).toISOString();
        const dayEnd = getEndOfDayAppTzAsUTC(dayStr).toISOString();
        const dayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
        const dayExpenses = allExpenses.filter((e) => e.date.slice(0, 10) === dayStr);
        const dayOperatingExpenses = dayExpenses
          .filter((e) => {
            const purpose = (e.purpose || '').trim();
            return purpose !== INVENTORY_PURCHASE_PURPOSE && purpose !== RESTOCK_PURPOSE;
          })
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const dayRevenue = dayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const dayProfit = dayOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
        timeSeriesData.push({
          date: formatDayLabel(dayStr),
          revenue: dayRevenue,
          profit: dayProfit,
          expenses: dayOperatingExpenses,
          orders: dayOrders.length,
          marginPct: dayRevenue > 0 ? (dayProfit / dayRevenue) * 100 : 0,
        });
      }
    } else if (period === 'weekly') {
      const mondayStr = new Date(getWeekRangeInAppTz(todayStr).start).toLocaleDateString('en-CA', {
        timeZone: 'Africa/Kampala',
      });
      for (let i = 11; i >= 0; i--) {
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
        const weekOperatingExpenses = weekExpenses
          .filter((e) => {
            const purpose = (e.purpose || '').trim();
            return purpose !== INVENTORY_PURCHASE_PURPOSE && purpose !== RESTOCK_PURPOSE;
          })
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const weekRevenue = weekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const weekProfit = weekOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
        timeSeriesData.push({
          date: formatDayLabel(weekMondayStr),
          revenue: weekRevenue,
          profit: weekProfit,
          expenses: weekOperatingExpenses,
          orders: weekOrders.length,
          marginPct: weekRevenue > 0 ? (weekProfit / weekRevenue) * 100 : 0,
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
        const monthOperatingExpenses = monthExpenses
          .filter((e) => {
            const purpose = (e.purpose || '').trim();
            return purpose !== INVENTORY_PURCHASE_PURPOSE && purpose !== RESTOCK_PURPOSE;
          })
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const monthRevenue = monthOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const monthProfit = monthOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
        timeSeriesData.push({
          date: new Date(getStartOfDayAppTzAsUTC(monthFirstStr).getTime()).toLocaleDateString('en-GB', {
            timeZone: 'Africa/Kampala',
            month: 'short',
            year: 'numeric',
          }),
          revenue: monthRevenue,
          profit: monthProfit,
          expenses: monthOperatingExpenses,
          orders: monthOrders.length,
          marginPct: monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0,
        });
      }
    } else {
      const [y] = todayStr.split('-').map(Number);
      for (let i = 5; i >= 0; i--) {
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
        const yearOperatingExpenses = yearExpenses
          .filter((e) => {
            const purpose = (e.purpose || '').trim();
            return purpose !== INVENTORY_PURCHASE_PURPOSE && purpose !== RESTOCK_PURPOSE;
          })
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const yearRevenue = yearOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const yearProfit = yearOrders.reduce((s, o) => s + (Number(o.grossProfit) || 0), 0);
        timeSeriesData.push({
          date: String(y - i),
          revenue: yearRevenue,
          profit: yearProfit,
          expenses: yearOperatingExpenses,
          orders: yearOrders.length,
          marginPct: yearRevenue > 0 ? (yearProfit / yearRevenue) * 100 : 0,
        });
      }
    }

    // Gross profit past analytics: same buckets as time series with labels for table
    const grossProfitHistory = timeSeriesData.map((row) => ({
      periodLabel: row.date,
      revenue: row.revenue,
      grossProfit: row.profit,
      marginPct: row.marginPct,
      orders: row.orders,
    })).reverse();

    // Hourly breakdown for daily view (today only, app timezone)
    type HourlyBucket = { hour: number; hourLabel: string; revenue: number; profit: number; orders: number };
    const hourlyBreakdown: HourlyBucket[] = [];
    if (period === 'daily') {
      const dayStart = getStartOfDayAppTzAsUTC(todayStr).toISOString();
      const dayEnd = getEndOfDayAppTzAsUTC(todayStr).toISOString();
      const todayOrders = allOrders.filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd);
      const getHourAppTz = (iso: string) => {
        const h = new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Kampala', hour: '2-digit', hour12: false });
        return parseInt(h, 10) || 0;
      };
      for (let h = 0; h < 24; h++) {
        hourlyBreakdown.push({
          hour: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          revenue: 0,
          profit: 0,
          orders: 0,
        });
      }
      todayOrders.forEach((o) => {
        const hour = getHourAppTz(o.createdAt);
        if (hour >= 0 && hour < 24) {
          const b = hourlyBreakdown[hour];
          b.revenue += Number(o.total) || 0;
          b.profit += Number(o.grossProfit) || 0;
          b.orders += 1;
        }
      });
    }

    return {
      grossProfit: Number(profitPeriod) || 0,
      previousPeriodGrossProfit: Number(previousPeriodProfit) || 0,
      grossIncome,
      expenses,
      restockExpenses,
      operatingExpenses,
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
      grossProfitHistory,
      hourlyBreakdown,
    };
  }, [allOrders, allExpenses, allProducts, period, revenuePeriod, expensesPeriod, profitPeriod, ordersPeriod, previousPeriodRevenue, previousPeriodProfit, previousPeriodOrders, previousPeriodExpenses]);

  if (loading) {
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

  // Report period date range and generated time for stakeholders
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

  return (
    <div className="report-page space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black">Reports</h1>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary inline-flex items-center gap-2 text-sm"
            aria-label="Print or save as PDF"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
          <Link to="/" className="btn-secondary inline-flex w-fit text-sm">
            ← Dashboard
          </Link>
        </div>
      </div>

      <nav className="flex gap-2 no-print" aria-label="Report period">
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
            <p className="text-sm text-slate-600">Revenue</p>
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
            <p className="text-sm text-slate-600">Gross Profit</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-emerald-700">{formatUGX(periodMetrics.grossProfit)}</p>
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
            <p className="text-xs text-slate-500">vs {prevPeriodLabel}: {formatUGX(periodMetrics.previousPeriodGrossProfit)} · Margin: {periodMetrics.profitMargin.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Operating Expenses</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-red-700">{formatUGX(periodMetrics.operatingExpenses)}</p>
            </div>
            <p className="text-xs text-slate-500">(excl. restock expenses)</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Restock Expenses</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-orange-700">{formatUGX(periodMetrics.restockExpenses)}</p>
            </div>
            <p className="text-xs text-slate-500">(Stock purchases, not deducted from profit)</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Net Profit</p>
            <p className="text-xs text-slate-500">(after operating expenses, excl. restock)</p>
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

      {/* Sales by Hour (daily view only) */}
      {period === 'daily' && periodMetrics.hourlyBreakdown.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            <BarChart3 className="h-5 w-5 text-tufts-blue" />
            Sales by Hour (Today)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={periodMetrics.hourlyBreakdown} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hourLabel" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => formatUGX(v)} />
              <Tooltip
                formatter={(value: number) => formatUGX(value)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                labelFormatter={(label) => `Hour ${label}`}
              />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[2, 2, 0, 0]} />
              <Bar dataKey="profit" fill="#3b82f6" name="Gross Profit" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {periodMetrics.hourlyBreakdown.filter((h) => h.orders > 0).length > 0 ? (
              periodMetrics.hourlyBreakdown
                .filter((h) => h.orders > 0)
                .map((h) => (
                  <div key={h.hour} className="rounded-lg bg-slate-50 p-2">
                    <span className="font-medium text-slate-700">{h.hourLabel}</span>
                    <span className="ml-1 text-slate-500">· {h.orders} orders</span>
                    <div className="mt-0.5 text-emerald-700">{formatUGX(h.revenue)}</div>
                    <div className="text-tufts-blue">{formatUGX(h.profit)} profit</div>
                  </div>
                ))
            ) : (
              <p className="text-slate-500">No sales yet today.</p>
            )}
          </div>
        </div>
      )}

      {/* Gross Profit Past Analytics */}
      {periodMetrics.grossProfitHistory.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            <TrendingUp className="h-5 w-5 text-tufts-blue" />
            Gross Profit Past Analytics
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-slate-600">Period</th>
                  <th className="px-3 py-2 text-right text-slate-600">Orders</th>
                  <th className="px-3 py-2 text-right text-slate-600">Revenue</th>
                  <th className="px-3 py-2 text-right text-slate-600">Gross Profit</th>
                  <th className="px-3 py-2 text-right text-slate-600">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {periodMetrics.grossProfitHistory.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{row.periodLabel}</td>
                    <td className="px-3 py-2 text-right">{row.orders}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatUGX(row.revenue)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatUGX(row.grossProfit)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{row.marginPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = periodMetrics.timeSeriesData.find((d) => d.date === label);
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="mb-2 font-medium text-slate-800">{label}</p>
                      {payload.map((p) => (
                        <div key={p.dataKey} className="flex justify-between gap-4 text-sm">
                          <span className="text-slate-600">{p.name}</span>
                          <span className="font-medium">{formatUGX(Number(p.value))}</span>
                        </div>
                      ))}
                      {row && row.revenue > 0 && (
                        <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                          Gross margin: {row.marginPct.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                }}
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
                name="Operating Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ——— Shareholder section (end of page) ——— */}
      <div className="border-t border-slate-200 pt-8">
        <h2 className="mb-4 font-heading text-xl font-bold text-smoky-black">For shareholders &amp; stakeholders</h2>

        {/* Report header */}
        <div className="card border-tufts-blue/20 bg-slate-50/50 p-5 print:bg-white print:border-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-heading text-xl font-bold tracking-tight text-smoky-black">
                Sales &amp; Performance Report
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {periodLabel} · {periodRangeLabel}
              </p>
              <p className="mt-1 text-xs text-slate-500 print:block">
                Generated on {generatedAt} (EAT)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary inline-flex items-center gap-2 text-sm"
                aria-label="Print or save as PDF"
              >
                <Printer className="h-4 w-4" />
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>

        {/* Executive summary */}
        <div className="card border-l-4 border-l-tufts-blue p-5 print:border-l-slate-300 mt-6">
          <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-smoky-black">
            <FileText className="h-5 w-5 text-tufts-blue" />
            Executive Summary
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              <strong>Revenue</strong> for {periodLabel.toLowerCase()} was <strong className="text-emerald-700">{formatUGX(periodMetrics.grossIncome)}</strong>
              {periodMetrics.revenueGrowth !== 0 && (
                <span className={periodMetrics.revenueGrowth > 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {' '}({periodMetrics.revenueGrowth > 0 ? '+' : ''}{periodMetrics.revenueGrowth.toFixed(1)}% vs {prevPeriodLabel.toLowerCase()}).
                </span>
              )}
            </li>
            <li>
              <strong>Gross profit</strong> was <strong className="text-emerald-700">{formatUGX(periodMetrics.grossProfit)}</strong>
              {periodMetrics.profitGrowth !== 0 && (
                <span className={periodMetrics.profitGrowth > 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {' '}({periodMetrics.profitGrowth > 0 ? '+' : ''}{periodMetrics.profitGrowth.toFixed(1)}% vs {prevPeriodLabel.toLowerCase()})
                </span>
              )}
              , with a <strong>gross margin</strong> of {periodMetrics.profitMargin.toFixed(1)}%.
            </li>
            <li>
              <strong>Net profit</strong> (after operating expenses, excluding stock purchases) was{' '}
              <strong className={periodMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                {formatUGX(periodMetrics.netProfit)}
              </strong>
              {periodMetrics.netProfitGrowth !== 0 && (
                <span className={periodMetrics.netProfitGrowth > 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {' '}({periodMetrics.netProfitGrowth > 0 ? '+' : ''}{periodMetrics.netProfitGrowth.toFixed(1)}% vs {prevPeriodLabel.toLowerCase()}).
                </span>
              )}
            </li>
            <li>
              {ordersPeriod} orders in period · Average order value {formatUGX(periodMetrics.avgOrderValue)} · {periodMetrics.uniqueCustomers} unique customers.
            </li>
          </ul>
        </div>

        {/* Understanding this report */}
        <details className="no-print group card overflow-hidden mt-6">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tufts-blue">
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
            Understanding this report
          </summary>
          <div className="border-t border-slate-200 px-4 pb-4 pt-2 text-sm text-slate-600">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="font-medium text-slate-700">Revenue</dt><dd>Total sales (before any deductions).</dd></div>
              <div><dt className="font-medium text-slate-700">Gross profit</dt><dd>Revenue minus cost of goods sold (what we paid for products).</dd></div>
              <div><dt className="font-medium text-slate-700">Gross margin</dt><dd>Gross profit as a % of revenue.</dd></div>
              <div><dt className="font-medium text-slate-700">Operating expenses</dt><dd>Day-to-day costs (rent, utilities, salaries, etc.), excluding stock purchases.</dd></div>
              <div><dt className="font-medium text-slate-700">Restock / Stock</dt><dd>Money spent on buying inventory; shown separately and not deducted from profit here.</dd></div>
              <div><dt className="font-medium text-slate-700">Net profit</dt><dd>Gross profit minus operating expenses.</dd></div>
            </dl>
          </div>
        </details>
      </div>
    </div>
  );
}
