// ============================================================
// SEERA PLATFORM v4 - ISP Quota Tracker Page
// WE Telecom Egypt | Deep Purple/Indigo Dark Theme | RTL
// ============================================================
import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wifi, Plus, RefreshCw, AlertCircle, CheckCircle2,
  X, Phone, User, Signal, RotateCcw, Info,
} from 'lucide-react';
import { IspAccount } from '@sira/shared';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { SecureInput } from '../../components/ui/FormInputs';
import { QuotaCard }   from '../../components/isp/QuotaCard';
import toast from 'react-hot-toast';

// ── Hooks ─────────────────────────────────────────────────────

function useIspAccounts() {
  return useQuery<IspAccount[]>({
    queryKey: ['isp-accounts'],
    queryFn:  () => apiGet('/isp-tracking'),
    refetchInterval: 5 * 60_000, // auto-refresh every 5 min
  });
}

// ── Add / Edit Modal ──────────────────────────────────────────

interface AccountForm {
  accountName:  string;
  phoneNumber:  string;
  password:     string;
}

const EMPTY_FORM: AccountForm = {
  accountName:  '',
  phoneNumber:  '',
  password:     '',
};

interface ModalProps {
  mode:       'add' | 'edit';
  initial?:   Partial<AccountForm> & { id?: string };
  onSave:     (form: AccountForm, id?: string) => Promise<void>;
  onClose:    () => void;
  isSaving:   boolean;
}

