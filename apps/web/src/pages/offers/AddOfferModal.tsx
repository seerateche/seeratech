import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../../utils/api';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export const AddOfferModal: React.FC<Props> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [speed, setSpeed] = useState('');
  const [quota, setQuota] = useState('');
  const [durationDays, setDurationDays] = useState<number>(30);

  const mutation = useMutation({
    mutationFn: (data: any) => apiPost('/billing/offers', data),
    onSuccess: () => {
      toast.success('تم إنشاء العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['billing', 'offers'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء الإنشاء');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price <= 0) {
      toast.error('يرجى تعبئة الحقول المطلوبة');
      return;
    }
    mutation.mutate({
      name,
      price: Number(price),
      speed: speed || undefined,
      quota: quota || undefined,
      durationDays: Number(durationDays),
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-surface-1 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-surface-2 shrink-0">
          <h2 className="text-xl font-bold text-slate-100">إضافة عرض اشتراك جديد</h2>
          <button onClick={onClose} className="btn-ghost btn-icon" disabled={mutation.isPending}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="offer-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">اسم العرض *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="مثال: عرض الصيف 30 ميجا"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">السعر (ج.م) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={price || ''}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="input-field"
                  placeholder="مثال: 150"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">مدة الاشتراك (بالأيام)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">السرعة (اختياري)</label>
                <input
                  type="text"
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  className="input-field"
                  placeholder="مثال: 30 Mbps"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">سعة التحميل (اختياري)</label>
                <input
                  type="text"
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  className="input-field"
                  placeholder="مثال: 140 GB"
                />
              </div>
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
            form="offer-form"
            className="btn-primary flex-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'جاري الحفظ...' : 'حفظ العرض'}
          </button>
        </div>
      </div>
    </div>
  );
};
