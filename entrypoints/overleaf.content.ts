import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { EDITOR_PORT_NAME, startBridge } from '@/src/adapters/overleaf/bridge';
import { OVERLEAF_PROJECT_MATCHES, projectIdFromUrl } from '@/src/adapters/overleaf/project-url';
import { OVERLEAF } from '@/src/adapters/overleaf/selectors';
import { windowTransport } from '@/src/adapters/page/hook';
import { makeMessage } from '@/src/messaging/protocol';

/**
 * Isolated-world content script on Overleaf project pages: enables the side
 * panel for this tab and relays between the page hook and the panel.
 */
export default defineContentScript({
  matches: OVERLEAF_PROJECT_MATCHES,
  runAt: 'document_start',
  main() {
    const projectId = projectIdFromUrl(location.href);
    if (projectId === null) return;

    const bridge = startBridge({
      page: windowTransport(window),
      // The raw log Overleaf already rendered; Lemma never fetches it.
      readLog: () => {
        const nodes = document.querySelectorAll(OVERLEAF.rawLogSelector);
        const last = nodes[nodes.length - 1];
        return last?.textContent ?? null;
      },
    });
    browser.runtime.onConnect.addListener((port) => {
      if (port.name === EDITOR_PORT_NAME) bridge.connect(port);
    });
    void browser.runtime.sendMessage(makeMessage('tab/hello', { projectId }));
  },
});
