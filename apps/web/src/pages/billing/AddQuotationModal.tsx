import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../../../utils/api';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

interface Item {
  name: string;
  quantity: number;
  unitPrice: number;
}

export const AddQuotationModal: React.FC<Props> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: 1, unitPrice: 0 }]);

  const mutation = useMutation({
    mutationFn: (data: any) => apiPost('/billing/quotations', data),
    onSuccess: () => {
      toast.success('تم إنشاء عرض السعر بنجاح');
      queryClient.invalidateQueries({ queryKey: ['billing', 'quotations'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء الإنشاء');
    },
  });

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof Item, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || items.some(i => !i.name || i.quantity <= 0)) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    mutation.mutate({
      customerName,
      customerPhone,
      validUntil: validUntil || undefined,
      notes,
      items: items.map(i => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))
    });
  };

  const total = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-surface-1 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-surface-2 shrink-0">
          <h2 className="text-xl font-bold text-slate-100">إنشاء عرض سعر جديد</h2>
          <button onClick={onClose} className="btn-ghost btn-icon" disabled={mutation.isPending}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="quote-form" onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="اختياري"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">صالح حتى تاريخ</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-200">المنتجات / الخدمات *</h3>
                <button type="button" onClick={addItem} className="btn-secondary btn-sm gap-2">
                  <Plus className="w-4 h-4" />
                  إضافة عنصر
                </button>
              </div>
              
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start bg-surface-2/30 p-3 rounded-lg border border-surface-2">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        placeholder="اسم الصنف"
                        required
                        value={item.name}
                        onChange={(e) => updateItem(idx, 'name', e.target.value)}
                        className="input-field bg-surface-1"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className="input-field bg-surface-1 text-center"
                        dir="ltr"
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                        className="input-field bg-surface-1 text-left"
                        dir="ltr"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={() => removeItem(idx)} 
                      className={`btn-icon mt-1 ${items.length === 1 ? 'opacity-50 cursor-not-allowed text-slate-500' : 'text-red-400 hover:bg-red-400/10'}`}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center bg-sira-500/10 p-3 rounded-lg border border-sira-500/20 text-sira-400">
                <span className="font-medium">الإجمالي:</span>
                <span className="text-lg font-bold font-mono" dir="ltr">{total.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">ملاحظات (شروط الدفع مثلاً)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field min-h-[80px]"
                placeholder="اختياري..."
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-surface-2 bg-surface-1/50 shrink-0 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={mutation.isPending}>
            إلغاء
          </button>
          <button type="submit" form="quote-form" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'جاري الإنشاء...' : 'حفظ عرض السعر'}
          </button>
        </div>
      </div>
    </div>
  );
};
