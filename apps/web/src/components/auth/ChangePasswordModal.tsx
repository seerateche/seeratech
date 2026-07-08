import React, { useState } from 'react';
import { X, Lock, KeyRound } from 'lucide-react';
import { apiPost } from '../../utils/api';
import toast from 'react-hot-toast';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.newPassword.length < 6) {
      toast.error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    
    if (form.newPassword !== form.confirmPassword) {
      toast.error('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }

    try {
      setIsSaving(true);
      await apiPost('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('تم تغيير كلمة المرور بنجاح');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-fade-in" dir="rtl">
      <div className="bg-surface border border-surface-2 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-2 bg-surface-1">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Lock className="w-5 h-5 text-sira-400" />
            <span>تغيير كلمة المرور</span>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">كلمة المرور الحالية <span className="text-red-400">*</span></label>
            <div className="relative">
              <KeyRound className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                className="input pl-3 pr-10 text-left"
                dir="ltr"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">كلمة المرور الجديدة <span className="text-red-400">*</span></label>
            <div className="relative">
              <Lock className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                className="input pl-3 pr-10 text-left"
                dir="ltr"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">تأكيد كلمة المرور <span className="text-red-400">*</span></label>
            <div className="relative">
              <Lock className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                className="input pl-3 pr-10 text-left"
                dir="ltr"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
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
              {isSaving ? 'جاري الحفظ...' : 'تغيير'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
