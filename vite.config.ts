// Root vite.config.ts — delegates to apps/web/vite.config.ts
// Appflow uses this when building from monorepo root
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig({
  root: 'apps/web',
  plugins: [
    react(),
    legacy({
      targets: ['android >= 5', 'chrome >= 67'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src'),
      '@sira/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'apps/web/dist'),
    emptyOutDir: true,
    minify: 'terser',
  },
});
