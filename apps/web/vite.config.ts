// ============================================================
// SEERA PLATFORM v4 - Vite Config (Mobile + Capacitor ready)
// ============================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isCapacitor = process.env.CAPACITOR_BUILD === 'true';

  return {
    plugins: [
      react({
        // Babel config inline — handles optional chaining, nullish
        // coalescing, class properties for older Android WebViews
        babel: {
          plugins: [],
          presets: [
            ['@babel/preset-env', {
              targets: {
                android: '5.0',
                chrome: '67',
              },
              useBuiltIns: 'usage',
              corejs: 3,
              bugfixes: true,
            }],
          ],
        },
      }),
      // Generates a <nomodule> legacy bundle for Android < 7 WebView
      legacy({
        targets: ['android >= 5', 'chrome >= 67'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        renderLegacyChunks: true,
        polyfills: [
          'es.symbol',
          'es.array.filter',
          'es.promise',
          'es.promise.finally',
          'es/map',
          'es/set',
          'es.array.for-each',
          'es.object.define-properties',
          'es.object.define-property',
          'es.object.get-own-property-descriptor',
          'es.object.get-own-property-descriptors',
          'es.object.keys',
          'es.object.to-string',
          'web.dom-collections.for-each',
          'esnext.global-this',
          'esnext.string.match-all',
        ],
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@sira/shared': path.resolve(__dirname, '../../packages/shared/src'),
      },
    },

    // Dev server — proxy to NestJS (not used in Capacitor production)
    server: {
      port: 5173,
      host: true, // expose to LAN for mobile testing
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        '/ws':  { target: 'ws://localhost:3001',   ws: true },
        '/streams': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      // Capacitor build: no code splitting for WebView compatibility
      ...(isCapacitor ? {} : {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              charts:  ['recharts'],
              socket:  ['socket.io-client'],
            },
          },
        },
      }),
      // Minify with terser for better Android compatibility than esbuild
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
          // Keep class names for React DevTools in dev
          keep_classnames: mode !== 'production',
        },
        format: {
          comments: false,
        },
      },
      // Lower chunk size warning to catch large bundles early
      chunkSizeWarningLimit: 1000,
    },

    // Ensure env vars are available
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },

    // CSS
    css: {
      postcss: './postcss.config.js',
    },
  };
});
