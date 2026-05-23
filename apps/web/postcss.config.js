export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Target Android 5+ (Chrome 67+)
      overrideBrowserslist: [
        'android >= 5',
        'chrome >= 67',
        'ios_saf >= 12',
        'last 2 versions',
        'not dead',
      ],
    },
  },
};
