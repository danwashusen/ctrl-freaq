import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import security from 'eslint-plugin-security';
import yml from 'eslint-plugin-yml';
import yamlParser from 'yaml-eslint-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolvePath = (...segments) => join(__dirname, ...segments);

export default [
  js.configs.recommended,
  {
    ignores: [
      '**/*.d.ts',
      '**/dist/**',
      '**/build/**',
      '**/*.js.map',
      '**/*.d.ts.map',
      'node_modules/**',
      'docs/examples/**',
      'specs/**',
      '.bmad-core/**',
      'packages/shared-data/src/**/*.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.es2022,
        ...globals.node,
      },
    },
    ignores: ['docs/examples/**'],
    plugins: {
      '@typescript-eslint': typescript,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: [
            resolvePath('tsconfig.json'),
            resolvePath('apps/*/tsconfig.json'),
            resolvePath('packages/*/tsconfig.json'),
          ],
        },
        node: true,
      },
    },
    rules: {
      // TypeScript rules
      'no-unused-vars': 'off', // Turn off base rule
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          args: 'after-used',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Import rules
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',

      // Basic rules
      'no-console': 'warn',
      // TS handles undefined identifiers/types; avoid false positives
      'no-undef': 'off',
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: [
      '**/cli.ts',
      '**/src/cli.ts',
      '**/bin/**',
      '**/migrate.ts',
      '**/src/migrate.ts',
      'apps/api/src/index.ts',
    ],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        project: [resolvePath('apps/web/tsconfig.json')],
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          project: [resolvePath('apps/web/tsconfig.json')],
        },
        node: true,
      },
    },
    rules: {
      // React & Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Accessibility (basic set)
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      // Import checks re-enabled with TS resolver
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',
    },
  },
  // Allow console in web logger implementation (browser-side logging)
  {
    files: ['apps/web/src/lib/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: [
      'packages/editor-core/**/*.{ts,tsx,js,jsx}',
      'packages/editor-persistence/**/*.{ts,tsx,js,jsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        project: [
          resolvePath('packages/editor-core/tsconfig.json'),
          resolvePath('packages/editor-persistence/tsconfig.json'),
        ],
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      import: importPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          project: [
            resolvePath('packages/editor-core/tsconfig.json'),
            resolvePath('packages/editor-persistence/tsconfig.json'),
          ],
        },
        node: true,
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',
    },
  },
  {
    files: ['apps/api/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    ignores: [
      'packages/editor-core/**/*.{ts,tsx,js,jsx}',
      'packages/editor-persistence/**/*.{ts,tsx,js,jsx}',
    ],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: { security, '@typescript-eslint': typescript },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          args: 'none', // Don't check unused parameters in function signatures
        },
      ],
      // Basic security checks
      'security/detect-object-injection': 'warn',
      'security/detect-unsafe-regex': 'warn',
    },
  },
  // Node env for config and scripts
  {
    files: [
      '**/tailwind.config.{js,ts}',
      'scripts/**/*.{js,ts,mjs,cjs}',
      '**/scripts/**/*.{js,ts,mjs,cjs}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  // YAML linting via ESLint
  {
    files: ['**/*.{yml,yaml}'],
    ignores: ['.bmad-core/**', '.specify/**'],
    languageOptions: {
      parser: yamlParser,
    },
    plugins: { yml },
    rules: {
      'yml/no-empty-document': 'error',
      'yml/indent': ['error', 2],
      'yml/quotes': ['error', { prefer: 'single', avoidEscape: true }],
      'yml/no-irregular-whitespace': 'error',
    },
  },
  prettier,
];
