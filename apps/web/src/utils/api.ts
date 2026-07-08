// ============================================================
// SEERA PLATFORM v4 - Axios API Client
// Web: relative /api/v1 (nginx proxy)
// Native APK: absolute URL from VITE_API_BASE_URL env var
// ============================================================
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

// ── API Base URL resolution ───────────────────────────────────
// Web (browser/PWA): relative path → nginx reverse-proxy handles /api → backend.
// Native (Capacitor APK): WebView is served from virtual host (https://seera.app)
//   which has NO backend — a relative path would NEVER reach the server.
//   Set VITE_API_BASE_URL in apps/web/.env  →  VITE_API_BASE_URL=https://api.yourdomain.com
const ENV_BASE = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
const isNativeApp = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

const API_BASE_URL = ENV_BASE
  ? `${ENV_BASE.replace(/\/$/, '')}/api/v1`
  : '/api/v1';

if (isNativeApp && !ENV_BASE && typeof console !== 'undefined') {
  console.warn(
    '[Seera] Running as native app but VITE_API_BASE_URL is not set. ' +
    'API calls will fail. Rebuild with VITE_API_BASE_URL=https://your-api-server.com',
  );
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: any)    => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else if (token) p.resolve(token);
  });
  failedQueue = [];
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach JWT ───────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  try {
    const raw = localStorage.getItem('sira-auth');
    if (raw) {
      const state = JSON.parse(raw);
      const token = state?.state?.accessToken;
      if (token) config.headers.Authorization = `Bearer ${token}`;
      
      const companyId = state?.state?.user?.companyId;
      if (companyId) config.headers['x-company-id'] = companyId;
    }
  } catch {}
  return config;
});

// ── Response: auto-refresh JWT on 401 ────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const orig = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !orig._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              orig.headers.Authorization = `Bearer ${token}`;
              resolve(api(orig));
            },
            reject,
          });
        });
      }

      orig._retry  = true;
      isRefreshing = true;

      try {
        const raw = localStorage.getItem('sira-auth');
        const state = raw ? JSON.parse(raw) : null;
        const rt = state?.state?.refreshToken;
        if (!rt) throw new Error('No refresh token');

        // Use resolved base URL (not hardcoded /api/v1)
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: rt,
        });
        const newToken = data.data.accessToken;

        if (raw) {
          const p = JSON.parse(raw);
          p.state.accessToken = newToken;
          localStorage.setItem('sira-auth', JSON.stringify(p));
        }

        orig.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(orig);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('sira-auth');
        window.location.hash = '#/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      (error.response?.data as any)?.message ||
      error.message ||
      'حدث خطأ غير متوقع';

    if (error.response?.status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  },
);

// ── Typed helpers ─────────────────────────────────────────────
export const apiGet    = <T>(url: string, params?: any) =>
  api.get<{ success: boolean; data: T }>(url, { params }).then((r) => r.data.data);

export const apiPost   = <T>(url: string, body?: any) =>
  api.post<{ success: boolean; data: T }>(url, body).then((r) => r.data.data);

export const apiPut    = <T>(url: string, body?: any) =>
  api.put<{ success: boolean; data: T }>(url, body).then((r) => r.data.data);

export const apiPatch  = <T>(url: string, body?: any) =>
  api.patch<{ success: boolean; data: T }>(url, body).then((r) => r.data.data);

export const apiDelete = <T>(url: string) =>
  api.delete<{ success: boolean; data: T }>(url).then((r) => r.data.data);
