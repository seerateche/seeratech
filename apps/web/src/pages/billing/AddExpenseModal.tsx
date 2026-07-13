import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../../utils/api';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

const EXPENSE_CATEGORIES = [
  'رواتب وأجور',
  'إيجار ومرافق',
  'صيانة وإصلاح',
  'معدات وأجهزة',
  'تسويق وإعلان',
  'ضيافة ونثريات',
  'أخرى'
];

export const AddExpenseModal: React.FC<Props> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => apiPost('/billing/expenses', data),
    onSuccess: () => {
      toast.success('تم تسجيل المصروف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['billing', 'expenses'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء التسجيل');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || amount <= 0 || !description) {
      toast.error('يرجى تعبئة الحقول المطلوبة');
      return;
    }
    mutation.mutate({
      category,
      amount: Number(amount),
      description,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-1 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-surface-2 shrink-0">
          <h2 className="text-xl font-bold text-slate-100">تسجيل مصروف جديد</h2>
          <button onClick={onClose} className="btn-ghost btn-icon" disabled={mutation.isPending}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="expense-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">تصنيف المصروف *</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">المبلغ (ج.م) *</label>
              <input
                type="number"
                required
                min="1"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="input-field"
                placeholder="مثال: 500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">وصف المصروف *</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field min-h-[100px] resize-y"
                placeholder="اكتب تفاصيل المصروف هنا..."
              />
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
            form="expense-form"
            className="btn-primary flex-1 bg-rose-500 hover:bg-rose-600 text-white"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'جاري الحفظ...' : 'تسجيل المصروف'}
          </button>
        </div>
      </div>
    </div>
  );
};
