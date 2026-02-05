import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { formatUGX } from '@/lib/formatUGX';
import { startOfDay, subDays } from 'date-fns';
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
} from 'lucide-react';

export default function DashboardPage() {
  const db = useRxDB();
  const { isSyncing, isInitialSync } = useSyncStatus();
  const [productCount, setProductCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [expensesToday, setExpensesToday] = useState(0);

  useEffect(() => {
    if (!db) return;

    const today = startOfDay(new Date()).toISOString();
    const tomorrow = startOfDay(subDays(new Date(), -1)).toISOString();

    const subProducts = db.products.find().$.subscribe((docs) => {
      const list = docs.filter((d) => !(d as { _deleted?: boolean })._deleted);
      setProductCount(list.length);
      setLowStockCount(list.filter((p) => p.stock <= p.minStockLevel).length);
    });

    const subOrders = db.orders.find().$.subscribe((docs) => {
      const todayOrders = docs.filter(
        (d) => !(d as { _deleted?: boolean })._deleted && d.createdAt >= today && d.createdAt < tomorrow
      );
      setOrdersToday(todayOrders.length);
      setRevenueToday(todayOrders.reduce((s, o) => s + o.total, 0));
    });

    const subExpenses = db.expenses.find().$.subscribe((docs) => {
      const todayStr = today.slice(0, 10);
      const tomorrowStr = tomorrow.slice(0, 10);
      const todayExp = docs.filter(
        (d) => !(d as { _deleted?: boolean })._deleted && d.date >= todayStr && d.date < tomorrowStr
      );
      setExpensesToday(todayExp.reduce((s, e) => s + e.amount, 0));
    });

    return () => {
      subProducts.unsubscribe();
      subOrders.unsubscribe();
      subExpenses.unsubscribe();
    };
  }, [db]);

  const navItems = [
    { to: '/pos', label: 'POS Checkout', icon: ShoppingCart, primary: true },
    { to: '/deliveries', label: 'Deliveries', icon: Bike },
    { to: '/returns', label: 'Returns', icon: RotateCcw },
    { to: '/expenses', label: 'Expenses', icon: Wallet },
    { to: '/inventory', label: 'Inventory', icon: Archive },
    { to: '/suppliers', label: 'Suppliers', icon: Truck },
    { to: '/reports/daily', label: 'Reports', icon: BarChart3 },
    { to: '/promotions', label: 'Promotions', icon: Tag },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-tufts-blue border-t-transparent"></div>
          <p className="text-slate-600">Loading database...</p>
        </div>
      </div>
    );
  }

  if (isSyncing && !isInitialSync) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-slate-500">Overview of your store today</p>
        </div>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-tufts-blue border-t-transparent"></div>
            <p className="text-slate-600">Syncing data from server...</p>
            <p className="mt-1 text-sm text-slate-400">This may take a few seconds</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-slate-500">Overview of your store today</p>
      </div>

      {db && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <Package className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Products</p>
                <p className="text-2xl font-bold text-smoky-black">{productCount}</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <Receipt className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Orders today</p>
                <p className="text-2xl font-bold text-smoky-black">{ordersToday}</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <TrendingUp className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Revenue today</p>
                <p className="text-2xl font-bold text-emerald-700">{formatUGX(revenueToday)}</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <Wallet className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Expenses today</p>
                <p className="text-2xl font-bold text-red-600">{formatUGX(expensesToday)}</p>
              </div>
            </div>
          </div>
          {lowStockCount > 0 && (
            <Link
              to="/inventory"
              className="card-hover col-span-full flex items-center gap-4 rounded-xl border-amber-200 bg-amber-50/80 p-5 text-amber-900 sm:col-span-2"
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
        </div>
      )}

      <div>
        <h2 className="mb-4 font-heading text-lg font-semibold text-smoky-black">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {navItems.map(({ to, label, icon: Icon, primary }) => (
            <Link
              key={to}
              to={to}
              className={
                primary
                  ? 'card-hover flex items-center gap-4 rounded-xl bg-tufts-blue p-4 text-white'
                  : 'card-hover flex items-center gap-4 rounded-xl p-4'
              }
            >
              <div
                className={
                  primary ? 'rounded-lg bg-white/20 p-2' : 'rounded-lg bg-slate-100 p-2'
                }
              >
                <Icon className={`h-5 w-5 ${primary ? 'text-white' : 'text-slate-600'}`} />
              </div>
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
