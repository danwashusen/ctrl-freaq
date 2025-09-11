// Minimal ESLint flat config (stubs). Install plugins as needed.
// npm i -D eslint @eslint/js typescript-eslint eslint-plugin-import
// For Svelte, also: eslint-plugin-svelte prettier-plugin-svelte

// @ts-check
import js from '@eslint/js';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: ['node_modules', 'dist', 'build', '.data', '.turbo', '*.min.*'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // If using project references, set project here (tsconfig paths)
        // project: ['./tsconfig.base.json'],
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
    },
  },
  // Svelte (enable once plugin is installed)
  // {
  //   files: ['**/*.svelte'],
  //   plugins: { svelte: (await import('eslint-plugin-svelte')).default },
  //   processor: 'svelte/svelte',
  // },
];

