export default {
  plugins: {
    tailwindcss:  { config: './apps/web/tailwind.config.js' },
    autoprefixer: {
      overrideBrowserslist: ['android >= 5', 'chrome >= 67', 'ios_saf >= 12'],
    },
  },
};
