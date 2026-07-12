// ============================================================
// SEERA PLATFORM v4 - Print Voucher Cards Page
// Beautiful printable card layout for hotspot vouchers
// ============================================================
import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Printer, Download, Wifi, Clock, Ticket, ChevronDown,
  LayoutGrid, List, QrCode, X, Eye, Settings2,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import { VoucherBatchSummary, VoucherRecord, DeviceSummary, DeviceType } from '@sira/shared';
import toast from 'react-hot-toast';

// ── Print styles injected into head ──────────────────────────
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: fixed; top: 0; left: 0; width: 100%; }
  @page { margin: 10mm; size: A4; }
}
`;

// ── Card color themes ─────────────────────────────────────────
const THEMES = [
  { id: 'midnight', label: 'ليلي', bg: '#0f172a', border: '#1e3a5f', text: '#e2e8f0', accent: '#6366f1', sub: '#94a3b8' },
  { id: 'ocean',    label: 'أزرق', bg: '#0c2340', border: '#1d4ed8', text: '#e0f2fe', accent: '#38bdf8', sub: '#7dd3fc' },
  { id: 'forest',   label: 'أخضر', bg: '#0a1f14', border: '#15803d', text: '#d1fae5', accent: '#4ade80', sub: '#86efac' },
  { id: 'rose',     label: 'وردي', bg: '#1c0a14', border: '#be185d', text: '#fce7f3', accent: '#f472b6', sub: '#f9a8d4' },
  { id: 'amber',    label: 'ذهبي', bg: '#1c1200', border: '#b45309', text: '#fef3c7', accent: '#fbbf24', sub: '#fcd34d' },
  { id: 'white',    label: 'أبيض', bg: '#ffffff', border: '#e2e8f0', text: '#1e293b', accent: '#6366f1', sub: '#64748b' },
];

// ── Single Voucher Card ───────────────────────────────────────
interface CardProps {
  voucher: VoucherRecord;
  theme: typeof THEMES[0];
  companyName?: string;
  showQr?: boolean;
}

const VoucherCard: React.FC<CardProps> = ({ voucher, theme, companyName, showQr }) => {
  const isUsed = voucher.status !== 'unused';

  return (
    <div
      style={{
        background: theme.bg,
        border: `1.5px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        overflow: 'hidden',
        opacity: isUsed ? 0.6 : 1,
        width: '180px',
        minHeight: '120px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', top: '-20px', left: '-20px',
        width: '70px', height: '70px',
        background: theme.accent, opacity: 0.08, borderRadius: '50%',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '20px', height: '20px', borderRadius: '6px',
            background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontSize: '11px' }}>W</span>
          </div>
          <span style={{ color: theme.sub, fontSize: '10px', fontWeight: 500 }}>
            {companyName || 'Internet'}
          </span>
        </div>
        <span style={{
          color: voucher.status === 'unused' ? theme.accent : theme.sub,
          fontSize: '9px', fontWeight: 600, letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
          {voucher.status === 'unused' ? '● جاهز' : voucher.status === 'active' ? '● نشط' : '✕ منتهي'}
        </span>
      </div>

      {/* Code */}
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <p style={{ color: theme.sub, fontSize: '9px', marginBottom: '3px' }}>كود الدخول</p>
        <p style={{
          color: theme.text, fontSize: '18px', fontWeight: 800,
          letterSpacing: '2px', fontFamily: 'monospace',
          textDecoration: isUsed ? 'line-through' : 'none',
        }}>
          {voucher.code}
        </p>
      </div>

      {/* Profile + details */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ color: theme.sub, fontSize: '9px' }}>البروفايل</p>
          <p style={{ color: theme.accent, fontSize: '11px', fontWeight: 600 }}>{voucher.profileName}</p>
        </div>
        {voucher.dataLimit && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: theme.sub, fontSize: '9px' }}>الحجم</p>
            <p style={{ color: theme.text, fontSize: '10px', fontWeight: 600 }}>{voucher.dataLimit}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px dashed ${theme.border}`,
        paddingTop: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: theme.sub, fontSize: '8px' }}>
          {new Date(voucher.createdAt || Date.now()).toLocaleDateString('ar-EG')}
        </span>
        <span style={{ color: theme.sub, fontSize: '8px', fontFamily: 'monospace' }}>
          #{voucher.id?.slice(-6)}
        </span>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────
export const PrintCardsPage: React.FC = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [onlyUnused, setOnlyUnused] = useState(true);
  const [cardsPerRow, setCardsPerRow] = useState(4);
  const [companyName, setCompanyName] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const { data: batches = [], isLoading: batchesLoading } = useQuery<VoucherBatchSummary[]>({
    queryKey: ['vouchers', 'batches'],
    queryFn: () => apiGet('/vouchers/batches'),
  });

  const { data: vouchers = [], isLoading: vouchersLoading } = useQuery<VoucherRecord[]>({
    queryKey: ['vouchers', 'list', selectedBatch],
    queryFn: () => apiGet('/vouchers', { batchId: selectedBatch }),
    enabled: !!selectedBatch,
  });

  const filtered = onlyUnused ? vouchers.filter((v) => v.status === 'unused') : vouchers;

  const handlePrint = () => {
    // Inject print style
    const style = document.createElement('style');
    style.innerHTML = PRINT_STYLE;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 2000);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-900/40 border border-indigo-800/50 flex items-center justify-center">
            <Printer className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">طباعة كروت الإنترنت</h1>
            <p className="text-sm text-slate-500">تصميم وطباعة كروت الهوتسبوت باحترافية</p>
          </div>
        </div>

        <div className="mr-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-secondary gap-2 text-sm"
          >
            <Settings2 className="w-4 h-4" />
            إعدادات
          </button>
          <button
            onClick={handlePrint}
            disabled={filtered.length === 0}
            className="btn-primary gap-2"
          >
            <Printer className="w-4 h-4" />
            طباعة ({filtered.length} كرت)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar — batch selection */}
        <div className="space-y-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-indigo-400" />
              اختر الدفعة
            </h3>
            {batchesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-surface-2 rounded-lg animate-pulse" />)}
              </div>
            ) : batches.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">لا توجد دفعات</p>
            ) : (
              <div className="space-y-1">
                {batches.map((b) => (
                  <button
                    key={b.batchId}
                    onClick={() => setSelectedBatch(b.batchId)}
                    className={`nav-item w-full flex-col items-start gap-0.5 ${selectedBatch === b.batchId ? 'active' : ''}`}
                  >
                    <span className="text-sm font-medium">{b.batchName}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{b.profileName}</span>
                      <span className="mr-auto font-mono text-green-400">{b.unused} غير مستخدمة</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="card p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300">إعدادات التصميم</h3>

              {/* Theme */}
              <div>
                <label className="text-xs text-slate-500 mb-2 block">لون الكرت</label>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                        selectedTheme.id === theme.id ? 'border-indigo-500' : 'border-surface-2'
                      }`}
                    >
                      <div
                        className="w-8 h-5 rounded"
                        style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
                      />
                      <span className="text-xs text-slate-400">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards per row */}
              <div>
                <label className="text-xs text-slate-500 mb-2 block">كروت في كل صف ({cardsPerRow})</label>
                <input
                  type="range" min={2} max={6} value={cardsPerRow}
                  onChange={(e) => setCardsPerRow(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-600">
                  <span>2</span><span>6</span>
                </div>
              </div>

              {/* Company name */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">اسم الشركة على الكرت</label>
                <input
                  className="input-field text-sm"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="اسم الشركة أو المزود"
                />
              </div>

              {/* Filter */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyUnused}
                  onChange={(e) => setOnlyUnused(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-slate-300">الكروت غير المستخدمة فقط</span>
              </label>
            </div>
          )}
        </div>

        {/* Preview area */}
        <div className="lg:col-span-3">
          {!selectedBatch ? (
            <div className="card p-16 text-center">
              <Ticket className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-slate-400 font-medium">اختر دفعة من القائمة اليسرى</p>
              <p className="text-slate-600 text-sm mt-1">ستظهر هنا معاينة الكروت جاهزة للطباعة</p>
            </div>
          ) : vouchersLoading ? (
            <div className="card p-8 text-center">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400">جاري تحميل الكروت...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-16 text-center">
              <X className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-slate-400">لا توجد كروت {onlyUnused ? 'غير مستخدمة' : ''} في هذه الدفعة</p>
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div className="card p-3 mb-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm text-slate-300">
                    {filtered.length} كرت جاهز للطباعة
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  الدفعة: {batches.find(b => b.batchId === selectedBatch)?.batchName}
                </div>
                <div className="text-xs text-slate-500">
                  البروفايل: {batches.find(b => b.batchId === selectedBatch)?.profileName}
                </div>
              </div>

              {/* Cards grid — printable */}
              <div id="print-area" className="card p-4">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)`,
                    gap: '10px',
                  }}
                >
                  {filtered.map((v) => (
                    <VoucherCard
                      key={v.id}
                      voucher={v}
                      theme={selectedTheme}
                      companyName={companyName}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
