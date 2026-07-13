// ============================================================
// SEERA PLATFORM v4 - Vouchers Page (Hotspot Cards Engine)
// Unified: generate real vouchers on the router + design & print
// (merged the old CardMakingPage design panel into this page)
// ============================================================
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ticket, Plus, Download, RefreshCw, Printer,
  Search, BarChart3, Wifi, LayoutGrid, X,
} from 'lucide-react';
import { apiGet, apiPost, api } from '../../utils/api';
import {
  VoucherBatchSummary, VoucherRecord, VoucherStatus, DeviceSummary, DeviceType,
} from '@sira/shared';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<VoucherStatus, { label: string; className: string }> = {
  unused:   { label: 'غير مستخدمة', className: 'badge-online' },
  active:   { label: 'نشطة',        className: 'badge-info' },
  expired:  { label: 'منتهية',      className: 'badge-warning' },
  disabled: { label: 'معطلة',       className: 'badge-offline' },
};

// ── Card design defaults (merged from CardMakingPage) ─────────
interface CardDesign {
  columns: number;
  printType: 'code_only' | 'username_password';
  fontSize: number;
  textColor: string;
  margin: number;
  showSerial: boolean;
  cardBorder: boolean;
  showQr: boolean;
  companyName: string;
}

const DEFAULT_DESIGN: CardDesign = {
  columns: 3,
  printType: 'code_only',
  fontSize: 20,
  textColor: '#000000',
  margin: 4,
  showSerial: false,
  cardBorder: true,
  showQr: false,
  companyName: 'إنترنت هوت سبوت',
};

// Injected only while printing so the on-screen layout is untouched.
const buildPrintStyle = (cols: number, marginPx: number) => `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area {
    position: absolute; left: 0; top: 0; width: 100%;
    display: grid;
    grid-template-columns: repeat(${cols}, 1fr);
    gap: ${marginPx}px;
    padding: 8mm;
  }
  @page { margin: 8mm; size: A4; }
}
`;

