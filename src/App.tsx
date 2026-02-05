import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SyncStatus } from '@/components/SyncStatus';
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

function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-brand-white/95 shadow-soft backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="font-heading text-xl font-bold tracking-tight text-tufts-blue transition hover:text-tufts-blue-hover"
        >
          Mars Kitchen Essentials
        </Link>
        <div className="flex items-center gap-4">
          <SyncStatus />
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="btn-secondary text-sm"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background-grey text-smoky-black">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </div>
      </main>
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
