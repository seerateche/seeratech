import React, { useState } from 'react';
import { CreditCard, Plus, Search, MoreVertical } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../utils/api';
import { AddExpenseModal } from './AddExpenseModal';

export const ExpensesPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['billing', 'expenses'],
    queryFn: () => apiGet('/billing/expenses'),
  });

  const filteredExpenses = expenses.filter((exp: any) => 
    exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 lg:p-8 ml-64 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">المصروفات</h1>
          <p className="text-slate-400">إدارة وتسجيل مصروفات الشركة</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          تسجيل مصروف جديد
        </button>
      </div>
      
      <div className="card flex flex-col h-full min-h-[400px]">
        <div className="p-4 border-b border-surface-2 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث بوصف المصروف أو التصنيف..."
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
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">التصنيف</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">الوصف</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">المبلغ</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap">التاريخ</th>
                <th className="p-4 text-slate-400 font-medium text-sm whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">جاري التحميل...</td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-500">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>لا توجد مصروفات مسجلة</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp: any) => (
                  <tr key={exp.id} className="border-b border-surface-2/50 hover:bg-surface-2/30 transition-colors">
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-surface-2 text-slate-300">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-200">{exp.description}</td>
                    <td className="p-4 font-mono font-bold text-rose-400">{(exp.amount || 0).toLocaleString('ar-EG')} ج.م</td>
                    <td className="p-4 text-slate-400">
                      {new Date(exp.expenseDate || exp.createdAt).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' })}
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

      {isAddModalOpen && <AddExpenseModal onClose={() => setIsAddModalOpen(false)} />}
    </div>
  );
};
