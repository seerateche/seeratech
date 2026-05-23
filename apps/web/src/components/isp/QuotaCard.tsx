// ============================================================
// SEERA PLATFORM v4 - ISP Quota Card Component
// Deep purple palette, mobile-first, RTL
// ============================================================
import React, { useState } from 'react';
import {
  RefreshCw, Phone, Wifi, AlertTriangle, CheckCircle2,
  XCircle, Clock, Zap, HardDrive, TrendingUp, MoreVertical,
  Edit2, Trash2, WifiOff,
} from 'lucide-react';
import { IspAccount, IspQuotaDetails } from '@sira/shared';

// ── Color utils ───────────────────────────────────────────────
function usageColor(pct: number): { bar: string; text: string; bg: string } {
  if (pct >= 90) return { bar: '#ef4444', text: 'text-red-400',   bg: 'bg-red-900/30' };
  if (pct >= 70) return { bar: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-900/30' };
  if (pct >= 50) return { bar: '#6366f1', text: 'text-indigo-400',bg: 'bg-indigo-900/30' };
  return           { bar: '#22c55e', text: 'text-green-400',  bg: 'bg-green-900/30' };
}

// ── Circular gauge ────────────────────────────────────────────
const CircularGauge: React.FC<{ pct: number; size?: number }> = ({
  pct, size = 88,
}) => {
  const r        = (size - 10) / 2;
  const circ     = 2 * Math.PI * r;
  const offset   = circ - (pct / 100) * circ;
  const colors   = usageColor(pct);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(99,102,241,0.12)" strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={colors.bar}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-black font-mono leading-none ${colors.text}`}>
          {pct}
        </span>
        <span className="text-[9px] text-slate-500 font-medium">%</span>
      </div>
    </div>
  );
};

// ── Stat pill ─────────────────────────────────────────────────
const StatPill: React.FC<{
  icon:  React.ElementType;
  label: string;
  value: string;
  color: string;
}> = ({ icon: Icon, label, value, color }) => (
  <div className={`flex flex-col items-center gap-0.5 flex-1 px-2 py-2 rounded-xl ${color}`}>
    <Icon className="w-3.5 h-3.5 opacity-70" />
    <span className="text-[11px] font-bold font-mono leading-tight">{value}</span>
    <span className="text-[9px] text-slate-500">{label}</span>
  </div>
);

// ── Status badge ──────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string; lineStatus?: string }> = ({
  status, lineStatus,
}) => {
  if (status === 'syncing') {
    return (
      <span className="badge bg-indigo-900/40 text-indigo-300 border border-indigo-800/50">
        <RefreshCw className="w-3 h-3 animate-spin" />
        جارٍ المزامنة
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="badge bg-red-900/40 text-red-400 border border-red-800/50">
        <AlertTriangle className="w-3 h-3" />
        خطأ
      </span>
    );
  }
  const isActive = lineStatus?.toLowerCase().includes('active') ?? status === 'active';
  return isActive ? (
    <span className="badge bg-green-900/40 text-green-400 border border-green-800/50">
      <CheckCircle2 className="w-3 h-3" />
      نشط
    </span>
  ) : (
    <span className="badge bg-slate-800 text-slate-400 border border-slate-700">
      <XCircle className="w-3 h-3" />
      غير نشط
    </span>
  );
};

