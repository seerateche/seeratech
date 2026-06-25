// ============================================================
// SEERA PLATFORM v4 - Vite Config (Capacitor-safe)
// ============================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

// The legacy plugin runs a full Babel + core-js pass over every output
// chunk. It is only needed to support very old Android WebViews (< Android 8).
// Disabled by default (resource-heavy).
// Enable: LEGACY_BUILD=true npm run build
const enableLegacy = process.env.LEGACY_BUILD === 'true';

export default defineConfig({
  plugins: [
    // Fast React/JSX transform via esbuild (no Babel preset-env here —
    // that's redundant with plugin-legacy and extremely CPU/memory heavy)
    react(),
    ...(enableLegacy
      ? [
          legacy({
            targets: ["android >= 7", "chrome >= 70"],
            additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
            renderLegacyChunks: true,
            polyfills: true,
          }),
        ]
      : []),
  ],

  resolve: {
    alias: {
      '@':            path.resolve(__dirname, 'src'),
      '@sira/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },

  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api':     { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':      { target: 'ws://localhost:3001',   ws: true },
      '/streams': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // esbuild minify is far lighter on memory/CPU than terser and is enough
    // for production. terser was OOM-killing low-memory build environments.
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@capacitor/core'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },

  css: {
    postcss: path.resolve(__dirname, 'postcss.config.js'),
  },
});
