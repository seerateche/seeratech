/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      'xs':  '375px',
      'sm':  '480px',
      'md':  '768px',
      'lg':  '1024px',
      'xl':  '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        sira: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe',
          300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1',
          600: '#4f46e5', 700: '#4338ca', 800: '#3730a3',
          900: '#312e81', 950: '#1e1b4b',
        },
        online: '#22c55e', offline: '#6b7280',
        error: '#ef4444', warning: '#f59e0b',
        surface: {
          DEFAULT: '#0f172a', 1: '#1e293b', 2: '#334155', 3: '#475569',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow':    '0 0 20px rgba(99,102,241,0.3)',
        'glow-sm': '0 0 10px rgba(99,102,241,0.2)',
        'card':    '0 1px 3px rgba(0,0,0,0.5)',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-in-up':    'slideInUp 0.3s ease-out',
        'fade-in':        'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideInRight: { from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        slideInUp:    { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      minHeight: { 'touch': '44px' },
      minWidth:  { 'touch': '44px' },
    },
  },
  plugins: [],
};
