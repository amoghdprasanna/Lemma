import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { forgetTab, setMood, wakeUp } from '@/src/mascot/toolbar';
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
    const tabId = sender.tab?.id;
    if (msg?.type !== 'tab/hello' || tabId === undefined || sender.id !== browser.runtime.id) {
      return;
    }
    void browser.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
    void wakeUp(tabId);
  });

  // A tab that navigates away from Overleaf loses its panel; if it lands on
  // another Overleaf project, that page's content script re-enables it.
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
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