export const VouchersPage: React.FC = () => {
  const qc = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [design, setDesign] = useState<CardDesign>(DEFAULT_DESIGN);
  const [genForm, setGenForm] = useState({
    deviceId: '', profileName: '', count: 10,
    prefix: '', batchName: '', comment: '',
    usernameLength: 8, separateCredentials: false,
    timeLimitValue: '', timeLimitUnit: 'd',
    dataLimitValue: '', dataLimitUnit: 'GB'
  });

  const { data: batches = [] } = useQuery<VoucherBatchSummary[]>({
    queryKey: ['vouchers', 'batches'],
    queryFn: () => apiGet('/vouchers/batches'),
  });

  const { data: vouchers = [], isLoading: vouchersLoading } = useQuery<VoucherRecord[]>({
    queryKey: ['vouchers', 'list', selectedBatch, statusFilter],
    queryFn: () => apiGet('/vouchers', { batchId: selectedBatch, status: statusFilter !== 'all' ? statusFilter : undefined }),
    enabled: true,
  });

  const { data: devices = [] } = useQuery<DeviceSummary[]>({
    queryKey: ['devices'],
    queryFn: () => apiGet('/devices'),
  });

  const mikrotikDevices = devices.filter((d) => d.type === DeviceType.MIKROTIK);

  const generateMutation = useMutation({
    mutationFn: (data: typeof genForm) => {
      const payload: any = {
        deviceId: data.deviceId,
        profileName: data.profileName,
        count: data.count,
        prefix: data.prefix,
        batchName: data.batchName,
        comment: data.comment,
        usernameLength: data.usernameLength,
        separateCredentials: data.separateCredentials,
      };
      if (data.timeLimitValue) payload.timeLimit = `${data.timeLimitValue}${data.timeLimitUnit}`;
      if (data.dataLimitValue) payload.dataLimitMb = data.dataLimitUnit === 'GB' ? Number(data.dataLimitValue) * 1024 : Number(data.dataLimitValue);

      return apiPost('/vouchers/generate', payload);
    },
    onSuccess: (result: any) => {
      toast.success(`✓ تم توليد ${result.vouchers?.length} بطاقة ورفعها للراوتر`);
      qc.invalidateQueries({ queryKey: ['vouchers'] });
      setShowGenerate(false);
      setGenForm({
        deviceId: '', profileName: '', count: 10, prefix: '', batchName: '', comment: '',
        usernameLength: 8, separateCredentials: false,
        timeLimitValue: '', timeLimitUnit: 'd', dataLimitValue: '', dataLimitUnit: 'GB'
      });
    },
    onError: () => toast.error('فشل توليد البطاقات — تأكد من اتصال الراوتر'),
  });

  const syncMutation = useMutation({
    mutationFn: (deviceId: string) => apiPost(`/vouchers/sync/${deviceId}`),
    onSuccess: () => {
      toast.success('تم مزامنة حالة البطاقات');
      qc.invalidateQueries({ queryKey: ['vouchers'] });
    },
    onError: () => toast.error('فشل المزامنة'),
  });

  const exportPdf = async (batchId?: string) => {
    try {
      const res = await api.get(`/vouchers/export-pdf${batchId ? `/${batchId}` : ''}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `vouchers-${batchId || 'all'}-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم تصدير PDF');
    } catch {
      toast.error('فشل تصدير PDF');
    }
  };

  const filtered = vouchers.filter(
    (v) =>
      (statusFilter === 'all' || v.status === statusFilter) &&
      (search === '' || v.code.toLowerCase().includes(search.toLowerCase())),
  );

  const activeBatch = batches.find((b) => b.batchId === selectedBatch);

  // Cards to print: current filtered list (real vouchers only — no fake data)
  const printableCards = filtered;

  const handlePrint = () => {
    if (printableCards.length === 0) {
      toast.error('لا توجد بطاقات للطباعة — ولّد دفعة أولاً');
      return;
    }
    const style = document.createElement('style');
    style.innerHTML = buildPrintStyle(design.columns, design.margin * 10);
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      if (document.head.contains(style)) document.head.removeChild(style);
    }, 1500);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900/40 border border-blue-800/50 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">إنشاء البطاقات</h1>
            <p className="text-sm text-slate-500">توليد وتصميم وطباعة كروت الهوتسبوت</p>
          </div>
        </div>
        <div className="mr-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={() => syncMutation.mutate(mikrotikDevices[0]?.id)}
            disabled={syncMutation.isPending || !mikrotikDevices[0]}
            className="btn-secondary gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            مزامنة
          </button>
          <button onClick={() => exportPdf(selectedBatch || undefined)} className="btn-secondary gap-2">
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button onClick={() => setShowDesign(true)} className="btn-secondary gap-2">
            <LayoutGrid className="w-4 h-4" />
            تصميم وطباعة
          </button>
          <button onClick={() => setShowGenerate(true)} className="btn-primary gap-2">
            <Plus className="w-4 h-4" />
            توليد دفعة
          </button>
        </div>
      </div>

      {/* Stats row */}
      {activeBatch && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'الإجمالي', value: activeBatch.total, color: 'text-slate-200' },
            { label: 'غير مستخدمة', value: activeBatch.unused, color: 'text-green-400' },
            { label: 'نشطة', value: activeBatch.active, color: 'text-sira-300' },
            { label: 'منتهية', value: activeBatch.expired, color: 'text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Batch list sidebar */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-300">الدفعات</h3>
          </div>
          <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
            <button
              onClick={() => setSelectedBatch(null)}
              className={`nav-item w-full ${selectedBatch === null ? 'active' : ''}`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>جميع البطاقات</span>
            </button>
            {batches.map((batch) => (
              <button
                key={batch.batchId}
                onClick={() => setSelectedBatch(batch.batchId)}
                className={`nav-item w-full flex-col items-start gap-0.5 ${
                  selectedBatch === batch.batchId ? 'active' : ''
                }`}
              >
                <span className="text-sm font-medium">{batch.batchName}</span>
                <div className="flex items-center gap-3 text-xs text-slate-500 w-full">
                  <span>{batch.profileName}</span>
                  <span className="mr-auto font-mono">{batch.unused}/{batch.total}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Vouchers table */}
        <div className="lg:col-span-3 card">
          <div className="card-header gap-3 flex-wrap">
            {/* Status filter */}
            <div className="flex items-center gap-1 flex-wrap">
              {(['all', VoucherStatus.UNUSED, VoucherStatus.ACTIVE, VoucherStatus.EXPIRED, VoucherStatus.DISABLED] as Array<VoucherStatus | 'all'>).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-sira-700 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {s === 'all' ? 'الكل' : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                className="input py-1.5 pr-8 w-44 text-xs"
                placeholder="بحث بالكود..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="sira-table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>البروفايل</th>
                  <th>الحالة</th>
                  <th>المستخدم بواسطة</th>
                  <th>تاريخ الاستخدام</th>
                  <th>الحجم</th>
                </tr>
              </thead>
              <tbody>
                {vouchersLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j}><div className="h-4 bg-surface-2 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      لا توجد بطاقات
                    </td>
                  </tr>
                ) : (
                  filtered.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className="font-mono text-sm text-slate-200 bg-surface rounded px-2 py-0.5">
                          {v.code}
                        </span>
                      </td>
                      <td><span className="text-slate-400 text-xs">{v.profileName}</span></td>
                      <td>
                        <span className={STATUS_CONFIG[v.status].className}>
                          {STATUS_CONFIG[v.status].label}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-slate-500">
                          {v.usedBy || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-slate-500">
                          {v.usedAt ? new Date(v.usedAt).toLocaleString('ar') : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-slate-500 font-mono">
                          {v.status === 'active' || v.status === 'expired'
                            ? `↑${formatBytes((v.bytesIn ?? 0) + (v.bytesOut ?? 0))}`
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowGenerate(false)} />
          <div className="relative card w-full max-w-md p-6 animate-slide-in-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-100 mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-sira-400" />
              توليد دفعة بطاقات جديدة
            </h3>

            <div className="space-y-4">
              <div>
                <label className="input-label">الراوتر *</label>
                <select
                  className="input"
                  value={genForm.deviceId}
                  onChange={(e) => setGenForm({ ...genForm, deviceId: e.target.value })}
                >
                  <option value="">اختر الراوتر...</option>
                  {mikrotikDevices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">اسم الدفعة *</label>
                  <input
                    className="input"
                    placeholder="مثال: يناير 2025"
                    value={genForm.batchName}
                    onChange={(e) => setGenForm({ ...genForm, batchName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">إجمالي عدد الكروت *</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={5000}
                    value={genForm.count}
                    onChange={(e) => setGenForm({ ...genForm, count: +e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">اسم البروفايل *</label>
                  <input
                    className="input"
                    placeholder="default"
                    value={genForm.profileName}
                    onChange={(e) => setGenForm({ ...genForm, profileName: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="input-label">تحديد وقت المستخدم (اختياري)</label>
                  <div className="flex gap-1">
                    <input
                      type="number" min={1} className="input w-full" placeholder="30"
                      value={genForm.timeLimitValue}
                      onChange={(e) => setGenForm({ ...genForm, timeLimitValue: e.target.value })}
                    />
                    <select className="input w-20 px-1" value={genForm.timeLimitUnit} onChange={(e) => setGenForm({ ...genForm, timeLimitUnit: e.target.value })}>
                      <option value="d">يوم</option>
                      <option value="h">ساعة</option>
                      <option value="m">دقيقة</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">حجم الكوتة (اختياري)</label>
                  <div className="flex gap-1">
                    <input
                      type="number" min={1} className="input w-full" placeholder="10"
                      value={genForm.dataLimitValue}
                      onChange={(e) => setGenForm({ ...genForm, dataLimitValue: e.target.value })}
                    />
                    <select className="input w-20 px-1" value={genForm.dataLimitUnit} onChange={(e) => setGenForm({ ...genForm, dataLimitUnit: e.target.value })}>
                      <option value="GB">GB</option>
                      <option value="MB">MB</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="input-label">نوع طباعة المستخدم</label>
                  <select className="input" value={genForm.separateCredentials ? 'true' : 'false'} onChange={(e) => setGenForm({ ...genForm, separateCredentials: e.target.value === 'true' })}>
                    <option value="false">كود واحد (يوزر=باسورد)</option>
                    <option value="true">يوزر وباسورد منفصلين</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">بادئة لاسم المستخدم (اختياري)</label>
                  <input
                    className="input"
                    placeholder="SIRA"
                    value={genForm.prefix}
                    onChange={(e) => setGenForm({ ...genForm, prefix: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="input-label">عدد حروف المستخدم</label>
                  <input
                    type="number" min={4} max={16} className="input"
                    value={genForm.usernameLength}
                    onChange={(e) => setGenForm({ ...genForm, usernameLength: +e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">تعليق (اختياري)</label>
                <input
                  className="input"
                  placeholder="ادخل تعليقا للملف"
                  value={genForm.comment}
                  onChange={(e) => setGenForm({ ...genForm, comment: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => generateMutation.mutate(genForm)}
                disabled={generateMutation.isPending || !genForm.deviceId || !genForm.profileName || !genForm.batchName}
                className="btn-primary flex-1 justify-center"
              >
                {generateMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جارٍ التوليد...
                  </span>
                ) : `توليد ${genForm.count} بطاقة`}
              </button>
              <button onClick={() => setShowGenerate(false)} className="btn-secondary">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Design & Print Modal (merged from CardMakingPage) */}
      {showDesign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDesign(false)} />
          <div className="relative card w-full max-w-4xl p-0 animate-slide-in-up max-h-[92vh] overflow-hidden flex flex-col">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-indigo-400" />
                تصميم وطباعة الكروت
              </h3>
              <button onClick={() => setShowDesign(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-5 p-5 overflow-y-auto">
              {/* Live preview */}
              <div className="flex-1 flex flex-col items-center justify-start">
                <p className="text-xs text-slate-500 mb-3">معاينة الكارت</p>
                <div
                  className="relative bg-white shadow-xl"
                  style={{
                    border: design.cardBorder ? '2px solid #cbd5e1' : 'none',
                    borderRadius: '12px', padding: '20px',
                    width: '260px', minHeight: '150px',
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>
                      {design.companyName}
                    </span>
                    <Wifi className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="text-center space-y-2 mb-4">
                    {design.printType === 'username_password' ? (
                      <>
                        <div style={{ fontSize: `${design.fontSize}px`, color: design.textColor, fontWeight: 'bold' }}>USER123</div>
                        <div style={{ fontSize: `${design.fontSize}px`, color: design.textColor, fontWeight: 'bold' }}>PASS456</div>
                      </>
                    ) : (
                      <div style={{ fontSize: `${design.fontSize}px`, color: design.textColor, fontWeight: 'bold', letterSpacing: '2px' }}>CODE789</div>
                    )}
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-100 pt-3">
                    <div className="text-[10px] text-slate-400">معاينة</div>
                    {design.showQr && (
                      <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center">
                        <span className="text-[8px] text-slate-500">QR</span>
                      </div>
                    )}
                  </div>
                  {design.showSerial && (
                    <div style={{ position: 'absolute', bottom: '8px', left: '12px', fontSize: '8px', color: '#94a3b8' }}>
                      SN: 100000001
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-4 text-center">
                  {printableCards.length > 0
                    ? `${printableCards.length} بطاقة جاهزة للطباعة`
                    : 'لا توجد بطاقات — ولّد دفعة أولاً'}
                </p>
              </div>

              {/* Design settings */}
              <div className="w-full lg:w-[340px] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">عدد الأعمدة</label>
                    <input type="number" min={1} max={8} className="input"
                      value={design.columns} onChange={(e) => setDesign({ ...design, columns: +e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">حجم الخط</label>
                    <input type="number" min={8} max={40} className="input"
                      value={design.fontSize} onChange={(e) => setDesign({ ...design, fontSize: +e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="input-label">نوع الطباعة</label>
                  <select className="input" value={design.printType}
                    onChange={(e) => setDesign({ ...design, printType: e.target.value as CardDesign['printType'] })}>
                    <option value="code_only">كود فقط</option>
                    <option value="username_password">يوزر وباسورد</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">اسم الشركة على الكارت</label>
                  <input className="input" value={design.companyName}
                    onChange={(e) => setDesign({ ...design, companyName: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">الهامش بين الكروت</label>
                    <input type="number" min={0} max={20} className="input"
                      value={design.margin} onChange={(e) => setDesign({ ...design, margin: +e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">لون الخط</label>
                    <input type="color" className="input h-[42px] p-1 cursor-pointer"
                      value={design.textColor} onChange={(e) => setDesign({ ...design, textColor: e.target.value })} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={design.cardBorder}
                      onChange={(e) => setDesign({ ...design, cardBorder: e.target.checked })} />
                    إطار للكارت
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={design.showSerial}
                      onChange={(e) => setDesign({ ...design, showSerial: e.target.checked })} />
                    إظهار السيريال
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={design.showQr}
                      onChange={(e) => setDesign({ ...design, showQr: e.target.checked })} />
                    إظهار QR
                  </label>
                </div>

                <button
                  onClick={handlePrint}
                  disabled={printableCards.length === 0}
                  className="btn-primary w-full justify-center gap-2 mt-2"
                >
                  <Printer className="w-4 h-4" />
                  طباعة ({printableCards.length} بطاقة)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print area — real vouchers only */}
      <div id="print-area" className="hidden">
        {printableCards.map((card) => (
          <div
            key={card.id}
            style={{
              border: design.cardBorder ? '2px solid #cbd5e1' : 'none',
              borderRadius: '12px', padding: '16px',
              backgroundColor: '#ffffff', position: 'relative',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>{design.companyName}</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>{card.profileName}</span>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: `${design.fontSize}px`, color: design.textColor, fontWeight: 'bold', letterSpacing: '1px' }}>
                {card.code}
              </div>
            </div>
            {design.showSerial && (
              <div style={{ fontSize: '8px', color: '#94a3b8', position: 'absolute', bottom: '5px', left: '10px' }}>
                SN: {card.id?.slice(-8)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
