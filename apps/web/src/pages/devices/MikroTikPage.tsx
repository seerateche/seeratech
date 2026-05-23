// ============================================================
// SEERA PLATFORM v4 - MikroTik Management Page
// ============================================================
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Router, Cpu, HardDrive, Clock, Users, Wifi, WifiOff,
  Upload, RefreshCw, Zap, Shield, ChevronRight, X,
  Server, Globe, Activity, MemoryStick,
} from 'lucide-react';
import { apiGet, apiPost, api } from '../../utils/api';
import { MikroTikStats, HotspotActiveUser, HotspotProfile } from '@sira/shared';
import toast from 'react-hot-toast';

const ProgressBar: React.FC<{ value: number; max: number; color?: string }> = ({
  value, max, color = '#6366f1',
}) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

export const MikroTikPage: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'stats' | 'hotspot' | 'cpe' | 'template'>('stats');
  const [cpeForm, setCpeForm] = useState({ cmd: 'set_ssid', ssid: '', password: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<MikroTikStats>({
    queryKey: ['mikrotik', 'stats', deviceId],
    queryFn: () => apiGet(`/mikrotik/${deviceId}/stats`),
    refetchInterval: 15_000,
    enabled: !!deviceId,
  });

  const { data: hotspotUsers = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<HotspotActiveUser[]>({
    queryKey: ['mikrotik', 'hotspot-users', deviceId],
    queryFn: () => apiGet(`/mikrotik/${deviceId}/hotspot/active`),
    refetchInterval: 10_000,
    enabled: !!deviceId && activeTab === 'hotspot',
  });

  const { data: profiles = [] } = useQuery<HotspotProfile[]>({
    queryKey: ['mikrotik', 'profiles', deviceId],
    queryFn: () => apiGet(`/mikrotik/${deviceId}/hotspot/profiles`),
    enabled: !!deviceId,
  });

  const kickMutation = useMutation({
    mutationFn: (activeId: string) => apiPost(`/mikrotik/${deviceId}/hotspot/kick/${activeId}`),
    onSuccess: () => { toast.success('تم قطع الاتصال'); refetchUsers(); },
  });

  const cpeMutation = useMutation({
    mutationFn: (data: typeof cpeForm) =>
      apiPost(`/mikrotik/${deviceId}/cpe`, { command: data.cmd, params: { ssid: data.ssid, password: data.password } }),
    onSuccess: () => toast.success('تم تنفيذ الأمر على CPE ✓'),
    onError: () => toast.error('فشل تنفيذ الأمر'),
  });

  const templateMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) return;
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('templateName', templateName);
      return api.post(`/mikrotik/${deviceId}/template/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('تم رفع القالب وتفعيله على الراوتر ✓');
      setUploadFile(null);
      setTemplateName('');
    },
    onError: () => toast.error('فشل رفع القالب'),
  });

  const TABS = [
    { id: 'stats',    label: 'إحصائيات النظام' },
    { id: 'hotspot',  label: 'مستخدمو الهوتسبوت' },
    { id: 'cpe',      label: 'إدارة CPE' },
    { id: 'template', label: 'قالب الهوتسبوت' },
  ] as const;

  const memPct = stats ? (stats.memoryUsed / stats.memoryTotal) * 100 : 0;
  const hddPct = stats ? (stats.hddUsed / stats.hddTotal) * 100 : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sira-900/40 border border-sira-800/50 flex items-center justify-center">
          <Router className="w-5 h-5 text-sira-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-100">إدارة MikroTik</h1>
          <p className="text-sm text-slate-500 font-mono">{deviceId}</p>
        </div>
        <button onClick={() => { refetchStats(); refetchUsers(); }} className="btn-ghost btn-icon">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* System stats summary row */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Server, label: 'الجهاز', value: stats.boardName, sub: `v${stats.version}`, color: 'sira' },
            { icon: Cpu, label: 'المعالج', value: `${stats.cpuLoad}%`, sub: 'CPU Load',
              color: stats.cpuLoad > 80 ? 'red' : stats.cpuLoad > 60 ? 'amber' : 'green' },
            { icon: MemoryStick, label: 'الذاكرة', value: `${((stats.memoryUsed / stats.memoryTotal) * 100).toFixed(0)}%`,
              sub: `${formatBytes(stats.memoryUsed)} / ${formatBytes(stats.memoryTotal)}`,
              color: memPct > 85 ? 'red' : 'blue' },
            { icon: Users, label: 'مستخدمو الهوتسبوت', value: stats.activeHotspotUsers, sub: 'نشطون', color: 'green' },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${
                  s.color === 'sira' ? 'text-sira-400' :
                  s.color === 'green' ? 'text-green-400' :
                  s.color === 'blue' ? 'text-blue-400' :
                  s.color === 'amber' ? 'text-amber-400' : 'text-red-400'
                }`} />
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
              <p className="text-xl font-bold font-mono text-slate-100">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="flex overflow-x-auto border-b border-surface-2">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sira-500 text-sira-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >{tab.label}</button>
          ))}
        </div>

        {/* ── Stats Tab ── */}
        {activeTab === 'stats' && (
          <div className="p-5">
            {statsLoading ? (
              <div className="h-40 animate-pulse bg-surface-2 rounded-xl" />
            ) : stats ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* CPU */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">استخدام المعالج</span>
                      <span className="font-mono text-slate-200">{stats.cpuLoad}%</span>
                    </div>
                    <ProgressBar value={stats.cpuLoad} max={100}
                      color={stats.cpuLoad > 80 ? '#ef4444' : stats.cpuLoad > 60 ? '#f59e0b' : '#22c55e'} />
                  </div>
                  {/* RAM */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">الذاكرة العشوائية</span>
                      <span className="font-mono text-slate-200">
                        {formatBytes(stats.memoryUsed)} / {formatBytes(stats.memoryTotal)}
                      </span>
                    </div>
                    <ProgressBar value={stats.memoryUsed} max={stats.memoryTotal}
                      color={memPct > 85 ? '#ef4444' : '#6366f1'} />
                  </div>
                  {/* Storage */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">مساحة التخزين</span>
                      <span className="font-mono text-slate-200">
                        {formatBytes(stats.hddUsed)} / {formatBytes(stats.hddTotal)}
                      </span>
                    </div>
                    <ProgressBar value={stats.hddUsed} max={stats.hddTotal}
                      color={hddPct > 90 ? '#ef4444' : '#f59e0b'} />
                  </div>
                  {/* Uptime */}
                  <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-surface-2">
                    <Clock className="w-5 h-5 text-sira-400" />
                    <div>
                      <p className="text-xs text-slate-500">وقت التشغيل</p>
                      <p className="font-mono text-sm text-slate-200">{stats.uptime}</p>
                    </div>
                  </div>
                </div>
                {/* Device info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-surface-2">
                  {[
                    { label: 'الجهاز',          value: stats.boardName },
                    { label: 'RouterOS',         value: `v${stats.version}` },
                    { label: 'الرقم التسلسلي',   value: stats.serialNumber },
                  ].map((info) => (
                    <div key={info.label}>
                      <p className="text-xs text-slate-600">{info.label}</p>
                      <p className="text-sm font-mono text-slate-300 mt-0.5">{info.value}</p>
                    </div>
                  ))}
                </div>
                {/* Profiles */}
                {profiles.length > 0 && (
                  <div className="pt-4 border-t border-surface-2">
                    <p className="text-xs font-semibold text-slate-500 mb-3">بروفايلات الهوتسبوت</p>
                    <div className="flex flex-wrap gap-2">
                      {profiles.map((p) => (
                        <div key={p.name} className="px-3 py-1.5 bg-surface rounded-lg border border-surface-2 text-xs">
                          <p className="font-medium text-slate-200">{p.name}</p>
                          <p className="text-slate-500">{p.rateLimit || 'unlimited'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Hotspot Tab ── */}
        {activeTab === 'hotspot' && (
          <div>
            <div className="px-5 py-3 border-b border-surface-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-slate-300">{hotspotUsers.length} مستخدم نشط</span>
              </div>
              <button onClick={() => refetchUsers()} className="btn-ghost btn-icon btn-sm">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="table-container">
              <table className="sira-table">
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>IP</th>
                    <th>MAC</th>
                    <th>مدة الاتصال</th>
                    <th>↓ تحميل</th>
                    <th>↑ رفع</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                        <td key={j}><div className="h-4 bg-surface-2 rounded animate-pulse" /></td>
                      ))}</tr>
                    ))
                  ) : hotspotUsers.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-500">لا يوجد مستخدمون نشطون</td></tr>
                  ) : (
                    hotspotUsers.map((u) => (
                      <tr key={u.id}>
                        <td><span className="font-mono text-sm text-slate-200">{u.user}</span></td>
                        <td><span className="font-mono text-xs text-slate-400">{u.address}</span></td>
                        <td><span className="font-mono text-xs text-slate-500">{u.macAddress}</span></td>
                        <td><span className="font-mono text-sm text-sira-300">{u.uptime}</span></td>
                        <td><span className="text-xs text-green-400 font-mono">{formatBytes(u.bytesIn)}</span></td>
                        <td><span className="text-xs text-amber-400 font-mono">{formatBytes(u.bytesOut)}</span></td>
                        <td>
                          <button
                            onClick={() => kickMutation.mutate(u.id)}
                            className="btn-danger btn-sm"
                            title="قطع الاتصال"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CPE Tab ── */}
        {activeTab === 'cpe' && (
          <div className="p-5 space-y-5">
            <div className="bg-sira-900/20 border border-sira-800/30 rounded-xl p-4 text-sm text-sira-300">
              <Shield className="w-4 h-4 inline ml-2" />
              يتم توجيه الأوامر عبر نفق VPN في MikroTik إلى نقاط الوصول المتصلة
            </div>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="input-label">الأمر</label>
                <select className="input" value={cpeForm.cmd}
                  onChange={(e) => setCpeForm({ ...cpeForm, cmd: e.target.value })}>
                  <option value="set_ssid">تغيير اسم الشبكة (SSID)</option>
                  <option value="set_password">تغيير كلمة مرور الواي فاي</option>
                  <option value="get_clients">عرض الأجهزة المتصلة</option>
                  <option value="get_signal">قوة الإشارة</option>
                  <option value="reboot">إعادة تشغيل CPE</option>
                </select>
              </div>

              {cpeForm.cmd === 'set_ssid' && (
                <div>
                  <label className="input-label">اسم الشبكة الجديد</label>
                  <input className="input" placeholder="My_ISP_Network" dir="ltr"
                    value={cpeForm.ssid} onChange={(e) => setCpeForm({ ...cpeForm, ssid: e.target.value })} />
                </div>
              )}

              {cpeForm.cmd === 'set_password' && (
                <div>
                  <label className="input-label">كلمة المرور الجديدة</label>
                  <input type="password" className="input" placeholder="••••••••"
                    value={cpeForm.password} onChange={(e) => setCpeForm({ ...cpeForm, password: e.target.value })} />
                </div>
              )}

              <button
                onClick={() => cpeMutation.mutate(cpeForm)}
                disabled={cpeMutation.isPending}
                className="btn-primary gap-2"
              >
                {cpeMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />تنفيذ...</>
                ) : (
                  <><Zap className="w-4 h-4" />تنفيذ الأمر</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Template Upload Tab ── */}
        {activeTab === 'template' && (
          <div className="p-5 space-y-5">
            <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl p-4 text-sm text-amber-300">
              <Upload className="w-4 h-4 inline ml-2" />
              ارفع ملف ZIP يحتوي على قالب صفحة الهوتسبوت (يجب أن يحتوي على login.html في الجذر).
              سيتم رفعه مباشرة إلى ذاكرة الراوتر عبر FTP وتفعيله تلقائياً.
            </div>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="input-label">اسم القالب</label>
                <input className="input" placeholder="my-hotspot-template" dir="ltr"
                  value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              </div>

              <div>
                <label className="input-label">ملف ZIP</label>
                <div
                  className="border-2 border-dashed border-surface-2 rounded-xl p-8 text-center cursor-pointer hover:border-sira-700 transition-colors"
                  onClick={() => document.getElementById('template-upload')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file?.name.endsWith('.zip')) setUploadFile(file);
                    else toast.error('يجب أن يكون الملف ZIP');
                  }}
                >
                  <input id="template-upload" type="file" accept=".zip" className="hidden"
                    onChange={(e) => e.target.files?.[0] && setUploadFile(e.target.files[0])} />
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 bg-sira-900/40 rounded-xl flex items-center justify-center">
                        <Upload className="w-5 h-5 text-sira-400" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-200">{uploadFile.name}</p>
                        <p className="text-xs text-slate-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                        className="btn-ghost btn-icon btn-sm text-red-400 mr-auto">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">اسحب ملف ZIP هنا أو انقر للاختيار</p>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => templateMutation.mutate()}
                disabled={templateMutation.isPending || !uploadFile || !templateName}
                className="btn-primary gap-2"
              >
                {templateMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جارٍ الرفع...</>
                ) : (
                  <><Upload className="w-4 h-4" />رفع وتفعيل القالب</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