const AccountModal: React.FC<ModalProps> = ({
  mode, initial, onSave, onClose, isSaving,
}) => {
  const [form, setForm] = useState<AccountForm>({
    accountName:  initial?.accountName  ?? '',
    phoneNumber:  initial?.phoneNumber  ?? '',
    password:     '',
  });
  const [errors, setErrors] = useState<Partial<AccountForm>>({});

  const validate = (): boolean => {
    const e: Partial<AccountForm> = {};
    if (!form.accountName.trim())         e.accountName  = 'اسم الحساب مطلوب';
    if (mode === 'add' || form.password) {
      if (form.phoneNumber && !/^0[2-9]\d{7,8}$/.test(form.phoneNumber.replace(/\s/g, ''))) {
        e.phoneNumber = 'يجب أن يكون رقم التليفون الأرضي 9 أو 10 أرقام شاملاً كود المحافظة';
      }
      if (!form.phoneNumber)              e.phoneNumber  = 'رقم الهاتف مطلوب';
      if (!form.password && mode === 'add') e.password   = 'كلمة المرور مطلوبة';
      if (form.password && form.password.length < 6) e.password = 'الحد الأدنى 6 أحرف';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave(form, initial?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden animate-slide-in-up"
        style={{
          background:  'linear-gradient(160deg,#1a1033 0%,#130c28 100%)',
          border:      '1px solid rgba(99,102,241,0.25)',
          boxShadow:   '0 -20px 60px rgba(99,102,241,0.15)',
          maxHeight:   '92dvh',
        }}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
            >
              WE
            </div>
            <h2 className="font-bold text-slate-100">
              {mode === 'add' ? 'إضافة حساب WE جديد' : 'تعديل الحساب'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(92dvh - 120px)' }}>

          {/* Info banner */}
          <div
            className="flex items-start gap-2 p-3 rounded-xl text-xs text-indigo-300"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-400" />
            <span>
              أدخل بيانات حساب <strong>My WE</strong> (نفس بيانات تطبيق الموبايل).
              يتم تشفير كلمة المرور بـ AES-256-GCM قبل الحفظ.
            </span>
          </div>

          {/* Account Name */}
          <div>
            <label className="input-label flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              اسم الحساب / الموقع
            </label>
            <input
              className={`input ${errors.accountName ? 'border-red-500' : ''}`}
              placeholder="مثال: كافيه العمدة - الفرع الرئيسي"
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              autoComplete="off"
            />
            {errors.accountName && (
              <p className="mt-1 text-xs text-red-400">{errors.accountName}</p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="input-label flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-indigo-400" />
              رقم الخط الأرضي
            </label>
            <input
              className={`input font-mono ${errors.phoneNumber ? 'border-red-500' : ''}`}
              placeholder="035XXXXXXX"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              disabled={mode === 'edit'}
            />
            {errors.phoneNumber ? (
              <p className="mt-1 text-xs text-red-400">{errors.phoneNumber}</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-600">
                10 أرقام — إسكندرية: 03, القاهرة: 02
              </p>
            )}
          </div>

          {/* Password */}
          <SecureInput
            label={mode === 'edit' ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء على القديمة)' : 'كلمة مرور My WE'}
            placeholder={mode === 'edit' ? 'اتركها فارغة إذا لم تتغير' : 'أدخل كلمة مرور التطبيق'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
            autoComplete="new-password"
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 mt-2 active:scale-98 transition-all"
            style={{
              background: isSaving
                ? 'rgba(99,102,241,0.35)'
                : 'linear-gradient(135deg,#6366f1,#4f46e5)',
              boxShadow: isSaving ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
            }}
          >
            {isSaving ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />جارٍ الحفظ...</>
            ) : mode === 'add' ? (
              <><Plus className="w-4 h-4" />إضافة الحساب</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" />حفظ التعديلات</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Summary Stats Row ─────────────────────────────────────────
const SummaryStats: React.FC<{ accounts: IspAccount[] }> = ({ accounts }) => {
  const total   = accounts.length;
  const active  = accounts.filter((a) => a.quotaDetails?.lineStatus?.toLowerCase().includes('active') ?? a.status === 'active').length;
  const errored = accounts.filter((a) => a.status === 'error').length;
  const totalGbUsed = accounts.reduce((s, a) => s + (a.quotaDetails?.usedGb ?? 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'إجمالي الخطوط', value: total,                     icon: Signal,        color: 'text-indigo-400', bg: 'rgba(99,102,241,0.1)' },
        { label: 'خطوط نشطة',    value: active,                     icon: CheckCircle2,  color: 'text-green-400',  bg: 'rgba(34,197,94,0.1)'  },
        { label: 'خطأ في المزامنة', value: errored,                  icon: AlertCircle,   color: 'text-red-400',    bg: 'rgba(239,68,68,0.1)'  },
        { label: 'إجمالي الاستهلاك', value: `${totalGbUsed.toFixed(1)} GB`, icon: Wifi, color: 'text-violet-400', bg: 'rgba(167,139,250,0.1)' },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-xl p-3 flex items-center gap-3"
          style={{ background: s.bg, border: '1px solid rgba(99,102,241,0.1)' }}
        >
          <s.icon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
          <div>
            <p className={`text-lg font-black font-mono leading-none ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────

export const IspQuotaView: React.FC = () => {
  const qc = useQueryClient();
  const [showModal, setShowModal]   = useState(false);
  const [editTarget, setEditTarget] = useState<IspAccount | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const { data: accounts = [], isLoading, error } = useIspAccounts();

  // ── Mutations ──────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (body: any) => apiPost('/isp-tracking', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['isp-accounts'] });
      setShowModal(false);
      toast.success('تم إضافة الحساب بنجاح ✓');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'فشلت الإضافة'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiPut(`/isp-tracking/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['isp-accounts'] });
      setEditTarget(null);
      toast.success('تم تحديث الحساب');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'فشل التعديل'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/isp-tracking/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['isp-accounts'] });
      toast.success('تم حذف الحساب');
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/isp-tracking/${id}/sync`),
    onSuccess: (res: any, id) => {
      setSyncingIds((s) => { const n = new Set(s); n.delete(id); return n; });
      qc.invalidateQueries({ queryKey: ['isp-accounts'] });
      // Be honest: if the backend fell back to demo data, say so.
      // apiPost already unwraps the envelope, so `res` is the account itself.
      const isMock = res?.quotaDetails?.isMock;
      if (isMock) {
        toast('تم عرض بيانات تجريبية — تعذّر الاتصال الفعلي بخدمة WE', {
          icon: '🧪',
          style: { background: '#78350f', color: '#fde68a', border: '1px solid #b45309' },
        });
      } else {
        toast.success('تم تحديث الكوتا ✓');
      }
    },
    onError: (e: any, id) => {
      setSyncingIds((s) => { const n = new Set(s); n.delete(id); return n; });
      toast.error(e?.response?.data?.message ?? 'فشل التحديث');
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: () => apiPost('/isp-tracking/sync-all'),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['isp-accounts'] });
      toast.success(`تمت المزامنة: ${data?.succeeded ?? 0} نجح، ${data?.failed ?? 0} فشل`);
    },
  });

  // ── Handlers ──────────────────────────────────────────────

  const handleSync = useCallback((id: string) => {
    setSyncingIds((s) => new Set(s).add(id));
    syncMutation.mutate(id);
  }, [syncMutation]);

  const handleSave = useCallback(async (form: any, id?: string) => {
    if (id) {
      const body: any = { accountName: form.accountName };
      if (form.password) body.password = form.password;
      await editMutation.mutateAsync({ id, body });
    } else {
      await addMutation.mutateAsync(form);
    }
  }, [addMutation, editMutation]);

  const handleDelete = useCallback((id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  // ── Render ────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(170deg,#160f2e 0%,#0d0818 60%,#080510 100%)' }}
      dir="rtl"
    >
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24 md:pb-5">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-base"
              style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}
            >
              WE
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-100 leading-tight">
                تتبع كوتا WE
              </h1>
              <p className="text-xs text-slate-500">WE Telecom Egypt — خطوط الإنترنت الأرضي</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {accounts.length > 0 && (
              <button
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-all active:scale-95"
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  color: '#a5b4fc',
                }}
                title="مزامنة الكل"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">مزامنة الكل</span>
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                color: 'white',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>إضافة خط</span>
            </button>
          </div>
        </div>

        {/* ── Summary stats ── */}
        {accounts.length > 0 && <SummaryStats accounts={accounts} />}

        {/* ── Loading ── */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl animate-pulse"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)' }}
              />
            ))}
          </div>
        )}

        {/* ── Error fetching list ── */}
        {error && (
          <div
            className="flex items-start gap-3 p-4 rounded-2xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">فشل تحميل الحسابات</p>
              <p className="text-xs text-red-500 mt-0.5">
                {(error as any)?.message ?? 'خطأ غير معروف'}
              </p>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && accounts.length === 0 && !error && (
          <div className="text-center py-16">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black text-white mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(124,58,237,0.15))', border: '1px dashed rgba(99,102,241,0.2)' }}
            >
              WE
            </div>
            <p className="text-slate-300 font-semibold">لا توجد حسابات WE مضافة</p>
            <p className="text-slate-600 text-sm mt-1 mb-6">
              أضف خط الإنترنت الأرضي لمتابعة الكوتا تلقائياً
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm"
              style={{
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
              }}
            >
              <Plus className="w-4 h-4" />
              إضافة أول خط
            </button>
          </div>
        )}

        {/* ── Quota Cards ── */}
        {!isLoading && accounts.length > 0 && (
          <div className="space-y-4">
            {accounts.map((account) => (
              <QuotaCard
                key={account.id}
                account={account}
                onSync={handleSync}
                onEdit={(a) => setEditTarget(a)}
                onDelete={handleDelete}
                isSyncing={syncingIds.has(account.id) || account.status === 'syncing'}
              />
            ))}
          </div>
        )}

        {/* ── Info footer ── */}
        {accounts.length > 0 && (
          <p className="text-center text-[10px] text-slate-700 pb-2">
            تتم المزامنة التلقائية كل 6 ساعات &nbsp;•&nbsp; البيانات محمية بـ AES-256-GCM
          </p>
        )}
      </div>

      {/* ── Add modal ── */}
      {showModal && (
        <AccountModal
          mode="add"
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          isSaving={addMutation.isPending}
        />
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <AccountModal
          mode="edit"
          initial={editTarget}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
          isSaving={editMutation.isPending}
        />
      )}
    </div>
  );
};
