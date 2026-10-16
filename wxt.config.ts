import { defineConfig } from 'wxt';

/**
 * Model servers Lemma may reach, and only after the user connects one
 * (docs/adr/0008-ai-backends.md). Mirrors checkServerUrl in src/core/llm/backend.ts.
 */
const MODEL_SERVERS = [
  'http://localhost:*',
  'https://localhost:*',
  'http://127.0.0.1:*',
  'https://127.0.0.1:*',
  'https://openrouter.ai',
];

// Extension-page CSP (side panel, background). No remote code, and no outbound
// connections except to a model server: see docs/adr/0004 and 0008. `wxt dev`
// needs to talk to its local dev server, so the policy is applied to builds only.
const EXTENSION_PAGES_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  `connect-src 'self' ${MODEL_SERVERS.join(' ')}`,
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Explicit imports only: keeps the dependency graph visible to ESLint's
  // layering rules and to readers.
  imports: false,
  manifest: ({ command }) => ({
    name: 'Lemma',
    description:
      'Structure-first LaTeX assistant for Overleaf. Your paper stays on your computer unless you pick a remote AI model.',
    minimum_chrome_version: '116',
    permissions: ['sidePanel', 'storage'],
    // Only to read which Overleaf project a tab shows; no other site is touched.
    host_permissions: ['https://*.overleaf.com/*'],
    // Requested only when the user connects a model server (ADR-0008).
    optional_host_permissions: [
      'http://localhost/*',
      'https://localhost/*',
      'http://127.0.0.1/*',
      'https://127.0.0.1/*',
      'https://openrouter.ai/*',
    ],
    action: {
      default_title: 'Open Lemma',
      // Packaged faces come from `npm run icons`; the background swaps faces live per tab.
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' },
    },
    ...(command === 'build'
      ? { content_security_policy: { extension_pages: EXTENSION_PAGES_CSP } }
      : {}),
  }),
});
