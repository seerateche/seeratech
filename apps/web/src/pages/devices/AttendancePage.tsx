// ============================================================
// SIRA PLATFORM v4 - Attendance Page (ZKTeco Biometric)
// ============================================================
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  Fingerprint, RefreshCw, Download, Users,
  Clock, CheckCircle2, XCircle, AlertCircle,
  Calendar, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { apiGet, apiPost, api } from '../../utils/api';
import { AttendanceLog, AttendanceReport, DeviceSummary, DeviceType, WsEvent } from '@sira/shared';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';

const EVENT_CONFIG = {
  check_in:     { label: 'حضور', color: 'text-green-400', bg: 'bg-green-900/30' },
  check_out:    { label: 'انصراف', color: 'text-red-400',   bg: 'bg-red-900/30' },
  break_in:     { label: 'بداية راحة', color: 'text-amber-400', bg: 'bg-amber-900/30' },
  break_out:    { label: 'نهاية راحة', color: 'text-blue-400',  bg: 'bg-blue-900/30' },
  overtime_in:  { label: 'عمل إضافي', color: 'text-sira-400',  bg: 'bg-sira-900/30' },
  overtime_out: { label: 'نهاية إضافي', color: 'text-slate-400', bg: 'bg-surface-2' },
};

const STATUS_CONFIG = {
  present:  { label: 'حاضر',        color: 'text-green-400' },
  absent:   { label: 'غائب',         color: 'text-red-400' },
  late:     { label: 'متأخر',        color: 'text-amber-400' },
  half_day: { label: 'نصف يوم',     color: 'text-blue-400' },
};

