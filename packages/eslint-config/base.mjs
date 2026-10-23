import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sourceFiles = ['**/*.{js,mjs,cjs,jsx,ts,tsx}'];

export const base = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.next/**',
      '**/coverage/**',
      '**/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.min.js',
      '**/next-env.d.ts',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: sourceFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
];

export default base;
