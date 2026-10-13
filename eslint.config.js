import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'data/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 10],
      'max-params': ['warn', 7],
    },
  },
  {
    files: ['**/*.tsx'],
    rules: { 'max-lines-per-function': ['warn', { max: 120, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['**/test/**', '**/*.test.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
);
