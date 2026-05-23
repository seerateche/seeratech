// ============================================================
// SIRA PLATFORM v4 - Axios API Client with JWT Auto-Refresh
// ============================================================
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else if (token) p.resolve(token);
  });
  failedQueue = [];
};

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const raw = localStorage.getItem('sira-auth');
  if (raw) {
    try {
      const state = JSON.parse(raw);
      const token = state?.state?.accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
  }
  return config;
});

// Response interceptor: auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const raw = localStorage.getItem('sira-auth');
        const state = raw ? JSON.parse(raw) : null;
        const refreshToken = state?.state?.refreshToken;

        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const newToken = data.data.accessToken;

        // Update store
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.state.accessToken = newToken;
          localStorage.setItem('sira-auth', JSON.stringify(parsed));
        }

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('sira-auth');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Show error toast for common errors
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

// Typed request helpers
export const apiGet = <T>(url: string, params?: any) =>
  api.get<{ success: boolean; data: T }>(url, { params }).then((r) => r.data.data);

export const apiPost = <T>(url: string, body?: any) =>
  api.post<{ success: boolean; data: T }>(url, body).then((r) => r.data.data);

export const apiPut = <T>(url: string, body?: any) =>
  api.put<{ success: boolean; data: T }>(url, body).then((r) => r.data.data);

export const apiPatch = <T>(url: string, body?: any) =>
  api.patch<{ success: boolean; data: T }>(url, body).then((r) => r.data.data);

export const apiDelete = <T>(url: string) =>
  api.delete<{ success: boolean; data: T }>(url).then((r) => r.data.data);
