import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SyncStatus } from '@/components/SyncStatus';
import { LayoutDashboard, ShoppingCart, BarChart3, Bike } from 'lucide-react';
import '@/index.css';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const POSPage = lazy(() => import('@/pages/POSPage'));
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const PromotionsPage = lazy(() => import('@/pages/PromotionsPage'));
const CustomersPage = lazy(() => import('@/pages/CustomersPage'));
const ReturnsPage = lazy(() => import('@/pages/ReturnsPage'));
const DeliveriesPage = lazy(() => import('@/pages/DeliveriesPage'));
const SuppliersPage = lazy(() => import('@/pages/SuppliersPage'));
const LayawaysPage = lazy(() => import('@/pages/LayawaysPage'));
const CashManagementPage = lazy(() => import('@/pages/CashManagementPage'));

const BOTTOM_NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/deliveries', label: 'Deliveries', icon: Bike },
  { to: '/reports/daily', label: 'Reports', icon: BarChart3 },
];

function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-brand-white/95 pt-[env(safe-area-inset-top)] shadow-soft backdrop-blur-sm">
      <div className="mx-auto flex max-w-app items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
        <Link
          to="/"
          className="flex items-center gap-2 font-heading font-bold tracking-tight text-tufts-blue transition hover:text-tufts-blue-hover"
        >
          <img src="/logo.png" alt="Mars Kitchen Essentials" className="h-8 w-8 shrink-0 object-contain" />
          <span className="hidden text-lg sm:inline sm:text-xl">Mars Kitchen Essentials</span>
          <span className="text-lg sm:hidden">MKE POS</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <SyncStatus />
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="btn-secondary text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const items = BOTTOM_NAV_ITEMS.map((item) => ({
    ...item,
    active: item.to !== '/' ? path.startsWith(item.to) : path === '/',
  }));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-slate-200/80 bg-brand-white/98 pb-[env(safe-area-inset-bottom)] pt-2 shadow-bottom-nav md:hidden"
      aria-label="Main navigation"
    >
      {items.map(({ to, label, icon: Icon, active }) => (
        <Link
          key={to}
          to={to}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition touch-target ${
            active ? 'text-tufts-blue' : 'text-slate-500 hover:text-slate-700'
          }`}
          aria-current={active ? 'page' : undefined}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
          <span className="text-[10px] font-medium">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function AppLayout() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <div className="flex min-h-screen flex-col bg-background-grey text-smoky-black">
      {!isLogin && <Header />}
      <main
        className={`flex-1 px-3 py-4 sm:px-6 sm:py-6 ${!isLogin ? 'pb-24 md:pb-6' : ''}`}
      >
        <div className="mx-auto max-w-app">
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
                <span className="animate-pulse">Loading…</span>
              </div>
            }
          >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route
              path="/pos"
              element={
                <ProtectedRoute>
                  <POSPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <ExpensesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/*"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/promotions"
              element={
                <ProtectedRoute>
                  <PromotionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/returns"
              element={
                <ProtectedRoute>
                  <ReturnsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deliveries"
              element={
                <ProtectedRoute>
                  <DeliveriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <SuppliersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/layaways"
              element={
                <ProtectedRoute>
                  <LayawaysPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cash"
              element={
                <ProtectedRoute>
                  <CashManagementPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </div>
      </main>
      {!isLogin && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
