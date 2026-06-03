// ============================================================
// SEERA PLATFORM v4 - Auth Store (Zustand)
// ============================================================
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, UserRole } from '@sira/shared';
import { api } from '../utils/api';

interface AuthState {
  user:            UserProfile | null;
  accessToken:     string | null;
  refreshToken:    string | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login:         (email: string, password: string, companySlug?: string) => Promise<void>;
  logout:        () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  setTokens:     (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user:            null,
      accessToken:     null,
      refreshToken:    null,
      isLoading:       false,
      isAuthenticated: false,

      login: async (email, password, companySlug) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', {
            email,
            password,
            companySlug,
          });
          set({
            user:            data.data.user,
            accessToken:     data.data.accessToken,
            refreshToken:    data.data.refreshToken,
            isAuthenticated: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch {}
        set({
          user:            null,
          accessToken:     null,
          refreshToken:    null,
          isAuthenticated: false,
        });
      },

      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
          const { data } = await api.post('/auth/refresh', { refreshToken });
          set({ accessToken: data.data.accessToken });
          return true;
        } catch {
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
          return false;
        }
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },
    }),
    {
      name:       'sira-auth',
      storage:    createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user:            state.user,
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export const useUser         = () => useAuthStore((s) => s.user);
export const useIsSuperAdmin = () =>
  useAuthStore((s) => s.user?.role === UserRole.SUPER_ADMIN);
export const useIsAdmin      = () =>
  useAuthStore(
    (s) =>
      s.user?.role === UserRole.SUPER_ADMIN ||
      s.user?.role === UserRole.COMPANY_ADMIN,
  );
