import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../../utils/api';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export const AddInvoiceModal: React.FC<Props> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [subTotal, setSubTotal] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const total = Number(subTotal) + Number(taxAmount);

  const mutation = useMutation({
    mutationFn: (data: any) => apiPost('/billing/invoices', data),
    onSuccess: () => {
      toast.success('تم إنشاء الفاتورة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء الإنشاء');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || subTotal <= 0) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    mutation.mutate({
      customerName,
      customerPhone,
      subTotal: Number(subTotal),
      taxAmount: Number(taxAmount),
      amount: total,
      dueDate: dueDate || undefined,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-surface-1 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-surface-2 shrink-0">
          <h2 className="text-xl font-bold text-slate-100">إنشاء فاتورة جديدة</h2>
          <button onClick={onClose} className="btn-ghost btn-icon" disabled={mutation.isPending}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">اسم العميل *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="input-field"
                  placeholder="أدخل اسم العميل"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">رقم الهاتف</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="input-field"
                  placeholder="01xxxxxxxxx"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">المبلغ قبل الضريبة (ج.م) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={subTotal || ''}
                  onChange={(e) => setSubTotal(Number(e.target.value))}
                  className="input-field"
                  placeholder="مثال: 1000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">القيمة الضريبية (ج.م)</label>
                <input
                  type="number"
                  min="0"
                  value={taxAmount || ''}
                  onChange={(e) => setTaxAmount(Number(e.target.value))}
                  className="input-field"
                  placeholder="مثال: 140"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">تاريخ الاستحقاق</label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input-field pr-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">ملاحظات (اختياري)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field min-h-[100px] resize-y"
                placeholder="أي تفاصيل إضافية..."
              />
            </div>
            
            <div className="bg-surface-2/50 rounded-xl p-4 flex items-center justify-between">
              <span className="text-slate-300 font-medium">المبلغ الإجمالي المستحق:</span>
              <span className="text-2xl font-bold text-sira-400 font-mono" dir="ltr">
                {total.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-surface-2 shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={mutation.isPending}
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="invoice-form"
            className="btn-primary flex-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'جاري الحفظ...' : 'إنشاء وحفظ الفاتورة'}
          </button>
        </div>
      </div>
    </div>
  );
};
