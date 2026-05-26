// ============================================================
// SEERA PLATFORM v4 - Vite Config (Capacitor-safe)
// ============================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['android >= 5', 'chrome >= 67'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      modernPolyfills: true,
    }),
  ],

  resolve: {
    alias: {
      '@':            path.resolve(__dirname, 'src'),
      '@sira/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false, drop_debugger: true },
      format: { comments: false },
    },
    // ❌ بدون manualChunks — الـ code splitting يكسر Capacitor WebView
    // كل الكود في bundle واحد لضمان التحميل
    rollupOptions: {
      output: {
        // bundle كل شيء في ملف واحد
        inlineDynamicImports: false,
      },
    },
    // حجم تحذير مرتفع لأننا نريد bundle واحد كبير
    chunkSizeWarningLimit: 5000,
  },

  css: {
    postcss: path.resolve(__dirname, 'postcss.config.js'),
  },
});
