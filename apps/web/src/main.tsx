// ============================================================
// SEERA PLATFORM v4 - Main Entry Point
// FIX: createHashRouter instead of createBrowserRouter
// FIX: API URL configuration for native Capacitor context
// ============================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  createHashRouter,   // ← الإصلاح الأساسي: Hash routing لـ Capacitor
  RouterProvider,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Pages
import { LoginPage }        from './pages/auth/LoginPage';
import { DashboardLayout }  from './components/layout/DashboardLayout';
import { GodModeDashboard } from './pages/god-mode/GodModeDashboard';
import { CompanyDashboard } from './pages/company/CompanyDashboard';
import { DevicesPage }      from './pages/devices/DevicesPage';
import { MikroTikPage }     from './pages/devices/MikroTikPage';
import { VouchersPage }     from './pages/devices/VouchersPage';
import { AttendancePage }   from './pages/devices/AttendancePage';
import { CctvPage }         from './pages/devices/CctvPage';
import { IspQuotaView }     from './pages/isp/IspQuotaView';
import { BillingDashboard } from './pages/billing/BillingDashboard';
import { InvoicesPage }     from './pages/billing/InvoicesPage';
import { QuotationsPage }   from './pages/billing/QuotationsPage';
import { ExpensesPage }     from './pages/billing/ExpensesPage';
import { AuthGuard }        from './components/auth/AuthGuard';
import { UserRole }         from '@sira/shared';

// ── Capacitor 5 Init ──────────────────────────────────────────
async function initCapacitor(): Promise<void> {
  const cap = (window as any).Capacitor;
  const isNative = cap?.isNativePlatform?.() === true;
  if (!isNative) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});

    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});

    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });

    console.log('✓ Capacitor initialized');
  } catch (e) {
    // browser context — ignore
  }
}

// ── React Query ───────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      retry:                1,
      refetchOnWindowFocus: false,
      networkMode:          'always', // لا نريد offlineFirst في native
    },
    mutations: {
      networkMode: 'always',
    },
  },
});

// ── Hash Router (Capacitor-safe) ──────────────────────────────
// createHashRouter يستخدم /#/path بدلاً من /path
// يعمل بدون server-side routing — ضروري لـ Capacitor WebView
const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <DashboardLayout><Outlet /></DashboardLayout>
      </AuthGuard>
    ),
    children: [
      { index: true,  element: <Navigate to="/dashboard" replace /> },
      {
        path: 'god-mode',
        element: (
          <AuthGuard requiredRole={UserRole.SUPER_ADMIN}>
            <GodModeDashboard />
          </AuthGuard>
        ),
      },
      { path: 'dashboard',                  element: <CompanyDashboard /> },
      { path: 'devices',                    element: <DevicesPage /> },
      { path: 'devices/:deviceId/mikrotik', element: <MikroTikPage /> },
      { path: 'vouchers',                   element: <VouchersPage /> },
      { path: 'attendance',                 element: <AttendancePage /> },
      { path: 'cctv',                       element: <CctvPage /> },
      { path: 'isp-quota',                  element: <IspQuotaView /> },
      { path: 'billing',                    element: <BillingDashboard /> },
      { path: 'billing/invoices',           element: <InvoicesPage /> },
      { path: 'billing/quotations',         element: <QuotationsPage /> },
      { path: 'billing/expenses',           element: <ExpensesPage /> },
      { path: '*',                          element: <Navigate to="/dashboard" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]);

// ── Bootstrap ─────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  // Capacitor init أولاً قبل React
  await initCapacitor();

  const root = document.getElementById('root');
  if (!root) {
    console.error('FATAL: #root element not found');
    return;
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          containerStyle={{
            top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          }}
          toastOptions={{
            style: {
              background:   '#1e293b',
              color:        '#f1f5f9',
              border:       '1px solid #334155',
              fontFamily:   'IBM Plex Sans Arabic, sans-serif',
              direction:    'rtl',
              fontSize:     '14px',
              padding:      '12px 16px',
              borderRadius: '12px',
              maxWidth:     '90vw',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1e293b' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#1e293b' }, duration: 4000 },
          }}
        />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

// تشغيل bootstrap مع error boundary عام
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  // عرض رسالة خطأ بدلاً من spinner لا نهائي
  const root = document.getElementById('root');
  if (root) {
    // Escape the error message to prevent XSS via innerHTML interpolation.
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const safeMessage = escapeHtml(String(err?.message || 'Unknown error'));
    root.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-height:100vh;
        background:#0f172a;color:#ef4444;
        font-family:sans-serif;text-align:center;padding:20px;
      ">
        <p style="font-size:18px;margin-bottom:8px">⚠️ فشل تحميل التطبيق</p>
        <p style="font-size:12px;color:#64748b">${safeMessage}</p>
        <button onclick="location.reload()" style="
          margin-top:16px;padding:10px 24px;
          background:#6366f1;color:white;border:none;
          border-radius:8px;cursor:pointer;font-size:14px;
        ">إعادة التحميل</button>
      </div>
    `;
  }
});
