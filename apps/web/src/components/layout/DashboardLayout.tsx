// ============================================================
// SEERA PLATFORM v4 - Dashboard Layout
// Mobile-first: Bottom Nav on mobile, Sidebar on desktop
// ============================================================
import React, { useState, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Router, Ticket, Camera,
  Shield, ChevronLeft, ChevronRight, Bell, LogOut,
  Activity, Wifi, Crown, Menu, X, Fingerprint, Globe, KeyRound
} from 'lucide-react';
import { useAuthStore, useIsSuperAdmin } from '../../stores/auth.store';
import { UserRole } from '@sira/shared';
import toast from 'react-hot-toast';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

// ── Nav definition ────────────────────────────────────────────
interface NavItem {
  label: string;
  labelShort: string; // for bottom nav
  icon: React.ElementType;
  to: string;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'وضع المدير العام', labelShort: 'God Mode', icon: Crown,           to: '/god-mode',   superAdminOnly: true },
  { label: 'لوحة التحكم',      labelShort: 'الرئيسية', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'الأجهزة',          labelShort: 'الأجهزة',  icon: Router,           to: '/devices' },
  { label: 'بطاقات الإنترنت',  labelShort: 'البطاقات', icon: Ticket,           to: '/vouchers' },
  { label: 'كاميرات المراقبة', labelShort: 'CCTV',     icon: Camera,           to: '/cctv' },
  { label: 'البصمة والحضور',   labelShort: 'الحضور',   icon: Fingerprint,      to: '/attendance' },
  { label: 'كوتا الإنترنت',    labelShort: 'الكوتا',   icon: Globe,            to: '/isp-quota' },
];

interface Props { children: React.ReactNode; }

export const DashboardLayout: React.FC<Props> = ({ children }) => {
  const [collapsed,   setCollapsed]   = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { user, logout }  = useAuthStore();
  const isSuperAdmin      = useIsSuperAdmin();
  const navigate          = useNavigate();
  const location          = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || isSuperAdmin,
  );

  // Only show 5 items in bottom nav (most important ones)
  const bottomItems = visibleItems.slice(0, 5);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
    toast.success('تم تسجيل الخروج');
  }, [logout, navigate]);

  const closeDrawer = () => setDrawerOpen(false);

  // ── Sidebar (shared between desktop + mobile drawer) ─────
  const SidebarInner = ({ inDrawer = false }) => (
    <aside
      className={[
        'flex flex-col h-full bg-surface-1/40 backdrop-blur-xl border-l border-white/5 transition-all duration-200',
        inDrawer ? 'w-72' : (collapsed ? 'w-16' : 'w-64'),
      ].join(' ')}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-2 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sira-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {(!collapsed || inDrawer) && (
          <div className="min-w-0">
            <p className="font-bold text-slate-100 text-sm leading-tight">Seera Platform</p>
            <p className="text-xs text-slate-500">v4 Enterprise</p>
          </div>
        )}
        {inDrawer && (
          <button onClick={closeDrawer} className="btn-ghost btn-icon btn-sm mr-auto">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={inDrawer ? closeDrawer : undefined}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''} ${(!collapsed || inDrawer) ? '' : 'justify-center px-2'}`
            }
            title={(!inDrawer && collapsed) ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {(!collapsed || inDrawer) && (
              <span className="flex-1 truncate">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-2 border-t border-surface-2 flex-shrink-0">
        {(!collapsed || inDrawer) && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sira-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {user?.role === UserRole.SUPER_ADMIN   ? 'مدير عام'      :
                 user?.role === UserRole.COMPANY_ADMIN ? 'مدير الشركة'   : 'مشاهد'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-900/20
                      ${(!collapsed || inDrawer) ? '' : 'justify-center px-2'}`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || inDrawer) && <span>تسجيل الخروج</span>}
        </button>
        <button
          onClick={() => {
            if (inDrawer) closeDrawer();
            setShowChangePassword(true);
          }}
          className={`nav-item w-full text-slate-400 hover:text-slate-300 hover:bg-surface-2 mt-1
                      ${(!collapsed || inDrawer) ? '' : 'justify-center px-2'}`}
        >
          <KeyRound className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || inDrawer) && <span>تغيير كلمة المرور</span>}
        </button>
      </div>

      {/* Desktop collapse toggle */}
      {!inDrawer && (
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -left-3 top-16 w-6 h-6 rounded-full bg-surface-2 border border-surface-2
                     flex items-center justify-center text-slate-400 hover:text-slate-200 z-10"
          aria-label={collapsed ? 'توسيع' : 'طي'}
        >
          {collapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      )}
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-transparent" dir="rtl">

      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex relative flex-shrink-0">
        <SidebarInner />
      </div>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          {/* Drawer — RTL so it slides from the right */}
          <div className="relative mr-0 ml-auto flex animate-slide-in-right">
            <SidebarInner inDrawer />
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-14 bg-surface-1/40 backdrop-blur-xl border-b border-white/5 flex items-center px-3 gap-2 flex-shrink-0 pt-safe"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
        >
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden btn-ghost btn-icon"
            onClick={() => setDrawerOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Status */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span>يعمل</span>
          </div>

          <div className="flex-1 min-w-0" />

          {/* Company chip */}
          {user?.companyName && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 rounded-lg text-xs text-slate-400 max-w-[160px]">
              <Wifi className="w-3 h-3 text-sira-400 flex-shrink-0" />
              <span className="truncate">{user.companyName}</span>
            </div>
          )}

          {/* Notification bell */}
          <button className="btn-ghost btn-icon relative" aria-label="الإشعارات">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full pointer-events-none" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 page-content">
          {children}
        </main>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="bottom-nav bg-surface-1/80 backdrop-blur-xl border-t border-surface-2/50" aria-label="التنقل الرئيسي">
          {bottomItems.map((item) => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                aria-label={item.label}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.labelShort}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
};
