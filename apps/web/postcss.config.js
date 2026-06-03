import tailwindcss  from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss('./tailwind.config.js'),
    autoprefixer({
      overrideBrowserslist: [
        'android >= 5',
        'chrome >= 67',
        'ios_saf >= 12',
        'last 2 versions',
        'not dead',
      ],
    }),
  ],
};
