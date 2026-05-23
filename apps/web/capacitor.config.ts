// ============================================================
// SEERA PLATFORM v4 - Capacitor Configuration
// ============================================================
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Unique app identifier (reverse-domain format)
  appId: 'io.seera.platform.v4',
  appName: 'Seera Platform',

  // Points to Vite's build output
  webDir: 'dist',

  // ── Server ───────────────────────────────────────────────
  server: {
    // In development: point to your live dev server so you get
    // hot-reload on the Android device.
    // Comment out / set allowNavigation for production APK.
    // url: 'http://192.168.1.x:5173',

    // Allow the WebView to navigate to your API domain
    allowNavigation: [
      'localhost',
      '10.0.2.2',    // Android emulator localhost alias
      '192.168.*.*', // LAN
      '*.seera.local',
    ],

    // Android: use cleartext (HTTP) in debug builds only.
    // Production builds should use HTTPS.
    androidScheme: 'https',

    // Override the hostname used inside the WebView
    hostname: 'seera.app',

    // Enable error logging overlay in debug
    errorPathHandling: 'auto',
  },

  // ── Android specific ──────────────────────────────────────
  android: {
    // Minimum SDK 22 (Android 5.1) — covers 99%+ of devices
    minWebViewVersion: 60,

    // Allow HTTP traffic (needed for local API in dev)
    allowMixedContent: true,

    // Keyboard behavior: 'native' resizes the WebView when
    // the soft keyboard opens, preventing input overlap
    resizeOnKeyboardShow: true,

    // Prevent white flash on launch
    backgroundColor: '#0f172a',

    // Use the default back button handler
    captureInput: false,
  },

  // ── Plugins ───────────────────────────────────────────────
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
  },
};

export default config;
