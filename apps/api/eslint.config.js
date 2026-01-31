import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Errores que pueden causar problemas en producción
      'no-undef': 'error',                    // Variables no definidas
      'no-unused-vars': ['error', {           // Variables declaradas pero no usadas
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-unreachable': 'error',              // Código inalcanzable
      'no-console': 'off',                     // Permitir console.log en API
      'no-constant-condition': 'error',       // if(true), while(true), etc.
      'no-duplicate-imports': 'error',        // Imports duplicados
      'no-self-assign': 'error',              // x = x
      'no-template-curly-in-string': 'warn',  // "${foo}" en string normal

      // Mejores prácticas
      'eqeqeq': ['error', 'always'],          // Usar === y !== siempre
      'no-eval': 'error',                     // No usar eval()
      'no-implied-eval': 'error',             // No setTimeout("code", 100)
      'no-var': 'error',                      // Usar let/const, no var
      'prefer-const': 'error',                // const cuando no se reasigna
      'no-empty': 'error',                    // Bloques vacíos
      'no-extra-boolean-cast': 'error',       // !!true

      // Promesas y async
      'no-async-promise-executor': 'error',   // new Promise(async () => {})
      'require-atomic-updates': 'error',      // Race conditions con await
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
];
