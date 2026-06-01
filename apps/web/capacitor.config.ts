import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'io.seera.platform.v4',
  appName: 'Seera Platform',
  webDir:  'dist',

  server: {
    // 'https' scheme = secure context inside WebView (recommended)
    androidScheme: 'https',

    // Allow WebView to reach backend API host(s)
    allowNavigation: [
      'localhost',
      '10.0.2.2',        // Android emulator → host machine
      '192.168.*.*',     // LAN testing
      '*.seera.local',
      // 'api.yourdomain.com', // ← add production API domain here
    ],

    // Dev: point WebView at live dev server for hot-reload
    // url: 'http://192.168.1.x:5173',
  },

  android: {
    backgroundColor:   '#0f172a',
    allowMixedContent: true,      // allow HTTP API in debug builds
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide:     true,
      backgroundColor:    '#0f172a',
      showSpinner:        false,
      splashFullScreen:   true,
      splashImmersive:    true,
    },
    StatusBar: {
      style:           'DARK',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