// ── Addon bundle row ──────────────────────────────────────────
const AddonRow: React.FC<{ name: string; usedGb: number; totalGb: number }> = ({
  name, usedGb, totalGb,
}) => {
  const pct = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 truncate ml-2">{name}</span>
        <span className="text-slate-500 font-mono flex-shrink-0">
          {usedGb.toFixed(1)} / {totalGb} GB
        </span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500/60 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ── Main Quota Card ───────────────────────────────────────────
interface QuotaCardProps {
  account:    IspAccount;
  onSync:     (id: string) => void;
  onEdit:     (account: IspAccount) => void;
  onDelete:   (id: string) => void;
  isSyncing?: boolean;
}

export const QuotaCard: React.FC<QuotaCardProps> = ({
  account, onSync, onEdit, onDelete, isSyncing = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const q: IspQuotaDetails = account.quotaDetails ?? {};
  const pct    = q.usagePercent ?? 0;
  const colors = usageColor(pct);
  const hasData = q.totalGb !== undefined && q.totalGb > 0;

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-EG', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return iso; }
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString('ar-EG', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return null; }
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden border transition-all duration-200"
      style={{
        background:  'linear-gradient(145deg, #1a1033 0%, #150d2a 60%, #0f0a1e 100%)',
        borderColor: account.status === 'error'
          ? 'rgba(239,68,68,0.3)'
          : 'rgba(99,102,241,0.2)',
        boxShadow: account.status === 'error'
          ? '0 0 0 1px rgba(239,68,68,0.1)'
          : '0 4px 24px rgba(99,102,241,0.08)',
      }}
    >
      {/* Top accent line */}
      <div
        className="h-[2px] w-full"
        style={{
          background: account.status === 'error'
            ? 'linear-gradient(90deg, #ef4444, #f87171)'
            : `linear-gradient(90deg, ${colors.bar}88, ${colors.bar}, ${colors.bar}88)`,
        }}
      />

      {/* ── Card Header ── */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Provider icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-black text-white"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            WE
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-100 truncate text-sm leading-tight">
              {account.accountName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-500 font-mono">
                {account.phoneNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Right side: badge + menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={account.status} lineStatus={q.lineStatus} />

          {/* Context menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute left-0 top-9 z-20 w-36 rounded-xl border overflow-hidden shadow-2xl"
                  style={{
                    background: '#1e1340',
                    borderColor: 'rgba(99,102,241,0.25)',
                  }}
                >
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(account); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                    تعديل
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(account.id); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Plan name ── */}
      {q.planName && (
        <div className="px-4 pb-3">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(99,102,241,0.12)',
              color: '#a5b4fc',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <Zap className="w-3 h-3" />
            {q.planName}
          </span>
        </div>
      )}

      {/* ── No data yet ── */}
      {!hasData && account.status !== 'error' && (
        <div className="px-4 pb-4 text-center">
          <WifiOff className="w-10 h-10 text-slate-700 mx-auto mb-2 mt-2" />
          <p className="text-sm text-slate-500">لم تتم المزامنة بعد</p>
          <button
            onClick={() => onSync(account.id)}
            disabled={isSyncing}
            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            مزامنة الآن
          </button>
        </div>
      )}

      {/* ── Error message ── */}
      {account.status === 'error' && account.lastError && (
        <div className="mx-4 mb-3 flex items-start gap-2 bg-red-900/20 border border-red-800/30 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">{account.lastError}</p>
        </div>
      )}

      {/* ── Main quota display ── */}
      {hasData && (
        <div className="px-4 pb-4">
          {/* Gauge + stats row */}
          <div className="flex items-center gap-4 mb-4">
            <CircularGauge pct={pct} size={80} />

            {/* Stats */}
            <div className="flex-1 flex gap-2">
              <StatPill
                icon={TrendingUp}
                label="مستخدم"
                value={`${(q.usedGb ?? 0).toFixed(1)} GB`}
                color="bg-red-950/40"
              />
              <StatPill
                icon={HardDrive}
                label="متبقي"
                value={`${(q.remainingGb ?? 0).toFixed(1)} GB`}
                color="bg-green-950/40"
              />
              <StatPill
                icon={Wifi}
                label="الإجمالي"
                value={`${q.totalGb ?? 0} GB`}
                color="bg-indigo-950/40"
              />
            </div>
          </div>

          {/* Linear progress bar (with animated fill) */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
              <span>{q.usedGb?.toFixed(1)} GB مستخدم</span>
              <span>{q.remainingGb?.toFixed(1)} GB متبقي</span>
            </div>
            <div className="h-2.5 bg-slate-800/80 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${colors.bar}99, ${colors.bar})`,
                  boxShadow: `0 0 8px ${colors.bar}66`,
                }}
              />
            </div>
          </div>

          {/* Expiry + days remaining */}
          {q.expiryDate && (
            <div className="flex items-center justify-between text-xs mb-3">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>تنتهي {formatDate(q.expiryDate)}</span>
              </div>
              {q.daysRemaining !== undefined && (
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded-full text-[10px] ${
                    q.daysRemaining <= 5
                      ? 'bg-red-900/40 text-red-400'
                      : q.daysRemaining <= 10
                      ? 'bg-amber-900/40 text-amber-400'
                      : 'bg-green-900/30 text-green-400'
                  }`}
                >
                  {q.daysRemaining} يوم
                </span>
              )}
            </div>
          )}

          {/* Addon bundles */}
          {q.addons && q.addons.length > 0 && (
            <div
              className="mt-3 pt-3 space-y-2"
              style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}
            >
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                باقات إضافية
              </p>
              {q.addons.map((addon, i) => (
                <AddonRow
                  key={i}
                  name={addon.name}
                  usedGb={addon.usedGb}
                  totalGb={addon.totalGb}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Card Footer ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}
      >
        {/* Last sync time */}
        <span className="text-[10px] text-slate-600">
          {account.lastSyncedAt
            ? `آخر مزامنة: ${formatTime(account.lastSyncedAt)}`
            : 'لم تتم المزامنة'}
        </span>

        {/* Refresh button */}
        <button
          onClick={() => onSync(account.id)}
          disabled={isSyncing || account.status === 'syncing'}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: 'rgba(99,102,241,0.15)',
            color: '#a5b4fc',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <RefreshCw className={`w-3 h-3 ${(isSyncing || account.status === 'syncing') ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>
    </div>
  );
};
