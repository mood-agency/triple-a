// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  ignores: [
    'dist',
    'node_modules',
    'coverage',
    'android',
    'ios',
    'build',
    'src-tauri/target/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    'tests/**',
  ],
}, {
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ['**/*.{ts,tsx,js,jsx}'],
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.es2021,
    },
  },
  rules: {
    // Errores que pueden causar problemas en producción
    'no-undef': 'off', // TypeScript ya lo maneja
    'no-unused-vars': 'off', // TypeScript ya lo maneja
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    'no-unreachable': 'error',
    'no-console': 'warn', // Advertir sobre console.log en producción

    // TypeScript
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // React (sin plugin, solo reglas básicas)
    'no-duplicate-imports': 'error',
  },
}, storybook.configs["flat/recommended"]);
