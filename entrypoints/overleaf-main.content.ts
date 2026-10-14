import { defineContentScript } from 'wxt/utils/define-content-script';
import { OVERLEAF_PROJECT_MATCHES } from '@/src/adapters/overleaf/project-url';
import { startPageHook, windowTransport } from '@/src/adapters/page/hook';

/**
 * MAIN-world script (docs/adr/0002-overleaf-editor-access.md): registered in
 * the manifest so Overleaf's page CSP does not apply, and at document_start
 * so it hears Overleaf's UNSTABLE_editor:extensions event.
 */
export default defineContentScript({
  matches: OVERLEAF_PROJECT_MATCHES,
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    startPageHook({ win: window, transport: windowTransport(window) });
  },
});
