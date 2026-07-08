import React from 'react';
import { TrendingDown } from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  return (
    <div className="flex-1 p-6 lg:p-8 ml-64 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">المصروفات</h1>
          <p className="text-slate-400">إدارة منصرفات الشركة والشبكة</p>
        </div>
        <button className="btn-secondary">
          <TrendingDown className="w-4 h-4 mr-2 text-red-400" />
          تسجيل منصرف جديد
        </button>
      </div>
      
      <div className="card p-16 flex flex-col items-center justify-center text-slate-500">
        <TrendingDown className="w-16 h-16 mb-4 opacity-20 text-red-400" />
        <p>لا توجد منصرفات مسجلة.</p>
      </div>
    </div>
  );
};