export const AttendancePage: React.FC = () => {
  const { accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'live' | 'report'>('live');
  const [liveLogs, setLiveLogs] = useState<AttendanceLog[]>([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const { data: devices = [] } = useQuery<DeviceSummary[]>({
    queryKey: ['devices', 'biometric'],
    queryFn: () => apiGet('/devices', { type: 'biometric' }),
  });
  const zkDevices = devices.filter((d) => d.type === DeviceType.BIOMETRIC);

  const { data: historicalLogs = [], refetch: refetchLogs } = useQuery<AttendanceLog[]>({
    queryKey: ['attendance', 'logs', selectedDevice],
    queryFn: () =>
      apiGet('/attendance/logs', { deviceId: selectedDevice, limit: 100 }),
  });

  const { data: report = [], isLoading: reportLoading } = useQuery<AttendanceReport[]>({
    queryKey: ['attendance', 'report', reportDate],
    queryFn: () => apiGet('/attendance/report', { date: reportDate }),
    enabled: activeTab === 'report',
  });

  const syncMutation = useMutation({
    mutationFn: (deviceId: string) => apiPost(`/attendance/sync/${deviceId}`),
    onSuccess: (data: any) => {
      toast.success(`تم مزامنة ${data.count} سجل`);
      refetchLogs();
    },
    onError: () => toast.error('فشلت المزامنة'),
  });

  // Real-time WebSocket listener
  useEffect(() => {
    const socket = io('/ws', {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on(WsEvent.ATTENDANCE_NEW_LOG, (log: AttendanceLog) => {
      setLiveLogs((prev) => [log, ...prev].slice(0, 50));
      const cfg = EVENT_CONFIG[log.eventType] || EVENT_CONFIG.check_in;
      toast.success(
        `${log.employeeName} — ${cfg.label}`,
        { icon: '👆', duration: 4000 },
      );
    });

    return () => { socket.disconnect(); };
  }, [accessToken]);

  const exportReport = async () => {
    try {
      const res = await api.get(`/attendance/report/export?date=${reportDate}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${reportDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('فشل التصدير');
    }
  };

  const allLogs = [...liveLogs, ...historicalLogs.filter(
    (h) => !liveLogs.find((l) => l.id === h.id),
  )];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-900/40 border border-violet-800/50 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">الحضور والانصراف</h1>
            <p className="text-sm text-slate-500">
              أجهزة ZKTeco | {liveLogs.length > 0 && (
                <span className="text-green-400">● مباشر</span>
              )}
            </p>
          </div>
        </div>

        <div className="mr-auto flex items-center gap-2">
          {activeTab === 'report' && (
            <button onClick={exportReport} className="btn-secondary gap-2">
              <Download className="w-4 h-4" />
              تصدير
            </button>
          )}
          {zkDevices.length > 0 && (
            <button
              onClick={() => syncMutation.mutate(zkDevices[0].id)}
              disabled={syncMutation.isPending}
              className="btn-secondary gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              مزامنة
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {activeTab === 'report' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'الحاضرون',
              value: report.filter((r) => r.status === 'present').length,
              icon: CheckCircle2, color: 'text-green-400',
            },
            {
              label: 'الغائبون',
              value: report.filter((r) => r.status === 'absent').length,
              icon: XCircle, color: 'text-red-400',
            },
            {
              label: 'المتأخرون',
              value: report.filter((r) => r.status === 'late').length,
              icon: Clock, color: 'text-amber-400',
            },
            {
              label: 'نصف يوم',
              value: report.filter((r) => r.status === 'half_day').length,
              icon: AlertCircle, color: 'text-blue-400',
            },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color} flex-shrink-0`} />
              <div>
                <p className="text-xl font-bold font-mono text-slate-100">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="flex items-center border-b border-surface-2 px-4">
          {[
            { id: 'live',   label: 'السجلات المباشرة' },
            { id: 'report', label: 'تقرير اليومي' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sira-500 text-sira-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.id === 'live' && liveLogs.length > 0 && (
                <span className="mr-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 inline-flex items-center justify-center">
                  {liveLogs.length}
                </span>
              )}
            </button>
          ))}

          {activeTab === 'report' && (
            <div className="mr-auto flex items-center gap-2 py-2">
              <button
                onClick={() => {
                  const d = new Date(reportDate);
                  d.setDate(d.getDate() - 1);
                  setReportDate(d.toISOString().split('T')[0]);
                }}
                className="btn-ghost btn-icon btn-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <input
                type="date"
                className="input text-sm py-1.5 w-36"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <button
                onClick={() => {
                  const d = new Date(reportDate);
                  d.setDate(d.getDate() + 1);
                  setReportDate(d.toISOString().split('T')[0]);
                }}
                className="btn-ghost btn-icon btn-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Live logs */}
        {activeTab === 'live' && (
          <div className="table-container">
            <table className="sira-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الحدث</th>
                  <th>الوقت</th>
                  <th>الجهاز</th>
                  <th>طريقة التحقق</th>
                </tr>
              </thead>
              <tbody>
                {allLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">
                      <Fingerprint className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                      لا توجد سجلات بعد
                    </td>
                  </tr>
                ) : (
                  allLogs.map((log, i) => {
                    const cfg = EVENT_CONFIG[log.eventType] || EVENT_CONFIG.check_in;
                    const isNew = liveLogs.some((l) => l.id === log.id);
                    return (
                      <tr
                        key={`${log.id}-${i}`}
                        className={isNew ? 'bg-sira-900/10' : ''}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-sira-900/40 border border-sira-800/50 flex items-center justify-center text-sira-400 text-xs font-bold">
                              {log.employeeName?.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-200">
                                {log.employeeName}
                              </p>
                              <p className="text-xs text-slate-500 font-mono">
                                #{log.employeeId?.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-sm text-slate-300">
                            {new Date(log.timestamp).toLocaleTimeString('ar')}
                          </span>
                          <p className="text-xs text-slate-600">
                            {new Date(log.timestamp).toLocaleDateString('ar')}
                          </p>
                        </td>
                        <td>
                          <span className="text-xs text-slate-500 font-mono">
                            {log.deviceId?.slice(0, 8)}...
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-500">بصمة</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Daily report */}
        {activeTab === 'report' && (
          <div className="table-container">
            <table className="sira-table">
              <thead>
                <tr>
                  <th>الموظف</th>
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
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j}><div className="h-4 bg-surface-2 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : report.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">
                      لا توجد بيانات لهذا اليوم
                    </td>
                  </tr>
                ) : (
                  report.map((r, i) => {
                    const statusCfg = STATUS_CONFIG[r.status];
                    return (
                      <tr key={i}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                              {r.employeeName?.charAt(0)}
                            </div>
                            <p className="text-sm font-medium text-slate-200">{r.employeeName}</p>
                          </div>
                        </td>
                        <td>
                          <span className="font-mono text-sm text-green-400">
                            {r.checkIn ? new Date(r.checkIn).toLocaleTimeString('ar') : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-sm text-red-400">
                            {r.checkOut ? new Date(r.checkOut).toLocaleTimeString('ar') : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-sm text-slate-300">
                            {r.totalHours !== null ? `${r.totalHours}h` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm font-medium ${statusCfg.color}`}>
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
        )}
      </div>
    </div>
  );
};
