// ============================================================
// SIRA PLATFORM v4 - Company Dashboard
// ============================================================
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Router, Ticket, Users, Camera, Wifi, Activity,
  TrendingUp, TrendingDown, AlertCircle, Fingerprint,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import { useAuthStore } from '../../stores/auth.store';
import { GlobalStatsCard } from '../../components/dashboard/GlobalStatsCard';
import { DeviceSummary, DeviceStatus } from '@sira/shared';

interface DashboardData {
  deviceCount: number;
  onlineDevices: number;
  activeVouchers: number;
  unusedVouchers: number;
  todayAttendance: number;
  totalEmployees: number;
  voucherUsageHistory: Array<{ date: string; used: number; generated: number }>;
  deviceStatusBreakdown: Array<{ status: string; count: number }>;
  recentActivity: Array<{ type: string; message: string; time: string }>;
}

const PIE_COLORS = ['#22c55e', '#ef4444', '#6366f1', '#f59e0b'];

export const CompanyDashboard: React.FC = () => {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', user?.companyId],
    queryFn: () => apiGet('/dashboard'),
    refetchInterval: 30_000,
  });

  const { data: devices = [] } = useQuery<DeviceSummary[]>({
    queryKey: ['devices'],
    queryFn: () => apiGet('/devices'),
    refetchInterval: 60_000,
  });

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const offlineCount = devices.filter((d) => d.status !== 'online').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-72 animate-pulse" />
          <div className="card h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  const usageData = data?.voucherUsageHistory || [];

  const pieData = [
    { status: 'متصل', count: onlineCount },
    { status: 'غير متصل', count: offlineCount },
  ].filter((d) => d.count > 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            مرحباً، {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500">
            {user?.companyName} | {new Date().toLocaleDateString('ar', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-800/30 rounded-xl text-green-400 text-sm">
          <Activity className="w-4 h-4" />
          <span>النظام يعمل بشكل طبيعي</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlobalStatsCard
          icon={Router}
          label="الأجهزة"
          value={devices.length}
          sub={`${onlineCount} متصل`}
          color="sira"
        />
        <GlobalStatsCard
          icon={Ticket}
          label="بطاقات نشطة"
          value={data?.activeVouchers || 0}
          sub={`${data?.unusedVouchers || 0} غير مستخدمة`}
          color="green"
        />
        <GlobalStatsCard
          icon={Fingerprint}
          label="الحضور اليوم"
          value={data?.todayAttendance || 0}
          sub={`من ${data?.totalEmployees || 0} موظف`}
          color="blue"
        />
        <GlobalStatsCard
          icon={AlertCircle}
          label="غير متصل"
          value={offlineCount}
          sub="جهاز يحتاج مراجعة"
          color={offlineCount > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Voucher usage chart */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sira-400" />
              <h3 className="font-semibold text-slate-200">استخدام البطاقات (7 أيام)</h3>
            </div>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={usageData}>
                <defs>
                  <linearGradient id="usedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontFamily: 'IBM Plex Sans Arabic',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="used" stroke="#6366f1" fill="url(#usedGrad)" strokeWidth={2} name="مستخدمة" />
                <Area type="monotone" dataKey="generated" stroke="#22c55e" fill="url(#genGrad)" strokeWidth={2} name="منشأة" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device status pie */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Router className="w-4 h-4 text-sira-400" />
              <h3 className="font-semibold text-slate-200">حالة الأجهزة</h3>
            </div>
          </div>
          <div className="p-4 flex flex-col items-center">
            {devices.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <Router className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">لا توجد أجهزة</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="count"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 w-full mt-2">
                  {pieData.map((item, i) => (
                    <div key={item.status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-slate-400">{item.status}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-200">{item.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent devices */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sira-400" />
            <h3 className="font-semibold text-slate-200">حالة الأجهزة</h3>
          </div>
        </div>
        <div className="table-container">
          <table className="sira-table">
            <thead>
              <tr>
                <th>الجهاز</th>
                <th>النوع</th>
                <th>الحالة</th>
                <th>العنوان</th>
                <th>آخر اتصال</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">
                    لا توجد أجهزة. أضف جهازاً من صفحة الأجهزة.
                  </td>
                </tr>
              ) : (
                devices.slice(0, 10).map((device) => (
                  <tr key={device.id}>
                    <td>
                      <p className="font-medium text-slate-200">{device.name}</p>
                    </td>
                    <td>
                      <span className="text-xs bg-surface-2 text-slate-400 px-2 py-0.5 rounded font-mono uppercase">
                        {device.type}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          device.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'
                        }`} />
                        <span className={`text-sm ${
                          device.status === 'online' ? 'text-green-400' : 'text-slate-500'
                        }`}>
                          {device.status === 'online' ? 'متصل' : 'غير متصل'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-slate-500">
                        {device.useVpn ? `VPN: ${device.vpnIp}` : `${device.host}:${device.port}`}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-500">
                        {device.lastSeen
                          ? new Date(device.lastSeen).toLocaleString('ar')
                          : 'لم يتصل بعد'}
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
  );
};
