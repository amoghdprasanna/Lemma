import { defineConfig } from 'wxt';

// Extension-page CSP (side panel, background). No remote code, no outbound
// connections: see docs/adr/0004-on-device-only-ai.md. `wxt dev` needs to talk
// to its local dev server, so the strict policy is applied to builds only.
const EXTENSION_PAGES_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "connect-src 'self'",
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
      'Structure-first LaTeX assistant for Overleaf. Runs entirely in your browser; your paper never leaves it.',
    minimum_chrome_version: '116',
    permissions: ['sidePanel'],
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
