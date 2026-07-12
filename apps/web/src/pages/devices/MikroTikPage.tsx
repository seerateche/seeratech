// ============================================================
// SEERA PLATFORM v4 - MikroTik Management Page
// ============================================================
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Router, Cpu, HardDrive, Clock, Users, Wifi,
  Upload, RefreshCw, Zap, Shield, X,
  Server, MemoryStick, ActivitySquare,
  UserPlus, UserX, Trash2, Edit2, Save, Plus,
  Gauge, ArrowDownUp, Lock, Unlock,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, api, SOCKET_URL } from '../../utils/api';
import { MikroTikStats, HotspotActiveUser, HotspotProfile, MikroTikRealtimeSnapshot } from '@sira/shared';
import toast from 'react-hot-toast';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  const [activeTab, setActiveTab] = useState<'stats' | 'hotspot' | 'pppoe' | 'queues' | 'cpe' | 'template'>('stats');
  const [cpeForm, setCpeForm] = useState({ cmd: 'set_ssid', ssid: '', password: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [showPppoeModal, setShowPppoeModal] = useState(false);
  const [pppoeForm, setPppoeForm] = useState({ deviceId: deviceId ?? '', name: '', password: '', profile: 'default', comment: '' });
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [queueForm, setQueueForm] = useState({ deviceId: deviceId ?? '', name: '', target: '', maxLimit: '10M/10M', comment: '' });

  const [liveData, setLiveData] = useState<MikroTikRealtimeSnapshot | null>(null);
  const [trafficHistory, setTrafficHistory] = useState<any[]>([]);

  // Connect WebSocket
  useEffect(() => {
    if (!deviceId) return;
    const raw = localStorage.getItem('sira-auth');
    const token = raw ? JSON.parse(raw)?.state?.accessToken : null;
    if (!token) return;

    const socket = io(`${SOCKET_URL}/ws/mikrotik`, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket.emit('mikrotik:subscribe', { deviceIds: [deviceId] });
    });

    socket.on('mikrotik:realtime', (data: MikroTikRealtimeSnapshot) => {
      if (data.deviceId === deviceId) {
        setLiveData(data);
        setTrafficHistory(prev => {
          const rxMb = Number((data.rxBitsPerSecond / 1_000_000).toFixed(2));
          const txMb = Number((data.txBitsPerSecond / 1_000_000).toFixed(2));
          const time = new Date(data.timestamp).toLocaleTimeString('ar-EG', { minute: '2-digit', second: '2-digit' });
          const next = [...prev, { time, rx: rxMb, tx: txMb }];
          if (next.length > 20) next.shift(); // Keep last 20 points
          return next;
        });
      }
    });

    return () => { socket.disconnect(); };
  }, [deviceId]);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<MikroTikStats>({
    queryKey: ['mikrotik', 'stats', deviceId],
    queryFn: () => apiGet(`/mikrotik/${deviceId}/stats`),
    refetchInterval: false, // Replaced by WebSockets
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
    { id: 'stats',    label: 'إحصائيات' },
    { id: 'hotspot',  label: 'الهوتسبوت' },
    { id: 'pppoe',    label: 'PPPoE' },
    { id: 'queues',   label: 'Queues' },
    { id: 'cpe',      label: 'إدارة CPE' },
    { id: 'template', label: 'قالب الهوتسبوت' },
  ] as const;

  const currentCpu = liveData ? liveData.cpuLoad : (stats?.cpuLoad || 0);
  const memPct = liveData 
    ? (liveData.memoryUsed / liveData.memoryTotal) * 100 
    : (stats ? (stats.memoryUsed / stats.memoryTotal) * 100 : 0);
  const memUsed = liveData ? liveData.memoryUsed : (stats?.memoryUsed || 0);
  const memTotal = liveData ? liveData.memoryTotal : (stats?.memoryTotal || 0);
  
  const hddPct = stats ? (stats.hddUsed / stats.hddTotal) * 100 : 0;
  const activeHotspotUsers = liveData ? liveData.activeHotspot : (stats?.activeHotspotUsers || 0);
  const uptime = liveData ? liveData.uptime : (stats?.uptime || '');

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
            { icon: Cpu, label: 'المعالج (Live)', value: `${currentCpu}%`, sub: 'CPU Load',
              color: currentCpu > 80 ? 'red' : currentCpu > 60 ? 'amber' : 'green' },
            { icon: MemoryStick, label: 'الذاكرة (Live)', value: `${memPct.toFixed(0)}%`,
              sub: `${formatBytes(memUsed)} / ${formatBytes(memTotal)}`,
              color: memPct > 85 ? 'red' : 'blue' },
            { icon: Users, label: 'مستخدمو الهوتسبوت', value: activeHotspotUsers, sub: 'نشطون', color: 'green' },
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
                      <span className="font-mono text-slate-200">{currentCpu}%</span>
                    </div>
                    <ProgressBar value={currentCpu} max={100}
                      color={currentCpu > 80 ? '#ef4444' : currentCpu > 60 ? '#f59e0b' : '#22c55e'} />
                  </div>
                  {/* RAM */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">الذاكرة العشوائية</span>
                      <span className="font-mono text-slate-200">
                        {formatBytes(memUsed)} / {formatBytes(memTotal)}
                      </span>
                    </div>
                    <ProgressBar value={memUsed} max={memTotal}
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
                      <p className="font-mono text-sm text-slate-200">{uptime}</p>
                    </div>
                  </div>
                </div>
                
                {/* Live Traffic Chart */}
                <div className="pt-4 border-t border-surface-2">
                  <div className="flex items-center gap-2 mb-4">
                    <ActivitySquare className="w-4 h-4 text-sira-400" />
                    <p className="text-sm font-semibold text-slate-300">مراقبة الترافيك (Live Traffic)</p>
                  </div>
                  <div className="h-64 bg-surface rounded-xl border border-surface-2 p-4">
                    {trafficHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trafficHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickMargin={10} />
                          <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val}M`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                            itemStyle={{ color: '#e2e8f0' }}
                            formatter={(value: number) => [`${value} Mbps`, '']}
                          />
                          <Area type="monotone" dataKey="rx" name="التحميل (Rx)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRx)" />
                          <Area type="monotone" dataKey="tx" name="الرفع (Tx)" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorTx)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                        <Zap className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">جاري جلب البيانات الحية...</p>
                      </div>
                    )}
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

        {/* ── PPPoE Tab ── */}
        {activeTab === 'pppoe' && <PppoeTab deviceId={deviceId!} />}

        {/* ── Queues Tab ── */}
        {activeTab === 'queues' && <QueuesTab deviceId={deviceId!} />}

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

// ============================================================
// PPPoE Tab Component
// ============================================================
const PppoeTab: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', password: '', profile: 'default', comment: '' });
  const [search, setSearch] = useState('');

  const { data: pppoeUsers = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['mikrotik', 'pppoe', deviceId],
    queryFn: () => apiGet('/mikrotik/pppoe/users', { deviceId }),
    enabled: !!deviceId,
    refetchInterval: 15_000,
  });

  const { data: activePppoe = [] } = useQuery<any[]>({
    queryKey: ['mikrotik', 'pppoe-active', deviceId],
    queryFn: () => apiGet('/mikrotik/pppoe/active', { deviceId }),
    enabled: !!deviceId,
    refetchInterval: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/mikrotik/pppoe/users', { deviceId, ...data }),
    onSuccess: () => { toast.success('تم إنشاء المستخدم ✓'); refetch(); setShowModal(false); setForm({ name: '', password: '', profile: 'default', comment: '' }); },
    onError: () => toast.error('فشل إنشاء المستخدم'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.delete(`/api/v1/mikrotik/pppoe/users/${id}?deviceId=${deviceId}`).then(r => r.data),
    onSuccess: () => { toast.success('تم حذف المستخدم'); refetch(); },
    onError: () => toast.error('فشل الحذف'),
  });

  const disconnectMutation = useMutation({
    mutationFn: (activeId: string) => apiPost('/mikrotik/pppoe/disconnect', { deviceId, activeId }),
    onSuccess: () => { toast.success('تم قطع الاتصال'); qc.invalidateQueries({ queryKey: ['mikrotik', 'pppoe-active'] }); },
  });

  const activeMap = new Map(activePppoe.map((a: any) => [a.name, a]));
  const filtered = pppoeUsers.filter((u: any) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.comment?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Stats + actions */}
      <div className="p-4 border-b border-surface-2 flex flex-wrap items-center gap-3">
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-slate-100">{pppoeUsers.length}</p>
            <p className="text-xs text-slate-500">إجمالي المستخدمين</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-green-400">{activePppoe.length}</p>
            <p className="text-xs text-slate-500">متصلون الآن</p>
          </div>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <div className="relative">
            <input
              className="input text-sm py-1.5 pr-3 w-44"
              placeholder="بحث بالاسم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => refetch()} className="btn-ghost btn-icon"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowModal(true)} className="btn-primary gap-2 text-sm">
            <UserPlus className="w-4 h-4" />إضافة مستخدم
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="sira-table">
          <thead>
            <tr>
              <th>اسم المستخدم</th>
              <th>البروفايل</th>
              <th>التعليق</th>
              <th>الحالة</th>
              <th>IP</th>
              <th>مدة الاتصال</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j}><div className="h-4 bg-surface-2 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                لا يوجد مستخدمون PPPoE
              </td></tr>
            ) : (
              filtered.map((u: any) => {
                const active = activeMap.get(u.name);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-400' : 'bg-slate-600'}`} />
                        <span className="font-mono text-sm text-slate-200">{u.name}</span>
                      </div>
                    </td>
                    <td><span className="text-xs text-slate-400">{u.profile}</span></td>
                    <td><span className="text-xs text-slate-500">{u.comment || '—'}</span></td>
                    <td>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${active ? 'bg-green-900/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                        {active ? 'متصل' : 'غير متصل'}
                      </span>
                    </td>
                    <td><span className="font-mono text-xs text-slate-400">{active?.address || '—'}</span></td>
                    <td><span className="font-mono text-xs text-sira-300">{active?.uptime || '—'}</span></td>
                    <td>
                      <div className="flex gap-1">
                        {active && (
                          <button
                            onClick={() => disconnectMutation.mutate(active.id)}
                            className="btn-ghost btn-icon btn-sm text-amber-400 hover:text-amber-300"
                            title="قطع الاتصال"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`حذف المستخدم ${u.name}?`)) deleteMutation.mutate({ id: u.id });
                          }}
                          className="btn-ghost btn-icon btn-sm text-slate-500 hover:text-red-400"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-1 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-surface-2">
              <h2 className="text-lg font-bold text-slate-100">إضافة مستخدم PPPoE</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost btn-icon"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">اسم المستخدم *</label>
                <input className="input-field" dir="ltr" value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="client01" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">كلمة المرور *</label>
                <input className="input-field" type="password" value={form.password}
                  onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">البروفايل</label>
                <input className="input-field" dir="ltr" value={form.profile}
                  onChange={(e) => setForm(p => ({ ...p, profile: e.target.value }))} placeholder="default" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">ملاحظة (اختياري)</label>
                <input className="input-field" value={form.comment}
                  onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))} placeholder="اسم العميل أو العنوان" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-surface-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">إلغاء</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || !form.password || createMutation.isPending}
                className="btn-primary flex-1 gap-2"
              >
                <Save className="w-4 h-4" />
                {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Queues (Simple Queue) Tab Component
// ============================================================
const QueuesTab: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', target: '', maxLimit: '10M/10M', comment: '' });
  const [search, setSearch] = useState('');

  const { data: queues = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['mikrotik', 'queues', deviceId],
    queryFn: () => apiGet(`/mikrotik/${deviceId}/queues`),
    enabled: !!deviceId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost(`/mikrotik/${deviceId}/queues`, data),
    onSuccess: () => { toast.success('تم إنشاء Queue ✓'); refetch(); setShowModal(false); setForm({ name: '', target: '', maxLimit: '10M/10M', comment: '' }); },
    onError: () => toast.error('فشل إنشاء Queue'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/mikrotik/${deviceId}/queues/${id}`).then(r => r.data),
    onSuccess: () => { toast.success('تم الحذف'); refetch(); },
    onError: () => toast.error('فشل الحذف'),
  });

  const filtered = queues.filter((q: any) =>
    !search || q.name?.toLowerCase().includes(search.toLowerCase()) || q.target?.includes(search)
  );

  // Parse maxLimit like "10M/10M" → download / upload
  const parseLimit = (limit: string) => {
    const [dl, ul] = (limit || '').split('/');
    return { dl: dl || '?', ul: ul || '?' };
  };

  return (
    <div>
      <div className="p-4 border-b border-surface-2 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-lg font-bold font-mono text-slate-100">{queues.length}</p>
          <p className="text-xs text-slate-500">Simple Queues</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <input
            className="input text-sm py-1.5 w-44"
            placeholder="بحث بالاسم أو IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => refetch()} className="btn-ghost btn-icon"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowModal(true)} className="btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" />إضافة Queue
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="sira-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الهدف (IP)</th>
              <th>↓ تحميل</th>
              <th>↑ رفع</th>
              <th>الحالة</th>
              <th>ملاحظة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j}><div className="h-4 bg-surface-2 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">
                <Gauge className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                لا توجد Queues مضبوطة
              </td></tr>
            ) : (
              filtered.map((q: any) => {
                const { dl, ul } = parseLimit(q.maxLimit || q['max-limit'] || '');
                const disabled = q.disabled === 'true' || q.disabled === true;
                return (
                  <tr key={q.id}>
                    <td><span className="font-mono text-sm text-slate-200">{q.name}</span></td>
                    <td><span className="font-mono text-xs text-blue-300">{q.target || q['target-addresses'] || '—'}</span></td>
                    <td><span className="text-sm text-green-400 font-mono">{dl}</span></td>
                    <td><span className="text-sm text-amber-400 font-mono">{ul}</span></td>
                    <td>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${disabled ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
                        {disabled ? 'معطل' : 'نشط'}
                      </span>
                    </td>
                    <td><span className="text-xs text-slate-500">{q.comment || '—'}</span></td>
                    <td>
                      <button
                        onClick={() => { if (confirm(`حذف Queue ${q.name}?`)) deleteMutation.mutate(q.id); }}
                        className="btn-ghost btn-icon btn-sm text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Queue Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-1 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-surface-2">
              <h2 className="text-lg font-bold text-slate-100">إضافة Simple Queue</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost btn-icon"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">الاسم *</label>
                <input className="input-field" dir="ltr" value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Client_192.168.1.10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">IP الهدف *</label>
                <input className="input-field" dir="ltr" value={form.target}
                  onChange={(e) => setForm(p => ({ ...p, target: e.target.value }))} placeholder="192.168.1.10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">الحد الأقصى (تحميل/رفع)</label>
                <input className="input-field" dir="ltr" value={form.maxLimit}
                  onChange={(e) => setForm(p => ({ ...p, maxLimit: e.target.value }))} placeholder="10M/10M" />
                <p className="text-xs text-slate-600">مثال: 20M/5M = 20 Mbps تحميل / 5 Mbps رفع</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">ملاحظة</label>
                <input className="input-field" value={form.comment}
                  onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))} placeholder="اسم العميل" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-surface-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">إلغاء</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || !form.target || createMutation.isPending}
                className="btn-primary flex-1 gap-2"
              >
                <Save className="w-4 h-4" />
                {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
