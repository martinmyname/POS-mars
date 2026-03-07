import { useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProducts, useOrders, useExpenses } from '@/hooks/useData';
import { useDayBoundaryTick } from '@/hooks/useDayBoundaryTick';
import { formatUGX } from '@/lib/formatUGX';
import { getTodayInAppTz, getStartOfDayAppTzAsUTC, getEndOfDayAppTzAsUTC } from '@/lib/appTimezone';
import { format, parseISO } from 'date-fns';
import {
  ShoppingCart,
  Package,
  TrendingUp,
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

  const { productCount, lowStockCount, ordersToday, revenueToday, expensesToday, scheduledDueToday, scheduledUpcoming } = useMemo(() => {
    const productCount = productsList.length;
    const lowStockCount = productsList.filter((p) => p.stock <= p.minStockLevel).length;
    const todayOrders = ordersList.filter((o) => o.createdAt >= today && o.createdAt < tomorrow);
    const ordersToday = todayOrders.length;
    const revenueToday = todayOrders.reduce((s, o) => s + o.total, 0);
    const todayExp = expensesList.filter((e) => e.date.slice(0, 10) === todayStr);
    const expensesToday = todayExp.reduce((s, e) => s + e.amount, 0);
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
    return {
      productCount,
      lowStockCount,
      ordersToday,
      revenueToday,
      expensesToday,
      scheduledDueToday,
      scheduledUpcoming,
    };
  }, [productsList, ordersList, expensesList, today, tomorrow, todayStr]);

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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">Orders today</p>
                <p className="text-lg sm:text-2xl font-bold text-smoky-black truncate">{ordersToday}</p>
              </div>
            </div>
          </div>
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">Revenue today</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-700 truncate">{formatUGX(revenueToday)}</p>
              </div>
            </div>
          </div>
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
            <div className="col-span-full card p-4 sm:p-5">
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
                  <Link to="/deliveries" className="mt-2 inline-block text-sm font-medium text-amber-800 underline">
                    View deliveries →
                  </Link>
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
            </div>
          )}
        </div>

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
