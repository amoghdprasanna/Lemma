import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { OVERLEAF_PROJECT_MATCHES, projectIdFromUrl } from '@/src/adapters/overleaf/project-url';
import { makeMessage } from '@/src/messaging/protocol';

/**
 * Isolated-world content script on Overleaf project pages. Phase 0: tells the
 * background that this tab may show the side panel. Phase 1 adds the bridge to
 * the MAIN-world CodeMirror hook.
 */
export default defineContentScript({
  matches: OVERLEAF_PROJECT_MATCHES,
  runAt: 'document_idle',
  main() {
    const projectId = projectIdFromUrl(location.href);
    if (projectId === null) return;
    void browser.runtime.sendMessage(makeMessage('tab/hello', { projectId }));
  },
});
