import React from 'react';
import { FileText } from 'lucide-react';

export const InvoicesPage: React.FC = () => {
  return (
    <div className="flex-1 p-6 lg:p-8 ml-64 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">الفواتير</h1>
          <p className="text-slate-400">إدارة فواتير العملاء والتحصيلات</p>
        </div>
        <button className="btn-primary">
          <FileText className="w-4 h-4 mr-2" />
          إنشاء فاتورة جديدة
        </button>
      </div>
      
      <div className="card p-16 flex flex-col items-center justify-center text-slate-500">
        <FileText className="w-16 h-16 mb-4 opacity-20" />
        <p>لا توجد فواتير مسجلة حتى الآن.</p>
        <p className="text-sm mt-2">سيتم إضافة الفواتير هنا قريباً.</p>
      </div>
    </div>
  );
};
