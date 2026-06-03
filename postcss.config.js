import tailwindcss  from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss('./apps/web/tailwind.config.js'),
    autoprefixer({
      overrideBrowserslist: ['android >= 5', 'chrome >= 67'],
    }),
  ],
};
