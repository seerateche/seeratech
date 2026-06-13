// ============================================================
// SIRA PLATFORM v4 - Vouchers Page (Hotspot Cards Engine)
// ============================================================
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ticket, Plus, Download, RefreshCw, Printer,
  CheckCircle2, Clock, XCircle, Filter, Search,
  Trash2, Upload, ChevronDown, BarChart3,
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

export const VouchersPage: React.FC = () => {
  const qc = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({
    deviceId: '', profileName: '', count: 10,
    prefix: 'SIRA', batchName: '', comment: '',
  });

  const { data: batches = [], isLoading: batchesLoading, refetch: refetchBatches } = useQuery<VoucherBatchSummary[]>({
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
    mutationFn: (data: typeof genForm) => apiPost('/vouchers/generate', data),
    onSuccess: (result: any) => {
      toast.success(`✓ تم توليد ${result.vouchers?.length} بطاقة ورفعها للراوتر`);
      qc.invalidateQueries({ queryKey: ['vouchers'] });
      setShowGenerate(false);
      setGenForm({ deviceId: '', profileName: '', count: 10, prefix: 'SIRA', batchName: '', comment: '' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (deviceId: string) => apiPost(`/vouchers/sync/${deviceId}`),
    onSuccess: () => {
      toast.success('تم مزامنة حالة البطاقات');
      qc.invalidateQueries({ queryKey: ['vouchers'] });
    },
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

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900/40 border border-blue-800/50 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">بطاقات الإنترنت</h1>
            <p className="text-sm text-slate-500">إدارة كروت الهوتسبوت المباشرة</p>
          </div>
        </div>
        <div className="mr-auto flex items-center gap-2">
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
          <button onClick={() => setShowGenerate(true)} className="btn-primary gap-2">
            <Plus className="w-4 h-4" />
            توليد دفعة
          </button>
        </div>
      </div>

      {/* Stats row */}
      {activeBatch && (
        <div className="grid grid-cols-4 gap-3">
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
            <div className="flex items-center gap-1">
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
                            ? `↑${formatBytes(v.usedBy ? 0 : 0)}`
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
          <div className="relative card w-full max-w-md p-6 animate-slide-in-up">
            <h3 className="text-lg font-bold text-slate-100 mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-sira-400" />
              توليد دفعة بطاقات جديدة
            </h3>

            <div className="space-y-4">
              <div>
                <label className="input-label">الراوتر</label>
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
                  <label className="input-label">اسم البروفايل</label>
                  <input
                    className="input"
                    placeholder="default"
                    value={genForm.profileName}
                    onChange={(e) => setGenForm({ ...genForm, profileName: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="input-label">عدد البطاقات</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={500}
                    value={genForm.count}
                    onChange={(e) => setGenForm({ ...genForm, count: +e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">البادئة</label>
                  <input
                    className="input"
                    placeholder="SIRA"
                    value={genForm.prefix}
                    onChange={(e) => setGenForm({ ...genForm, prefix: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="input-label">اسم الدفعة</label>
                  <input
                    className="input"
                    placeholder="مثال: يناير 2025"
                    value={genForm.batchName}
                    onChange={(e) => setGenForm({ ...genForm, batchName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">ملاحظة (اختياري)</label>
                <input
                  className="input"
                  placeholder="مثال: بطاقات VIP"
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
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
