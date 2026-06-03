// ============================================================
// SEERA PLATFORM v4 - Root Vite Config (for Ionic Appflow)
// Appflow runs vite build from the monorepo root
// ============================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig({
  // Tell Vite where the web app source lives
  root: path.resolve(__dirname, 'apps/web'),

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
      '@':            path.resolve(__dirname, 'apps/web/src'),
      '@sira/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },

  build: {
    // Output relative to root (apps/web) → apps/web/dist
    outDir: path.resolve(__dirname, 'apps/web/dist'),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
      format:   { comments: false },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          charts:  ['recharts'],
          cap:     ['@capacitor/core'],
        },
      },
    },
  },

  css: {
    postcss: path.resolve(__dirname, 'apps/web/postcss.config.js'),
  },
});
