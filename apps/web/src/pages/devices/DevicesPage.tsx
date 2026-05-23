// ============================================================
// SIRA PLATFORM v4 - Devices Page
// ============================================================
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Router, Plus, Wifi, WifiOff, RefreshCw, Settings,
  Cpu, HardDrive, Activity, Edit2, Trash2, ChevronRight,
  Lock, Globe, ShieldCheck, Fingerprint, Camera,
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../../utils/api';
import { DeviceSummary, DeviceType, CreateDeviceDto } from '@sira/shared';
import { SecureInput } from '../../components/ui/FormInputs';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';

const DEVICE_ICONS: Record<DeviceType, React.ElementType> = {
  mikrotik:     Router,
  dvr:          Camera,
  nvr:          Camera,
  biometric:    Fingerprint,
  access_point: Wifi,
};

const DEVICE_LABELS: Record<DeviceType, string> = {
  mikrotik:     'MikroTik',
  dvr:          'DVR',
  nvr:          'NVR',
  biometric:    'ZKTeco',
  access_point: 'نقطة وصول',
};

const ICON_COLORS: Record<DeviceType, string> = {
  mikrotik:     'text-sira-400 bg-sira-900/40 border-sira-800/50',
  dvr:          'text-rose-400 bg-rose-900/40 border-rose-800/50',
  nvr:          'text-rose-400 bg-rose-900/40 border-rose-800/50',
  biometric:    'text-violet-400 bg-violet-900/40 border-violet-800/50',
  access_point: 'text-emerald-400 bg-emerald-900/40 border-emerald-800/50',
};

