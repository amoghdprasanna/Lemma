import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { geminiNano } from '@/src/adapters/llm/gemini-nano';
import { EDITOR_PORT_NAME } from '@/src/adapters/overleaf/bridge';
import { projectIdFromUrl } from '@/src/adapters/overleaf/project-url';
import {
  runtimeEditorPort,
  unavailableEditorPort,
} from '@/src/adapters/overleaf/runtime-editor-port';
import { chromeStorage } from '@/src/adapters/storage/storage';
import { App } from '@/src/ui/App';
import { ControllerContext } from '@/src/ui/context';
import { PanelController } from '@/src/ui/controller/controller';
import { workerAnalyzer } from '@/src/worker/client';
import '@/src/ui/theme.css';

async function main() {
  const root = document.getElementById('root');
  if (root === null) throw new Error('Lemma: #root element missing from sidepanel.html');

  // The panel is per tab: it belongs to the tab that was active when it opened.
  // `?tab=<id>` opens it for a specific tab instead (pop-out view, e2e tests).
  const requested = Number(new URLSearchParams(location.search).get('tab'));
  const tab =
    Number.isInteger(requested) && requested > 0
      ? await browser.tabs.get(requested)
      : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  const tabId = tab?.id;
  const projectId = tab?.url ? projectIdFromUrl(tab.url) : null;

  const controller = new PanelController({
    editor:
      tabId === undefined || projectId === null
        ? unavailableEditorPort(
            'This tab is not an Overleaf project. Open a project on overleaf.com to use Lemma.',
          )
        : runtimeEditorPort(() => {
            const port = browser.tabs.connect(tabId, { name: EDITOR_PORT_NAME });
            // Reading lastError marks it handled (e.g. the page is still loading).
            port.onDisconnect.addListener(() => browser.runtime.lastError);
            return port;
          }),
    storage: chromeStorage(),
    analyzer: workerAnalyzer(),
    llm: geminiNano(),
    projectId,
  });
  window.addEventListener('unload', () => {
    controller.dispose();
  });
  void controller.start();

  createRoot(root).render(
    <StrictMode>
      <ControllerContext.Provider value={controller}>
        <App />
      </ControllerContext.Provider>
    </StrictMode>,
  );
}

void main();
