import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Mirrors the rules the old craco.config.js enabled
// (react-hooks/rules-of-hooks: error, react-hooks/exhaustive-deps: warn).
export default [
  { ignores: ['build/**', 'dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      // CRA's eslint-config-react-app reported unused vars as warnings.
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['*.config.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
];
