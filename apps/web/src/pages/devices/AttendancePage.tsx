// ============================================================
// SEERA PLATFORM v4 - Attendance Page (ZKTeco Biometric)
// ============================================================
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  Fingerprint, RefreshCw, Download, Users,
  Clock, CheckCircle2, XCircle, AlertCircle,
  Calendar, ChevronRight, ChevronLeft,
  UserPlus, Edit2, Trash2, Wifi, WifiOff,
  UserCheck, BarChart3, Timer, X, Save,
  Search,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, api } from '../../utils/api';
import { AttendanceLog, AttendanceReport, DeviceSummary, DeviceType, WsEvent } from '@sira/shared';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';

// ── Type helpers ──────────────────────────────────────────────
type TabId = 'live' | 'report' | 'employees';

interface Employee {
  id: string;
  name: string;
  zkEmployeeId: number;
  department?: string;
  position?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

interface DailyStats {
  date: string;
  totalEmployees: number;
  present: number;
  absent: number;
  late: number;
  avgHours: number;
}

// ── Config maps ───────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  check_in:     { label: 'حضور',        color: 'text-green-400', bg: 'bg-green-900/30' },
  check_out:    { label: 'انصراف',       color: 'text-red-400',   bg: 'bg-red-900/30' },
  break_in:     { label: 'بداية راحة',  color: 'text-amber-400', bg: 'bg-amber-900/30' },
  break_out:    { label: 'نهاية راحة',  color: 'text-blue-400',  bg: 'bg-blue-900/30' },
  overtime_in:  { label: 'عمل إضافي',  color: 'text-violet-400', bg: 'bg-violet-900/30' },
  overtime_out: { label: 'نهاية إضافي', color: 'text-slate-400', bg: 'bg-surface-2' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  present:  { label: 'حاضر',     color: 'text-green-400',  bg: 'bg-green-900/20' },
  absent:   { label: 'غائب',      color: 'text-red-400',    bg: 'bg-red-900/20' },
  late:     { label: 'متأخر',     color: 'text-amber-400',  bg: 'bg-amber-900/20' },
  half_day: { label: 'نصف يوم',  color: 'text-blue-400',   bg: 'bg-blue-900/20' },
};

const VERIFY_TYPE: Record<number, string> = {
  0: 'بصمة',
  1: 'كلمة مرور',
  2: 'بطاقة',
};

// ── Employee Modal ────────────────────────────────────────────
interface EmployeeModalProps {
  employee?: Employee | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ employee, onClose, onSave, isSaving }) => {
  const [form, setForm] = useState({
    name: employee?.name ?? '',
    zkEmployeeId: employee?.zkEmployeeId ?? '',
    department: employee?.department ?? '',
    position: employee?.position ?? '',
    email: employee?.email ?? '',
    phone: employee?.phone ?? '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-1 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-surface-2">
          <h2 className="text-lg font-bold text-slate-100">
            {employee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-slate-400">الاسم الكامل *</label>
              <input className="input-field" value={form.name} onChange={set('name')} placeholder="محمد أحمد" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">رقم ZKTeco *</label>
              <input className="input-field" type="number" value={form.zkEmployeeId} onChange={set('zkEmployeeId')} placeholder="1" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">القسم</label>
              <input className="input-field" value={form.department} onChange={set('department')} placeholder="المبيعات" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">المنصب</label>
              <input className="input-field" value={form.position} onChange={set('position')} placeholder="مدير" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">الهاتف</label>
              <input className="input-field" value={form.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-slate-400">البريد الإلكتروني</label>
              <input className="input-field" type="email" value={form.email} onChange={set('email')} placeholder="example@company.com" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-surface-2">
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          <button
            onClick={() => onSave({ ...form, zkEmployeeId: Number(form.zkEmployeeId) })}
            disabled={!form.name || !form.zkEmployeeId || isSaving}
            className="btn-primary flex-1 gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────
export const AttendancePage: React.FC = () => {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [liveLogs, setLiveLogs] = useState<AttendanceLog[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // ── Queries ───────────────────────────────────────────────────
  const { data: devices = [] } = useQuery<DeviceSummary[]>({
    queryKey: ['devices', 'biometric'],
    queryFn: () => apiGet('/devices', { type: 'biometric' }),
  });
  const zkDevices = devices.filter((d) => d.type === DeviceType.BIOMETRIC);

  const today = new Date().toISOString().split('T')[0];
  const { data: stats } = useQuery<DailyStats>({
    queryKey: ['attendance', 'stats', today],
    queryFn: () => apiGet('/attendance/stats', { date: today }),
    refetchInterval: 60_000,
  });

  const { data: historicalLogs = [], refetch: refetchLogs } = useQuery<AttendanceLog[]>({
    queryKey: ['attendance', 'logs', selectedDevice],
    queryFn: () => apiGet('/attendance/logs', { limit: 200 }),
  });

  const { data: report = [], isLoading: reportLoading, refetch: refetchReport } = useQuery<AttendanceReport[]>({
    queryKey: ['attendance', 'report', startDate, endDate],
    queryFn: () => apiGet('/attendance/report', { startDate, endDate }),
    enabled: activeTab === 'report',
  });

  const { data: employeeList = [], isLoading: empLoading, refetch: refetchEmployees } = useQuery<Employee[]>({
    queryKey: ['attendance', 'employees'],
    queryFn: () => apiGet('/attendance/employees'),
    enabled: activeTab === 'employees',
  });

  // ── Mutations ─────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: (deviceId: string) => apiPost(`/attendance/sync/${deviceId}`),
    onSuccess: (data: any) => {
      toast.success(`تم مزامنة ${data.synced ?? 0} سجل`);
      refetchLogs();
    },
    onError: () => toast.error('فشلت مزامنة السجلات'),
  });

  const syncEmpMutation = useMutation({
    mutationFn: (deviceId: string) => apiPost(`/attendance/employees/sync-from-device/${deviceId}`),
    onSuccess: (data: any) => {
      toast.success(`تم استيراد ${data.synced ?? 0} موظف من الجهاز`);
      refetchEmployees();
    },
    onError: () => toast.error('فشل استيراد الموظفين'),
  });

  const testMutation = useMutation({
    mutationFn: (deviceId: string) => apiPost(`/attendance/devices/${deviceId}/test`),
    onSuccess: (data: any) => {
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    },
  });

  const createEmpMutation = useMutation({
    mutationFn: (data: any) => apiPost('/attendance/employees', data),
    onSuccess: () => {
      toast.success('تم إضافة الموظف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['attendance', 'employees'] });
      setShowEmpModal(false);
    },
    onError: () => toast.error('فشل إضافة الموظف'),
  });

  const updateEmpMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiPut(`/attendance/employees/${id}`, data),
    onSuccess: () => {
      toast.success('تم تحديث بيانات الموظف');
      queryClient.invalidateQueries({ queryKey: ['attendance', 'employees'] });
      setShowEmpModal(false);
      setEditingEmp(null);
    },
    onError: () => toast.error('فشل تحديث الموظف'),
  });

  const deleteEmpMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/attendance/employees/${id}`).then((r) => r.data),
    onSuccess: () => {
      toast.success('تم حذف الموظف');
      queryClient.invalidateQueries({ queryKey: ['attendance', 'employees'] });
    },
    onError: () => toast.error('فشل حذف الموظف'),
  });

  // ── WebSocket real-time ───────────────────────────────────────
  useEffect(() => {
    const socket = io('/ws', {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on(WsEvent.ATTENDANCE_NEW_LOG, (log: AttendanceLog) => {
      setLiveLogs((prev) => [log, ...prev].slice(0, 100));
      const cfg = EVENT_CONFIG[log.eventType] || EVENT_CONFIG.check_in;
      toast.success(`${log.employeeName} — ${cfg.label}`, { icon: '👆', duration: 4000 });
    });

    return () => { socket.disconnect(); };
  }, [accessToken]);

  // ── Excel export ──────────────────────────────────────────────
  const exportReport = async () => {
    try {
      const res = await api.get(
        `/api/v1/attendance/report/export?startDate=${startDate}&endDate=${endDate}`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${startDate}_to_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم تصدير التقرير');
    } catch {
      toast.error('فشل التصدير');
    }
  };

  const allLogs = [
    ...liveLogs,
    ...historicalLogs.filter((h) => !liveLogs.find((l) => l.id === h.id)),
  ];

  const filteredEmployees = employeeList.filter(
    (e) =>
      e.name.includes(empSearch) ||
      e.department?.includes(empSearch) ||
      e.position?.includes(empSearch),
  );

  const handleSaveEmployee = (data: any) => {
    if (editingEmp) {
      updateEmpMutation.mutate({ id: editingEmp.id, data });
    } else {
      createEmpMutation.mutate(data);
    }
  };

  const isSavingEmp = createEmpMutation.isPending || updateEmpMutation.isPending;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-900/40 border border-violet-800/50 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">الحضور والانصراف</h1>
            <p className="text-sm text-slate-500">
              أجهزة ZKTeco{' '}
              {liveLogs.length > 0 && (
                <span className="text-green-400 animate-pulse">● مباشر</span>
              )}
            </p>
          </div>
        </div>

        <div className="mr-auto flex items-center gap-2 flex-wrap">
          {/* Device selector */}
          {zkDevices.length > 1 && (
            <select
              value={selectedDevice ?? ''}
              onChange={(e) => setSelectedDevice(e.target.value || null)}
              className="input text-sm py-1.5"
            >
              <option value="">كل الأجهزة</option>
              {zkDevices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          {/* Test connection */}
          {zkDevices.length > 0 && (
            <button
              onClick={() => testMutation.mutate(zkDevices[0].id)}
              disabled={testMutation.isPending}
              className="btn-secondary gap-2 text-sm"
              title="اختبار الاتصال"
            >
              {testMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              اختبار
            </button>
          )}

          {/* Sync logs */}
          {zkDevices.length > 0 && (
            <button
              onClick={() => syncMutation.mutate(zkDevices[0].id)}
              disabled={syncMutation.isPending}
              className="btn-secondary gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              مزامنة السجلات
            </button>
          )}

          {/* Export (only in report tab) */}
          {activeTab === 'report' && (
            <button onClick={exportReport} className="btn-secondary gap-2 text-sm">
              <Download className="w-4 h-4" />
              تصدير Excel
            </button>
          )}
        </div>
      </div>

      {/* ── Daily Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'إجمالي الموظفين',
            value: stats?.totalEmployees ?? employeeList.length,
            icon: Users,
            color: 'text-slate-300',
            bg: 'bg-slate-800/50',
            border: 'border-slate-700/50',
          },
          {
            label: 'الحاضرون',
            value: stats?.present ?? 0,
            icon: UserCheck,
            color: 'text-green-400',
            bg: 'bg-green-900/20',
            border: 'border-green-800/40',
          },
          {
            label: 'الغائبون',
            value: stats?.absent ?? 0,
            icon: XCircle,
            color: 'text-red-400',
            bg: 'bg-red-900/20',
            border: 'border-red-800/40',
          },
          {
            label: 'المتأخرون',
            value: stats?.late ?? 0,
            icon: Clock,
            color: 'text-amber-400',
            bg: 'bg-amber-900/20',
            border: 'border-amber-800/40',
          },
          {
            label: 'متوسط ساعات',
            value: stats?.avgHours ? `${stats.avgHours}h` : '—',
            icon: Timer,
            color: 'text-violet-400',
            bg: 'bg-violet-900/20',
            border: 'border-violet-800/40',
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`card p-4 flex items-center gap-3 border ${s.border} ${s.bg}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg} border ${s.border}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Card with Tabs ── */}
      <div className="card">
        {/* Tab bar */}
        <div className="flex items-center border-b border-surface-2 px-4 gap-1">
          {([
            { id: 'live',      label: 'السجلات المباشرة', icon: Fingerprint },
            { id: 'report',    label: 'التقارير',          icon: BarChart3 },
            { id: 'employees', label: 'الموظفون',          icon: Users },
          ] as { id: TabId; label: string; icon: any }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'live' && liveLogs.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 inline-flex items-center justify-center">
                  {liveLogs.length}
                </span>
              )}
            </button>
          ))}

          {/* Date range (report tab) */}
          {activeTab === 'report' && (
            <div className="mr-auto flex items-center gap-2 py-2">
              <span className="text-xs text-slate-500">من</span>
              <input
                type="date"
                className="input text-sm py-1.5 w-36"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
              <span className="text-xs text-slate-500">إلى</span>
              <input
                type="date"
                className="input text-sm py-1.5 w-36"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={today}
              />
              <button onClick={() => refetchReport()} className="btn-ghost btn-icon btn-sm">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Employee actions (employees tab) */}
          {activeTab === 'employees' && (
            <div className="mr-auto flex items-center gap-2 py-2">
              {zkDevices.length > 0 && (
                <button
                  onClick={() => syncEmpMutation.mutate(zkDevices[0].id)}
                  disabled={syncEmpMutation.isPending}
                  className="btn-secondary gap-2 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${syncEmpMutation.isPending ? 'animate-spin' : ''}`} />
                  استيراد من الجهاز
                </button>
              )}
              <button
                onClick={() => { setEditingEmp(null); setShowEmpModal(true); }}
                className="btn-primary gap-2 text-sm"
              >
                <UserPlus className="w-4 h-4" />
                إضافة موظف
              </button>
            </div>
          )}
        </div>

        {/* ── Tab: Live Logs ── */}
        {activeTab === 'live' && (
          <div className="table-container">
            <table className="sira-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الحدث</th>
                  <th>الوقت</th>
                  <th>التاريخ</th>
                  <th>طريقة التحقق</th>
                </tr>
              </thead>
              <tbody>
                {allLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-slate-500">
                      <Fingerprint className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                      <p>لا توجد سجلات</p>
                      <p className="text-xs mt-1">اضغط "مزامنة" لجلب السجلات من الجهاز</p>
                    </td>
                  </tr>
                ) : (
                  allLogs.map((log, i) => {
                    const cfg = EVENT_CONFIG[log.eventType] || EVENT_CONFIG.check_in;
                    const isNew = liveLogs.some((l) => l.id === log.id);
                    return (
                      <tr key={`${log.id}-${i}`} className={isNew ? 'bg-violet-900/10' : ''}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-violet-900/40 border border-violet-800/50 flex items-center justify-center text-violet-300 text-sm font-bold">
                              {log.employeeName?.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-200">{log.employeeName}</p>
                              {isNew && <span className="text-xs text-violet-400">● جديد</span>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-sm text-slate-300">
                            {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-500">
                            {new Date(log.timestamp).toLocaleDateString('ar-EG')}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-500">
                            {VERIFY_TYPE[(log as any).verifyType ?? 0] ?? 'بصمة'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab: Report ── */}
        {activeTab === 'report' && (
          <>
            {/* Report summary */}
            {report.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-surface-2">
                {[
                  { label: 'حاضر',    count: report.filter((r) => r.status === 'present').length,  color: 'text-green-400' },
                  { label: 'غائب',    count: report.filter((r) => r.status === 'absent').length,   color: 'text-red-400' },
                  { label: 'متأخر',   count: report.filter((r) => r.status === 'late').length,     color: 'text-amber-400' },
                  { label: 'نصف يوم', count: report.filter((r) => r.status === 'half_day').length, color: 'text-blue-400' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.count}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="table-container">
              <table className="sira-table">
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>التاريخ</th>
                    <th>وقت الحضور</th>
                    <th>وقت الانصراف</th>
                    <th>ساعات العمل</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {reportLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j}><div className="h-4 bg-surface-2 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : report.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-500">
                        <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                        لا توجد بيانات للفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    report.map((r: any, i) => {
                      const statusCfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.absent;
                      return (
                        <tr key={i}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                                {r.employeeName?.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-slate-200">{r.employeeName}</span>
                            </div>
                          </td>
                          <td>
                            <span className="text-xs text-slate-400 font-mono">{r.date}</span>
                          </td>
                          <td>
                            <span className="font-mono text-sm text-green-400">
                              {r.checkIn
                                ? new Date(r.checkIn).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </span>
                          </td>
                          <td>
                            <span className="font-mono text-sm text-red-400">
                              {r.checkOut
                                ? new Date(r.checkOut).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </span>
                          </td>
                          <td>
                            <span className="font-mono text-sm text-slate-300">
                              {r.totalHours !== null ? `${r.totalHours} ساعة` : '—'}
                            </span>
                          </td>
                          <td>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Tab: Employees ── */}
        {activeTab === 'employees' && (
          <div>
            {/* Search */}
            <div className="p-4 border-b border-surface-2">
              <div className="relative max-w-sm">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو القسم..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="input-field pr-9"
                />
              </div>
            </div>

            <div className="table-container">
              <table className="sira-table">
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>رقم ZKTeco</th>
                    <th>القسم</th>
                    <th>المنصب</th>
                    <th>الهاتف</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {empLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j}><div className="h-4 bg-surface-2 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                        <p>لا يوجد موظفون</p>
                        <p className="text-xs mt-1">اضغط "إضافة موظف" أو "استيراد من الجهاز"</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-violet-900/40 border border-violet-800/50 flex items-center justify-center text-violet-300 font-bold text-sm">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-200">{emp.name}</p>
                              <p className="text-xs text-slate-600 font-mono">{emp.email || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="font-mono text-sm text-slate-300">#{emp.zkEmployeeId}</span>
                        </td>
                        <td>
                          <span className="text-sm text-slate-400">{emp.department || '—'}</span>
                        </td>
                        <td>
                          <span className="text-sm text-slate-400">{emp.position || '—'}</span>
                        </td>
                        <td>
                          <span className="text-sm text-slate-400">{emp.phone || '—'}</span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${emp.isActive ? 'bg-green-900/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                            {emp.isActive ? 'نشط' : 'غير نشط'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingEmp(emp); setShowEmpModal(true); }}
                              className="btn-ghost btn-icon btn-sm text-slate-400 hover:text-slate-200"
                              title="تعديل"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف ${emp.name}؟`)) {
                                  deleteEmpMutation.mutate(emp.id);
                                }
                              }}
                              className="btn-ghost btn-icon btn-sm text-slate-500 hover:text-red-400"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Employee Modal ── */}
      {showEmpModal && (
        <EmployeeModal
          employee={editingEmp}
          onClose={() => { setShowEmpModal(false); setEditingEmp(null); }}
          onSave={handleSaveEmployee}
          isSaving={isSavingEmp}
        />
      )}
    </div>
  );
};
