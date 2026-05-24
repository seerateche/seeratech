// ============================================================
// SEERA PLATFORM v4 - React Entry Point + Capacitor 5 Init
// ============================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  createBrowserRouter,
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
import { AuthGuard }        from './components/auth/AuthGuard';
import { UserRole }         from '@sira/shared';

// ── Capacitor 5 Runtime Init ──────────────────────────────────
async function initCapacitor(): Promise<void> {
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (!isNative) return;

  try {
    // StatusBar (Capacitor 5)
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});

    // SplashScreen
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 400 }).catch(() => {});

    // Hardware back button
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Network monitor
    const { Network } = await import('@capacitor/network');
    await Network.addListener('networkStatusChange', (status: { connected: boolean }) => {
      import('react-hot-toast').then(({ default: toast }) => {
        if (!status.connected) {
          toast.error('لا يوجد اتصال بالإنترنت', { id: 'offline', duration: Infinity });
        } else {
          toast.dismiss('offline');
        }
      });
    });

    console.log('✓ Capacitor 5 initialized');
  } catch (err) {
    console.debug('Capacitor init skipped:', err);
  }
}

// ── React Query ───────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// ── Router ────────────────────────────────────────────────────
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <DashboardLayout><Outlet /></DashboardLayout>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
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
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

// ── Bootstrap ─────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  await initCapacitor();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          containerStyle={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
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

bootstrap();
