// ============================================================
// SEERA PLATFORM v4 - Axios API Client
// Auto-detects native Capacitor context vs browser
// ============================================================
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

// ── API Base URL Detection ────────────────────────────────────
function getBaseUrl(): string {
  const cap = (window as any).Capacitor;
  const isNative = cap?.isNativePlatform?.() === true;

  if (isNative) {
    // في التطبيق الأصلي — استخدم عنوان السيرفر الفعلي
    // عدّل هذا الرابط ليشير لـ API server الخاص بك
    const serverUrl = (import.meta as any).env?.VITE_API_URL
      || 'https://YOUR-API-SERVER.com';
    return `${serverUrl}/api/v1`;
  }

  // في المتصفح — استخدم proxy (يعمل مع vite dev server)
  return '/api/v1';
}

const BASE_URL = getBaseUrl();

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
  baseURL: BASE_URL,
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
    }
  } catch {}
  return config;
});

// ── Response: auto-refresh JWT ────────────────────────────────
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
        const raw   = localStorage.getItem('sira-auth');
        const state = raw ? JSON.parse(raw) : null;
        const rt    = state?.state?.refreshToken;
        if (!rt) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
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
