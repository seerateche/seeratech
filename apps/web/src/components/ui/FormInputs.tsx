// ============================================================
// SEERA PLATFORM v4 - Mobile-safe Input Components
// Password fields show text on mobile (no accidental masking)
// ============================================================
import React, { useState, useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// ── Detect if running on a touch device ──────────────────────
const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// ── Base Input ────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label, error, icon, className = '', ...props
}) => {
  const id = useId();
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`input ${icon ? 'pr-9' : ''} ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
};

// ── Password / Code Input ─────────────────────────────────────
// On TOUCH devices: defaults to text-visible (no accidental mistakes)
// User can toggle hide. On desktop: defaults to hidden (traditional).
interface SecureInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  /** Force visible by default regardless of device */
  defaultVisible?: boolean;
}

export const SecureInput: React.FC<SecureInputProps> = ({
  label, error, defaultVisible, className = '', ...props
}) => {
  const id = useId();
  // Mobile: show by default; desktop: hide by default
  const [visible, setVisible] = useState(
    defaultVisible ?? isTouchDevice()
  );

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          // Keep inputMode numeric for voucher codes when needed
          className={`input pl-11 ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
          aria-label={visible ? 'إخفاء النص' : 'إظهار النص'}
          tabIndex={-1}
        >
          {visible
            ? <EyeOff className="w-4 h-4" />
            : <Eye    className="w-4 h-4" />
          }
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
      {/* Hint for mobile users */}
      {isTouchDevice() && !visible && (
        <p className="mt-1 text-[11px] text-slate-600">
          انقر على الأيقونة لإظهار ما كتبت
        </p>
      )}
    </div>
  );
};

// ── Voucher Code Input ────────────────────────────────────────
// Always visible, large font, numeric keyboard
export const VoucherInput: React.FC<InputProps> = ({
  label, error, className = '', ...props
}) => {
  const id = useId();
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode="text"
        className={`input font-mono text-lg tracking-widest text-slate-100
                    focus:ring-sira-500 ${error ? 'border-red-500' : ''} ${className}`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        style={{ letterSpacing: '0.15em' }}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
};
