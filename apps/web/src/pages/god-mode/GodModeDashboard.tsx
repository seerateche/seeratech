// ============================================================
// SIRA PLATFORM v4 - God Mode Dashboard (Super Admin)
// ============================================================
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Crown, Building2, Router, Wifi, Users, Activity,
  AlertTriangle, CheckCircle2, XCircle, TrendingUp,
  RefreshCw, Eye, Terminal, MoreVertical, Globe,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import { CompanySummary, CompanyStatus, DeviceStatus } from '@sira/shared';
import { CompanyDetailsModal } from '../../components/dashboard/CompanyDetailsModal';
import { GlobalStatsCard } from '../../components/dashboard/GlobalStatsCard';
import { AddCompanyModal } from '../../components/dashboard/AddCompanyModal';
import { useAuthStore } from '../../stores/auth.store';
import { useNavigate } from 'react-router-dom';

interface GlobalStats {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalActiveVouchers: number;
  totalVouchersToday: number;
  companiesOnTrial: number;
}

export const GodModeDashboard: React.FC = () => {
  const { switchToCompany } = useAuthStore();
  const navigate = useNavigate();
  const [selectedCompany, setSelectedCompany] = useState<CompanySummary | null>(null);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [search, setSearch] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery<GlobalStats>({
    queryKey: ['god-mode', 'stats'],
    queryFn: () => apiGet('/admin/stats'),
    refetchInterval: 30_000,
  });

  const { data: companies = [], isLoading: companiesLoading, refetch } = useQuery<CompanySummary[]>({
    queryKey: ['god-mode', 'companies'],
    queryFn: () => apiGet('/admin/companies'),
    refetchInterval: 60_000,
  });

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase()),
  );

  const getStatusBadge = (status: CompanyStatus) => {
    switch (status) {
      case 'active':    return <span className="badge-online">نشط</span>;
      case 'suspended': return <span className="badge-error">موقوف</span>;
      case 'trial':     return <span className="badge-warning">تجريبي</span>;
      default:          return <span className="badge-offline">{status}</span>;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">وضع المدير العام</h1>
          <p className="text-sm text-slate-500">رؤية شاملة لجميع الشركات والأجهزة</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost btn-icon mr-auto"
          title="تحديث البيانات"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Global Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlobalStatsCard
            icon={Building2}
            label="إجمالي الشركات"
            value={stats.totalCompanies}
            sub={`${stats.activeCompanies} نشطة`}
            color="sira"
          />
          <GlobalStatsCard
            icon={Router}
            label="الأجهزة المتصلة"
            value={stats.onlineDevices}
            sub={`${stats.totalDevices} إجمالي`}
            color="green"
          />
          <GlobalStatsCard
            icon={Wifi}
            label="البطاقات النشطة"
            value={stats.totalActiveVouchers}
            sub={`${stats.totalVouchersToday} اليوم`}
            color="blue"
          />
          <GlobalStatsCard
            icon={AlertTriangle}
            label="أجهزة غير متصلة"
            value={stats.offlineDevices}
            sub={`${stats.suspendedCompanies} شركة موقوفة`}
            color="amber"
          />
        </div>
      ) : null}

      {/* Companies Table */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-sira-400" />
            <h2 className="font-semibold text-slate-200">
              جميع الشركات ({filtered.length})
            </h2>
          </div>
          <input
            type="text"
            className="input w-56 text-sm py-1.5"
            placeholder="بحث عن شركة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setShowAddCompany(true)}
            className="btn-primary btn-sm flex items-center gap-1 shrink-0"
          >
            <Building2 className="w-4 h-4" />
            إضافة شركة
          </button>
        </div>

        <div className="table-container">
          <table className="sira-table">
            <thead>
              <tr>
                <th>الشركة</th>
                <th>الموقع</th>
                <th>الحالة</th>
                <th>الأجهزة</th>
                <th>البطاقات النشطة</th>
                <th>آخر نشاط</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {companiesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-surface-2 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    لا توجد شركات
                  </td>
                </tr>
              ) : (
                filtered.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <div>
                        <p className="font-medium text-slate-200">{company.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{company.slug}</p>
                      </div>
                    </td>
                    <td>
                      <span className="text-slate-400">
                        {company.city}، {company.country}
                      </span>
                    </td>
                    <td>{getStatusBadge(company.status)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="font-mono">{company.deviceCount}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-sira-300">
                        {company.activeVouchers.toLocaleString('ar')}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-500 text-xs">
                        {company.lastSeen
                          ? new Date(company.lastSeen).toLocaleString('ar')
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            switchToCompany(company.id, company.name);
                            navigate('/dashboard');
                          }}
                          className="btn-ghost btn-icon btn-sm text-sira-400 hover:text-sira-300"
                          title="الدخول كمدير لهذه الشركة"
                        >
                          <Building2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedCompany(company)}
                          className="btn-ghost btn-icon btn-sm"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCompany(company);
                          }}
                          className="btn-ghost btn-icon btn-sm"
                          title="الطرفية — اختر جهاز من تفاصيل الشركة"
                        >
                          <Terminal className="w-4 h-4" />
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

      {/* Company Details Modal */}
      {selectedCompany && (
        <CompanyDetailsModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}

      {/* Add Company Modal */}
      {showAddCompany && (
        <AddCompanyModal
          onClose={() => setShowAddCompany(false)}
          onSuccess={() => {
            setShowAddCompany(false);
            refetch();
          }}
        />
      )}
    </div>
  );
};
