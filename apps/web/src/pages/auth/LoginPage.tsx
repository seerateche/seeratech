// ============================================================
// SEERA PLATFORM v4 - Professional Login Page
// Alexandria-themed, Trilingual (AR/EN/RU), Dark Luxury
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Mail, Building2 } from 'lucide-react';
import { SecureInput } from '../../components/ui/FormInputs';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';

// ── Animated Network Canvas ───────────────────────────────────
const ParticleCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const nodes = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2 + 0.5,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((a, i) => {
        nodes.slice(i + 1).forEach((b) => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99,102,241,${(1 - d / 130) * 0.12})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        });
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99,102,241,0.35)';
        ctx.fill();
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > canvas.width) a.vx *= -1;
        if (a.y < 0 || a.y > canvas.height) a.vy *= -1;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
};

// ── Alexandria Skyline SVG ────────────────────────────────────
const Skyline: React.FC = () => (
  <svg viewBox="0 0 1440 220" className="absolute bottom-0 left-0 right-0 w-full" preserveAspectRatio="none" style={{ zIndex: 2 }}>
    <defs>
      <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.7"/>
        <stop offset="100%" stopColor="#0a0e1a" stopOpacity="1"/>
      </linearGradient>
      <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1e293b" stopOpacity="0.85"/>
        <stop offset="100%" stopColor="#0a0e1a" stopOpacity="1"/>
      </linearGradient>
    </defs>
    {/* Sea */}
    <rect x="0" y="140" width="1440" height="80" fill="url(#bg1)"/>
    {/* Qaitbay Citadel */}
    <path d="M60,140 L60,95 L75,95 L75,75 L90,75 L90,55 L100,55 L100,75 L115,75 L115,95 L130,95 L130,140Z" fill="url(#bg2)" opacity="0.8"/>
    <path d="M85,55 L85,40 L95,40 L95,55Z" fill="url(#bg2)" opacity="0.6"/>
    {/* Library dome */}
    <ellipse cx="280" cy="100" rx="55" ry="32" fill="url(#bg2)" opacity="0.8"/>
    <rect x="230" y="100" width="100" height="40" fill="url(#bg2)"/>
    {/* Mid-city towers */}
    <path d="M400,140 L400,85 L418,85 L418,140Z" fill="url(#bg2)"/>
    <path d="M428,140 L428,65 L455,65 L455,140Z" fill="url(#bg2)"/>
    <path d="M465,140 L465,80 L488,80 L488,140Z" fill="url(#bg2)"/>
    <path d="M500,140 L500,50 L520,50 L530,38 L540,50 L560,50 L560,140Z" fill="url(#bg2)"/>
    <path d="M580,140 L580,70 L610,70 L610,140Z" fill="url(#bg2)"/>
    <path d="M625,140 L625,55 L650,55 L660,45 L670,55 L695,55 L695,140Z" fill="url(#bg2)"/>
    {/* Smouha towers */}
    <path d="M750,140 L750,60 L780,60 L780,140Z" fill="url(#bg2)"/>
    <path d="M795,140 L795,40 L820,40 L820,30 L830,22 L840,30 L840,40 L865,40 L865,140Z" fill="url(#bg2)"/>
    <path d="M880,140 L880,55 L905,55 L905,140Z" fill="url(#bg2)"/>
    {/* Mahat el Raml */}
    <path d="M960,140 L960,45 L985,45 L995,32 L1005,45 L1030,45 L1030,140Z" fill="url(#bg2)"/>
    <path d="M1045,140 L1045,65 L1070,65 L1070,140Z" fill="url(#bg2)"/>
    <path d="M1085,140 L1085,50 L1115,50 L1115,140Z" fill="url(#bg2)"/>
    {/* Agami */}
    <path d="M1160,140 L1160,70 L1190,70 L1190,140Z" fill="url(#bg2)"/>
    <path d="M1205,140 L1205,40 L1230,40 L1240,28 L1250,40 L1275,40 L1275,140Z" fill="url(#bg2)"/>
    <path d="M1295,140 L1295,55 L1320,55 L1320,140Z" fill="url(#bg2)"/>
    <path d="M1340,140 L1340,35 L1370,35 L1385,20 L1400,35 L1430,35 L1430,140Z" fill="url(#bg2)"/>
    {/* Water shimmer */}
    <path d="M0,150 Q360,160 720,148 Q1080,136 1440,150 L1440,220 L0,220Z" fill="url(#bg1)" opacity="0.5"/>
  </svg>
);