export const DevicesPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState<DeviceType | 'all'>('all');

  const { data: devices = [], isLoading, refetch } = useQuery<DeviceSummary[]>({
    queryKey: ['devices'],
    queryFn: () => apiGet('/devices'),
    refetchInterval: 30_000,
  });

  const [form, setForm] = useState<Partial<CreateDeviceDto>>({
    type: DeviceType.MIKROTIK,
    port: 8728,
    apiPort: 8728,
    useVpn: false,
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<CreateDeviceDto>) => apiPost('/devices', data),
    onSuccess: () => {
      toast.success('تم إضافة الجهاز بنجاح');
      qc.invalidateQueries({ queryKey: ['devices'] });
      setShowAdd(false);
      setForm({ type: DeviceType.MIKROTIK, port: 8728, apiPort: 8728, useVpn: false });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/devices/${id}`),
    onSuccess: () => {
      toast.success('تم حذف الجهاز');
      qc.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  const pingMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/devices/${id}/ping`),
    onSuccess: (_, id) => {
      toast.success('الجهاز متصل ✓');
      qc.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: () => toast.error('الجهاز غير متصل'),
  });

  const filtered = filterType === 'all'
    ? devices
    : devices.filter((d) => d.type === filterType);

  const typeCount = (t: DeviceType) => devices.filter((d) => d.type === t).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sira-900/40 border border-sira-800/50 flex items-center justify-center">
            <Router className="w-5 h-5 text-sira-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">إدارة الأجهزة</h1>
            <p className="text-sm text-slate-500">{devices.length} جهاز مسجل</p>
          </div>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-ghost btn-icon" title="تحديث">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary gap-2">
            <Plus className="w-4 h-4" />
            إضافة جهاز
          </button>
        </div>
      </div>

      {/* Type filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: 'all', label: 'الكل', count: devices.length },
          { value: DeviceType.MIKROTIK, label: 'MikroTik', count: typeCount(DeviceType.MIKROTIK) },
          { value: DeviceType.DVR, label: 'DVR/NVR', count: typeCount(DeviceType.DVR) + typeCount(DeviceType.NVR) },
          { value: DeviceType.BIOMETRIC, label: 'ZKTeco', count: typeCount(DeviceType.BIOMETRIC) },
          { value: DeviceType.ACCESS_POINT, label: 'نقاط الوصول', count: typeCount(DeviceType.ACCESS_POINT) },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterType(f.value as any)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === f.value
                ? 'bg-sira-700 text-white shadow-glow-sm'
                : 'text-slate-400 hover:text-slate-200 bg-surface-2'
            }`}
          >
            {f.label}
            <span className={`text-xs rounded px-1.5 ${
              filterType === f.value ? 'bg-white/20' : 'bg-surface-1 text-slate-500'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Device grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Router className="w-14 h-14 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">لا توجد أجهزة</p>
          <p className="text-slate-600 text-sm mt-1">أضف جهازك الأول للبدء</p>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary mt-4 mx-auto"
          >
            <Plus className="w-4 h-4" />
            إضافة جهاز
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((device) => {
            const Icon = DEVICE_ICONS[device.type] || Router;
            const iconColor = ICON_COLORS[device.type] || ICON_COLORS.mikrotik;
            const isOnline = device.status === 'online';

            return (
              <div key={device.id} className="card p-4 hover:border-sira-800/60 transition-colors group">
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-200 truncate">{device.name}</p>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isOnline ? 'bg-green-400 animate-pulse' : 'bg-slate-600'
                      }`} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {DEVICE_LABELS[device.type]}
                      {device.useVpn && (
                        <span className="mr-2 text-sira-400">
                          <ShieldCheck className="w-3 h-3 inline ml-1" />
                          VPN
                        </span>
                      )}
                    </p>
                  </div>
                  {/* Quick actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => pingMutation.mutate(device.id)}
                      className="btn-ghost btn-icon btn-sm"
                      title="اختبار الاتصال"
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('هل تريد حذف هذا الجهاز؟')) {
                          deleteMutation.mutate(device.id);
                        }
                      }}
                      className="btn-ghost btn-icon btn-sm text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Connection info */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-mono truncate">
                      {device.useVpn ? `${device.vpnIp} (VPN)` : `${device.host}:${device.port}`}
                    </span>
                  </div>
                  {device.lastSeen && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Activity className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {new Date(device.lastSeen).toLocaleString('ar')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action button */}
                {device.type === DeviceType.MIKROTIK ? (
                  <Link
                    to={`/devices/${device.id}/mikrotik`}
                    className="btn-secondary w-full justify-center gap-2 text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    إدارة MikroTik
                    <ChevronRight className="w-4 h-4 mr-auto" />
                  </Link>
                ) : (
                  <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    isOnline
                      ? 'bg-green-900/20 text-green-400 border border-green-800/30'
                      : 'bg-slate-800/50 text-slate-500 border border-surface-2'
                  }`}>
                    {isOnline ? (
                      <><Wifi className="w-4 h-4" /> متصل</>
                    ) : (
                      <><WifiOff className="w-4 h-4" /> غير متصل</>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Device Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAdd(false)} />
          <div className="relative card w-full max-w-lg p-6 animate-slide-in-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-100 mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-sira-400" />
              إضافة جهاز جديد
            </h3>

            <div className="space-y-4">
              {/* Device type */}
              <div>
                <label className="input-label">نوع الجهاز</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(DeviceType).map((type) => {
                    const Icon = DEVICE_ICONS[type];
                    const isSelected = form.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm({ ...form, type })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-sira-900/50 border-sira-700 text-sira-300'
                            : 'border-surface-2 text-slate-500 hover:border-surface-3 hover:text-slate-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {DEVICE_LABELS[type]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="input-label">اسم الجهاز</label>
                <input
                  className="input"
                  placeholder="مثال: راوتر الفرع الرئيسي"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">عنوان IP</label>
                  <input
                    className="input"
                    placeholder="192.168.1.1"
                    value={form.host || ''}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="input-label">المنفذ</label>
                  <input
                    type="number"
                    className="input"
                    value={form.port || 8728}
                    onChange={(e) => setForm({ ...form, port: +e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">اسم المستخدم</label>
                  <input
                    className="input"
                    placeholder="admin"
                    value={form.username || ''}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    dir="ltr"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <SecureInput
                    label="كلمة المرور"
                    placeholder="أدخل كلمة المرور"
                    value={form.password || ''}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* VPN toggle */}
              <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-surface-2">
                <div>
                  <p className="text-sm font-medium text-slate-300">الاتصال عبر VPN</p>
                  <p className="text-xs text-slate-500">للأجهزة التي تستخدم NAT Traversal</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, useVpn: !form.useVpn })}
                  className={`w-10 h-6 rounded-full transition-colors ${
                    form.useVpn ? 'bg-sira-600' : 'bg-surface-2'
                  }`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
                    form.useVpn ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {form.useVpn && (
                <div>
                  <label className="input-label">عنوان VPN IP</label>
                  <input
                    className="input"
                    placeholder="10.0.0.2"
                    value={form.vpnIp || ''}
                    onChange={(e) => setForm({ ...form, vpnIp: e.target.value })}
                    dir="ltr"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => addMutation.mutate(form)}
                disabled={addMutation.isPending || !form.name || !form.host || !form.username || !form.password}
                className="btn-primary flex-1 justify-center"
              >
                {addMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جارٍ الحفظ...
                  </span>
                ) : 'إضافة الجهاز'}
              </button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
