import React, { useState } from 'react';
import { FileSpreadsheet, Plus, FileText, CheckCircle2, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../utils/api';
import { AddQuotationModal } from './AddQuotationModal';

export const QuotationsPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  
  const { data: quotations, isLoading } = useQuery({
    queryKey: ['billing', 'quotations'],
    queryFn: () => apiGet('/billing/quotations'),
  });

  return (
    <div className="flex-1 p-6 lg:p-8 ml-64 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">عروض الأسعار</h1>
          <p className="text-slate-400">إنشاء وإدارة عروض أسعار للعملاء</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          إنشاء عرض سعر
        </button>
      </div>
      
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-surface-2 rounded-xl w-full" />
          <div className="h-16 bg-surface-2 rounded-xl w-full" />
        </div>
      ) : quotations?.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-surface-2 border-b border-white/5">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">رقم العرض</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">العميل</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">تاريخ الإصدار</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">المبلغ الإجمالي</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {quotations.map((quote: any) => (
                  <tr key={quote.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sira-500/10 flex items-center justify-center text-sira-400">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="font-mono text-slate-200">{quote.quotationNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{quote.customerName}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(quote.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-6 py-4 text-sira-400 font-bold font-mono" dir="ltr">
                      {quote.totalAmount.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="px-6 py-4">
                      {quote.status === 'draft' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          مسودة
                        </span>
                      ) : quote.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          مقبول
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {quote.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-16 flex flex-col items-center justify-center text-slate-500">
          <FileSpreadsheet className="w-16 h-16 mb-4 opacity-20" />
          <p>لا توجد عروض أسعار حالياً.</p>
          <button onClick={() => setShowModal(true)} className="btn-secondary mt-6">إنشاء أول عرض سعر</button>
        </div>
      )}

      {showModal && <AddQuotationModal onClose={() => setShowModal(false)} />}
    </div>
  );
};
