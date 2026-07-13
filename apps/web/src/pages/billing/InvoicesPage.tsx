import React, { useState } from 'react';
import { FileText, Plus, Search, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../utils/api';
import { AddInvoiceModal } from './AddInvoiceModal';

export const InvoicesPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ['billing', 'invoices'],
    queryFn: () => apiGet('/billing/invoices'),
  });

  const filteredInvoices = invoices.filter((inv: any) => 
    inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customerPhone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mb-1">الفواتير</h1>
          <p className="text-sm sm:text-base text-slate-400">إدارة فواتير العملاء والتحصيلات</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn-primary shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4 mr-2" />
          إنشاء فاتورة جديدة
        </button>
      </div>
      
      <div className="card flex flex-col h-full min-h-[400px]">
        <div className="p-4 border-b border-surface-2 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة، اسم العميل، أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-4 pr-10 w-full"
            />
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-surface-2 bg-surface-2/30">
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">رقم الفاتورة</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">العميل</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">المبلغ الأساسي</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">الضريبة</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">الإجمالي</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">التاريخ</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">الحالة</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">جاري التحميل...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-slate-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>لا توجد فواتير مطابقة للبحث</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-surface-2/50 hover:bg-surface-2/30 transition-colors">
                    <td className="p-4">
                      <span className="font-mono text-sira-400">{inv.invoiceNumber}</span>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-200">{inv.customerName}</div>
                      <div className="text-xs text-slate-500 mt-1">{inv.customerPhone || 'بدون رقم'}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-300">{(inv.subTotal || 0).toLocaleString('ar-EG')} ج.م</td>
                    <td className="p-4 font-mono text-slate-300">{(inv.taxAmount || 0).toLocaleString('ar-EG')} ج.م</td>
                    <td className="p-4 font-mono font-bold text-slate-200">{(inv.amount || 0).toLocaleString('ar-EG')} ج.م</td>
                    <td className="p-4 text-slate-400">
                      {new Date(inv.createdAt).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                        inv.status === 'unpaid' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {inv.status === 'paid' ? 'مدفوعة' : inv.status === 'unpaid' ? 'غير مدفوعة' : 'ملغاة'}
                      </span>
                    </td>
                    <td className="p-4 text-left">
                      <button className="btn-ghost btn-icon w-8 h-8 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && <AddInvoiceModal onClose={() => setIsAddModalOpen(false)} />}
    </div>
  );
};
