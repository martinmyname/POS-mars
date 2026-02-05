import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from 'date-fns';

type Period = 'daily' | 'weekly' | 'monthly';

export default function ReportsPage() {
  const db = useRxDB();
  const { '*': splat } = useParams();
  const period: Period = splat === 'weekly' ? 'weekly' : splat === 'monthly' ? 'monthly' : 'daily';

  const [ordersToday, setOrdersToday] = useState<number>(0);
  const [revenueToday, setRevenueToday] = useState<number>(0);
  const [profitToday, setProfitToday] = useState<number>(0);
  const [expensesToday, setExpensesToday] = useState<number>(0);
  const [ordersPeriod, setOrdersPeriod] = useState<number>(0);
  const [revenuePeriod, setRevenuePeriod] = useState<number>(0);
  const [profitPeriod, setProfitPeriod] = useState<number>(0);
  const [expensesPeriod, setExpensesPeriod] = useState<number>(0);

  useEffect(() => {
    if (!db) return;

    const today = startOfDay(new Date()).toISOString();
    const tomorrow = startOfDay(subDays(new Date(), -1)).toISOString();

    const start =
      period === 'daily'
        ? today
        : period === 'weekly'
          ? startOfWeek(new Date()).toISOString()
          : startOfMonth(new Date()).toISOString();
    const end =
      period === 'daily'
        ? tomorrow
        : period === 'weekly'
          ? startOfWeek(subWeeks(new Date(), -1)).toISOString()
          : startOfMonth(subMonths(new Date(), -1)).toISOString();

    const subOrders = db.orders.find().$.subscribe((docs) => {
      const list = docs.filter((d) => !(d as { _deleted?: boolean })._deleted);
      const todayList = list.filter((o) => o.createdAt >= today && o.createdAt < tomorrow);
      const periodList = list.filter((o) => o.createdAt >= start && o.createdAt < end);

      setOrdersToday(todayList.length);
      setRevenueToday(todayList.reduce((s, o) => s + o.total, 0));
      setProfitToday(todayList.reduce((s, o) => s + o.grossProfit, 0));

      setOrdersPeriod(periodList.length);
      setRevenuePeriod(periodList.reduce((s, o) => s + o.total, 0));
      setProfitPeriod(periodList.reduce((s, o) => s + o.grossProfit, 0));
    });

    const subExpenses = db.expenses.find().$.subscribe((docs) => {
      const list = docs.filter((d) => !(d as { _deleted?: boolean })._deleted);
      const todayList = list.filter((e) => e.date >= today.slice(0, 10) && e.date < tomorrow.slice(0, 10));
      const periodList = list.filter((e) => e.date >= start.slice(0, 10) && e.date < end.slice(0, 10));

      setExpensesToday(todayList.reduce((s, e) => s + e.amount, 0));
      setExpensesPeriod(periodList.reduce((s, e) => s + e.amount, 0));
    });

    return () => {
      subOrders.unsubscribe();
      subExpenses.unsubscribe();
    };
  }, [db, period]);

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading database…
      </div>
    );
  }

  const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This week' : 'This month';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black">Reports</h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">← Dashboard</Link>
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
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm text-slate-600">Today – Orders</p>
          <p className="text-2xl font-bold">{ordersToday}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Today – Revenue</p>
          <p className="text-2xl font-bold text-emerald-700">{formatUGX(revenueToday)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Today – Profit</p>
          <p className="text-2xl font-bold text-emerald-700">{formatUGX(profitToday)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Today – Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatUGX(expensesToday)}</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-heading text-lg font-semibold">{periodLabel}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-600">Orders</p>
            <p className="text-xl font-bold">{ordersPeriod}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Revenue</p>
            <p className="text-xl font-bold text-green-700">{formatUGX(revenuePeriod)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Profit</p>
            <p className="text-xl font-bold text-green-700">{formatUGX(profitPeriod)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Expenses</p>
            <p className="text-xl font-bold text-red-700">{formatUGX(expensesPeriod)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
