import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import { base } from './base.mjs';

export const nextjs = [
  ...base,
  ...nextVitals,
  {
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
];

export default nextjs;
