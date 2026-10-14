import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { projectIdFromUrl } from '@/src/adapters/overleaf/project-url';
import { forgetTab, setMood, think, wakeUp } from '@/src/mascot/toolbar';
import { parseMessage } from '@/src/messaging/protocol';

/**
 * The side panel is per tab and only enabled on Overleaf project pages.
 * The content script announces itself with `tab/hello`, so we never need the
 * `tabs` permission to read tab URLs. The toolbar mascot mirrors that state.
 */
export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  // Default for every tab: no panel, sleeping mascot. Overleaf tabs opt in below.
  void browser.sidePanel.setOptions({ enabled: false });
  void setMood(undefined, 'asleep');

  browser.runtime.onMessage.addListener((raw, sender) => {
    const msg = parseMessage(raw);
    if (msg === null || sender.id !== browser.runtime.id) return;
    const tabId = sender.tab?.id;
    if (msg.type === 'tab/hello' && tabId !== undefined) {
      void browser.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
      void wakeUp(tabId);
    }
    // Only Lemma's own pages (the side panel), never a content script, set the mood.
    if (msg.type === 'mascot/mood' && sender.tab === undefined) {
      const { tabId: target, mood, still } = msg.payload;
      void (mood === 'thinking' ? think(target, !still) : setMood(target, 'happy'));
    }
  });

  // A tab that navigates away from Overleaf loses its panel; if it lands on
  // another Overleaf project, that page's content script re-enables it.
  // `status: 'loading'` also fires for loads inside the page (Overleaf's PDF
  // preview, recompiles), so only sleep once the tab has left the project.
  // Host access to Overleaf exposes `tab.url` there without the `tabs`
  // permission; anywhere else it is undefined.
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && projectIdFromUrl(tab.url ?? '') === null) {
      void browser.sidePanel.setOptions({ tabId, enabled: false });
      void setMood(tabId, 'asleep');
    }
  });
  browser.tabs.onRemoved.addListener(forgetTab);

  // sidePanel.onOpened / onClosed need Chrome 141 / 142; older versions just
  // keep the awake face.
  if ('onOpened' in browser.sidePanel) {
    browser.sidePanel.onOpened.addListener(({ tabId }) => {
      if (tabId !== undefined) void setMood(tabId, 'happy');
    });
  }
  if ('onClosed' in browser.sidePanel) {
    browser.sidePanel.onClosed.addListener(({ tabId }) => {
      if (tabId === undefined) return;
      // Closing also happens when the tab leaves Overleaf; Chrome's per-tab
      // panel state (unlike our memory) survives service-worker restarts.
      void browser.sidePanel.getOptions({ tabId }).then(({ enabled }) => {
        if (enabled === true) void setMood(tabId, 'awake');
      });
    });
  }
});
