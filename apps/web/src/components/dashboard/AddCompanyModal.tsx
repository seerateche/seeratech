import React, { useState } from 'react';
import { X, Building2, Globe, Mail, Phone, Hash } from 'lucide-react';
import { apiPost } from '../../utils/api';
import toast from 'react-hot-toast';

interface AddCompanyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCompanyModal: React.FC<AddCompanyModalProps> = ({ onClose, onSuccess }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    country: 'Egypt',
    city: '',
    contactEmail: '',
    contactPhone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await apiPost('/admin/companies', form);
      toast.success('تم إضافة الشركة بنجاح');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء إضافة الشركة');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" dir="rtl">
      <div className="bg-surface border border-surface-2 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-2 bg-surface-1">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Building2 className="w-5 h-5 text-sira-400" />
            <span>إضافة شركة جديدة</span>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">اسم الشركة <span className="text-red-400">*</span></label>
            <div className="relative">
              <Building2 className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                className="input pl-3 pr-10"
                placeholder="مثال: شبكة النور"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">المعرف الفريد (Slug) <span className="text-red-400">*</span></label>
            <div className="relative">
              <Hash className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                className="input pl-3 pr-10 text-left"
                dir="ltr"
                placeholder="alnoor-isp"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">يستخدم لتسجيل دخول الموظفين (حروف إنجليزية وأرقام فقط)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">الدولة <span className="text-red-400">*</span></label>
              <div className="relative">
                <Globe className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  className="input pl-3 pr-10"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">المدينة <span className="text-red-400">*</span></label>
              <input
                type="text"
                required
                className="input"
                placeholder="مثال: الإسكندرية"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">البريد الإلكتروني <span className="text-red-400">*</span></label>
            <div className="relative">
              <Mail className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                className="input pl-3 pr-10 text-left"
                dir="ltr"
                placeholder="admin@example.com"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">رقم الهاتف</label>
            <div className="relative">
              <Phone className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="tel"
                className="input pl-3 pr-10 text-left"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-surface-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn-ghost"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? 'جاري الحفظ...' : 'حفظ الشركة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
