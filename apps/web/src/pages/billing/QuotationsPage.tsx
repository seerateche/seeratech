import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export const QuotationsPage: React.FC = () => {
  return (
    <div className="flex-1 p-6 lg:p-8 ml-64 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">عروض الأسعار</h1>
          <p className="text-slate-400">إنشاء وإدارة عروض أسعار للعملاء</p>
        </div>
        <button className="btn-primary">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          إنشاء عرض سعر
        </button>
      </div>
      
      <div className="card p-16 flex flex-col items-center justify-center text-slate-500">
        <FileSpreadsheet className="w-16 h-16 mb-4 opacity-20" />
        <p>لا توجد عروض أسعار حالياً.</p>
      </div>
    </div>
  );
};
