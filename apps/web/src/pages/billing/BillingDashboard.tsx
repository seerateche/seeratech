import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, TrendingUp, TrendingDown, SmartphoneNfc, FileText, FileSpreadsheet } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { Link } from 'react-router-dom';

export const BillingDashboard: React.FC = () => {
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ['billing', 'summary'],
    queryFn: () => apiGet('/billing/summary'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-surface-2 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="card h-32" />)}
        </div>
      </div>
    );
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mb-1">الماليات والفواتير</h1>
          <p className="text-sm sm:text-base text-slate-400">ملخص حسابات وإيرادات الشبكة</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/billing/invoices" className="btn-primary gap-2 flex-1 sm:flex-none justify-center">
            <FileText className="w-4 h-4" />
            فواتير العملاء
          </Link>
          <Link to="/billing/expenses" className="btn-secondary gap-2 flex-1 sm:flex-none justify-center">
            <TrendingDown className="w-4 h-4 text-red-400" />
            منصرفات
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-emerald-500/30 bg-emerald-900/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-400 pointer-events-none">
            <TrendingUp className="w-16 h-16" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-emerald-100">إجمالي الإيرادات</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono" dir="ltr">
            {formatMoney(summary?.revenue || 0)}
          </p>
        </div>

        <div className="card p-5 border-red-500/30 bg-red-900/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-red-400 pointer-events-none">
            <TrendingDown className="w-16 h-16" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center text-red-400">
              <TrendingDown className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-red-100">إجمالي المصروفات</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-400 font-mono" dir="ltr">
            {formatMoney(summary?.expenses || 0)}
          </p>
        </div>

        <div className="card p-5 border-blue-500/30 bg-blue-900/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-400 pointer-events-none">
            <Wallet className="w-16 h-16" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-blue-100">صافي الأرباح</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-400 font-mono" dir="ltr">
            {formatMoney(summary?.netProfit || 0)}
          </p>
        </div>

        <div className="card p-5 border-rose-500/30 bg-rose-900/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-400 pointer-events-none">
            <SmartphoneNfc className="w-16 h-16" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-rose-900/50 flex items-center justify-center text-rose-400">
              <SmartphoneNfc className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-rose-100">رصيد فودافون كاش</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-rose-400 font-mono" dir="ltr">
            {formatMoney(summary?.vfCashBalance || 0)}
          </p>
        </div>
      </div>

      {/* Quick Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Link to="/billing/quotations" className="card p-6 flex items-center gap-4 hover:border-sira-500/50 transition-colors group cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-sira-900/30 flex items-center justify-center text-sira-400 group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-200">عروض الأسعار (Quotations)</h3>
            <p className="text-sm text-slate-400">إنشاء وطباعة عروض أسعار احترافية للعملاء.</p>
          </div>
        </Link>
        <Link to="/billing/vfcash" className="card p-6 flex items-center gap-4 hover:border-rose-500/50 transition-colors group cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-rose-900/30 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
            <SmartphoneNfc className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-200">تتبع فودافون كاش</h3>
            <p className="text-sm text-slate-400">إدارة وتسجيل حوالات فودافون كاش الواردة والصادرة.</p>
          </div>
        </Link>
      </div>
    </div>
  );
};
