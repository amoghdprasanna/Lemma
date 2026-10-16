// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Globals that would let code talk to the network. Only the model-server
 * adapter may, and only to the hosts ADR-0008 lists (docs/adr/0004, 0008).
 */
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport'].map(
  (name) => ({
    name,
    message:
      'Only src/adapters/llm/openai-compatible.ts makes network requests. See docs/adr/0008.',
  }),
);

/** Globals the pure core must not touch (docs/adr/0001-build-tooling.md). */
const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'chrome',
  'browser',
  'LanguageModel',
].map((name) => ({ name, message: 'src/core is pure: go through a port in src/ports.' }));

/** Imports the pure core must not make (dependency inversion). */
const CORE_IMPORT_PATTERNS = [
  {
    group: ['@/src/adapters/*', '@/src/ui/*', '@/entrypoints/*', '../adapters/*', '../ui/*'],
    message: 'src/core depends only on src/ports (dependency inversion).',
  },
  { group: ['wxt', 'wxt/*', 'react', 'react-dom'], message: 'src/core is framework-free.' },
];

export default defineConfig(
  {
    ignores: [
      '.output/',
      '.wxt/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'tests/e2e/mock-overleaf/dist/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.js', '**/*.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'entrypoints/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `onClick={() => c.closePreview()}` is idiomatic React.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: 'No network requests.' },
      ],
    },
  },
  {
    // The one file that may make requests: to a model server the user chose (ADR-0008).
    files: ['src/adapters/llm/openai-compatible.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // Pure functional core: no browser, no extension APIs, no adapters, no UI.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...BROWSER_GLOBALS],
      'no-restricted-imports': ['error', { patterns: CORE_IMPORT_PATTERNS }],
    },
  },
  {
    // Fixes never see LLM output. Flat config replaces (not merges) rule
    // options, so the core patterns are repeated here. (docs/adr/0003-no-content-generation.md).
    files: ['src/core/fixes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...CORE_IMPORT_PATTERNS,
            {
              group: ['@/src/ports/llm', '**/ports/llm', '@/src/adapters/llm/*'],
              message: 'Fix Engine must not depend on LlmPort. See ADR-003.',
            },
          ],
        },
      ],
    },
  },
);