// ── Floating Feature Cards ────────────────────────────────────
const FEATURES = [
  { icon: '🖥️', en: 'Smart Dashboards', ar: 'لوحات ذكية',      x: '4%',  y: '28%', d: '0s' },
  { icon: '👆', en: 'HR / ZKTeco',      ar: 'إدارة البشرية',   x: '3%',  y: '56%', d: '0.3s' },
  { icon: '📡', en: 'MikroTik Hotspot', ar: 'التحكم بالشبكة',  x: '42%', y: '80%', d: '0.6s' },
  { icon: '📹', en: 'CCTV & DVR',       ar: 'المراقبة الأمنية', x: '80%', y: '56%', d: '0.9s' },
  { icon: '☁️', en: 'Cloud & VPN',      ar: 'أداء سحابي',      x: '83%', y: '26%', d: '1.2s' },
];

// ── Main Login Page ───────────────────────────────────────────
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '', companySlug: '' });
  
  const [mode, setMode] = useState<'company' | 'superadmin'>('company');
  const [ready, setReady] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';
  useEffect(() => { const t = setTimeout(() => setReady(true), 100); return () => clearTimeout(t); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('يرجى إدخال البيانات المطلوبة'); return; }
    try {
      await login(form.email, form.password, mode === 'company' ? form.companySlug || undefined : undefined);
      toast.success('مرحباً بك في Seera Platform ✓');
      navigate(mode === 'superadmin' ? '/god-mode' : from, { replace: true });
    } catch {}
  };

  return (
    <div className="min-h-screen overflow-hidden relative flex items-center justify-center" dir="rtl"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 55% 5%, #102040 0%, #0d1829 40%, #060a12 100%)' }}>

      {/* Stars */}
      <div className="fixed inset-0" style={{ zIndex: 0 }}>
        {Array.from({ length: 90 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: (Math.random() * 1.5 + 0.4) + 'px',
            height: (Math.random() * 1.5 + 0.4) + 'px',
            top: (Math.random() * 72) + '%',
            left: (Math.random() * 100) + '%',
            opacity: Math.random() * 0.5 + 0.1,
            animation: `twinkle ${Math.random() * 4 + 2}s ease-in-out infinite`,
            animationDelay: (Math.random() * 4) + 's',
          }}/>
        ))}
      </div>

      <ParticleCanvas />
      <Skyline />

      {/* Floating feature badges (desktop only) */}
      {FEATURES.map((f, i) => (
        <div key={i} className="absolute hidden xl:flex flex-col items-center gap-1" style={{
          left: f.x, top: f.y, zIndex: 5, pointerEvents: 'none',
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(16px)',
          transition: `opacity 0.7s ease ${f.d}, transform 0.7s ease ${f.d}`,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg,rgba(17,24,39,0.9),rgba(15,23,42,0.95))',
            border: '1px solid rgba(99,102,241,0.28)',
            boxShadow: '0 0 24px rgba(99,102,241,0.12)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>{f.icon}</div>
          <div style={{ width: 1, height: 24, background: 'linear-gradient(to bottom,rgba(99,102,241,0.5),transparent)' }}/>
          <div style={{
            padding: '3px 10px', borderRadius: 20, textAlign: 'center',
            background: 'rgba(9,14,26,0.88)', border: '1px solid rgba(99,102,241,0.2)',
            backdropFilter: 'blur(8px)',
          }}>
            <p style={{ fontSize: 10, color: '#cbd5e1', whiteSpace: 'nowrap', fontWeight: 600 }}>{f.en}</p>
            <p style={{ fontSize: 9, color: '#475569', whiteSpace: 'nowrap' }}>{f.ar}</p>
          </div>
        </div>
      ))}

      {/* ── Login Card ── */}
      <div className="relative w-full max-w-md mx-4" style={{
        zIndex: 10,
        opacity: ready ? 1 : 0,
        transform: ready ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.96)',
        transition: 'opacity 0.65s cubic-bezier(0.34,1.56,0.64,1), transform 0.65s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Card glow */}
        <div className="absolute inset-0 rounded-3xl opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(ellipse,#6366f1,transparent 70%)', transform: 'scale(1.15)' }}/>

        <div className="relative rounded-3xl overflow-hidden" style={{
          background: 'linear-gradient(160deg,rgba(16,22,36,0.97) 0%,rgba(12,18,32,0.99) 100%)',
          border: '1px solid rgba(99,102,241,0.18)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.025), inset 0 1px 0 rgba(255,255,255,0.04)',
          backdropFilter: 'blur(28px)',
        }}>
          {/* Rainbow top bar */}
          <div className="h-[2px] w-full" style={{
            background: 'linear-gradient(90deg,#6366f1,#818cf8,#a5b4fc,#818cf8,#6366f1)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 4s linear infinite',
          }}/>

          <div className="p-8 pb-6">
            {/* Logo */}
            <div className="text-center mb-7">
              <div className="inline-flex flex-col items-center gap-3">
                {/* Logo mark with orbit ring */}
                <div className="relative">
                  <div className="w-[76px] h-[76px] rounded-[22px] flex items-center justify-center" style={{
                    background: 'linear-gradient(140deg,#6366f1 0%,#4338ca 55%,#3730a3 100%)',
                    boxShadow: '0 0 48px rgba(99,102,241,0.45),0 12px 32px rgba(0,0,0,0.5)',
                  }}>
                    <span style={{ fontFamily: 'Georgia,serif', fontSize: 40, fontWeight: 900, color: 'white', letterSpacing: -2 }}>S</span>
                  </div>
                  {/* Orbit */}
                  <div className="absolute inset-[-6px] rounded-[28px]" style={{
                    border: '1px dashed rgba(99,102,241,0.3)',
                    animation: 'spin 10s linear infinite',
                  }}/>
                  {/* Orbit dot */}
                  <div className="absolute top-[-4px] right-[-4px] w-3 h-3 rounded-full bg-indigo-400"
                    style={{ boxShadow: '0 0 8px rgba(99,102,241,0.8)', animation: 'spin 10s linear infinite' }}/>
                </div>

                {/* Brand text */}
                <div>
                  <h1 style={{
                    fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 900, letterSpacing: -0.5,
                    background: 'linear-gradient(135deg,#e2e8f0 0%,#818cf8 45%,#c7d2fe 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    lineHeight: 1.15,
                  }}>Seera Platform</h1>
                  <p style={{ color: '#64748b', fontSize: 12, marginTop: 2, fontWeight: 500 }}>
                    Smart Integrated Business Solutions
                  </p>
                  <p style={{ color: 'rgba(99,102,241,0.75)', fontSize: 11, marginTop: 4, letterSpacing: 0.5 }}>
                    الإسكندرية &nbsp;•&nbsp; Alexandria &nbsp;•&nbsp; Александрия
                  </p>
                </div>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-xl p-1 mb-5" style={{
              background: 'rgba(10,14,26,0.8)',
              border: '1px solid rgba(99,102,241,0.12)',
            }}>
              {[
                { id: 'company',    ar: 'دخول الشركة',  en: 'Company Login' },
                { id: 'superadmin', ar: 'المدير العام', en: 'Super Admin' },
              ].map((m) => (
                <button key={m.id} type="button" onClick={() => setMode(m.id as any)}
                  className="flex-1 py-2.5 rounded-lg text-center transition-all duration-200"
                  style={mode === m.id ? {
                    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                  } : {}}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: mode === m.id ? 'white' : '#4b5563' }}>{m.ar}</p>
                  <p style={{ fontSize: 10, color: mode === m.id ? 'rgba(199,210,254,0.8)' : '#374151' }}>{m.en}</p>
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'company' && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{
                  background: 'rgba(10,14,26,0.75)',
                  border: '1px solid rgba(99,102,241,0.14)',
                  transition: 'border-color 0.2s',
                }}>
                  <Building2 style={{ width: 15, height: 15, color: '#818cf8', flexShrink: 0 }}/>
                  <input type="text" className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: '#e2e8f0' }}
                    placeholder="رمز الشركة / Company Slug"
                    value={form.companySlug}
                    onChange={(e) => setForm({ ...form, companySlug: e.target.value })}
                    dir="ltr"/>
                </div>
              )}

              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{
                background: 'rgba(10,14,26,0.75)', border: '1px solid rgba(99,102,241,0.14)',
              }}>
                <Mail style={{ width: 15, height: 15, color: '#818cf8', flexShrink: 0 }}/>
                <input type="email" className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: '#e2e8f0' }}
                  placeholder="البريد الإلكتروني / Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required dir="ltr" autoComplete="email"/>
              </div>

              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{
                background: 'rgba(10,14,26,0.75)', border: '1px solid rgba(99,102,241,0.14)',
              }}>
                <Lock style={{ width: 15, height: 15, color: '#818cf8', flexShrink: 0 }}/>
                <input type={showPass ? 'text' : 'password'} className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: '#e2e8f0' }}
                  placeholder="كلمة المرور / Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required autoComplete="current-password"/>
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ color: '#374151', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#6b7280'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}>
                  {showPass ? <EyeOff style={{ width: 15, height: 15 }}/> : <Eye style={{ width: 15, height: 15 }}/>}
                </button>
              </div>

              <button type="submit" disabled={isLoading} className="relative w-full py-3.5 rounded-xl font-bold text-white text-sm overflow-hidden mt-1"
                style={{
                  background: isLoading
                    ? 'rgba(79,70,229,0.35)'
                    : 'linear-gradient(135deg,#6366f1 0%,#4f46e5 50%,#4338ca 100%)',
                  boxShadow: isLoading ? 'none' : '0 6px 28px rgba(99,102,241,0.42)',
                  transition: 'all 0.2s',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}>
                {!isLoading && (
                  <div className="absolute inset-0 opacity-[0.18]" style={{
                    background: 'linear-gradient(100deg,transparent 38%,rgba(255,255,255,0.6) 50%,transparent 62%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2.5s infinite',
                  }}/>
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>جارٍ التحقق...</span></>
                  ) : (
                    <><Shield style={{ width: 15, height: 15 }}/><span>دخول آمن / Secure Login</span></>
                  )}
                </span>
              </button>
            </form>

            {/* Tech badges */}
            <div className="mt-6 pt-5 grid grid-cols-5 gap-1" style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
              {[
                { e: '🔐', l: 'AES-256' },
                { e: '📡', l: 'MikroTik' },
                { e: '📹', l: 'CCTV' },
                { e: '👆', l: 'ZKTeco' },
                { e: '🔒', l: 'WireGuard' },
              ].map((f) => (
                <div key={f.l} className="flex flex-col items-center gap-1 py-1">
                  <span style={{ fontSize: 16 }}>{f.e}</span>
                  <span style={{ fontSize: 9, color: '#374151', fontFamily: 'monospace', fontWeight: 600 }}>{f.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer bar */}
          <div className="px-8 py-3.5 text-center" style={{
            background: 'rgba(6,9,18,0.7)', borderTop: '1px solid rgba(99,102,241,0.07)',
          }}>
            <p style={{ fontSize: 10, color: '#4f46e5', fontFamily: 'monospace' }}>
              fghdhttdsffgyhd-ops.github.io/seera-alex2026
            </p>
            <p style={{ fontSize: 9, color: '#1e293b', marginTop: 3 }}>
              دعم دائم لخدمتك &nbsp;|&nbsp; Constant Technical Support &nbsp;|&nbsp; Постоянная Техническая Поддержка
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes twinkle { 0%,100%{opacity:0.1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.4)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input::placeholder { color: #374151; }
      `}</style>
    </div>
  );
};
