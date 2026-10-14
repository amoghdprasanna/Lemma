import type { Request } from '@playwright/test';
import { expect, test } from './fixtures';

// `chrome` exists inside the extension service worker, where `evaluate` callbacks run.
declare const chrome: typeof import('wxt/browser').browser;

const PROJECT_URL = 'https://www.overleaf.com/project/64a1f0c2e4b0a1b2c3d4e5f6';

test('side panel page renders with no network requests and no console errors', async ({
  context,
  extensionId,
}) => {
  const requests: Request[] = [];
  context.on('request', (r) => requests.push(r));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(page.getByRole('heading', { level: 1, name: 'Lemma' })).toBeVisible();
  await expect(page.getByRole('tabpanel')).toBeVisible();
  const mascot = page.getByRole('button', { name: 'Say hi to Lemma' });
  await expect(mascot).toBeVisible();
  await mascot.click();
  await expect(mascot).toHaveAttribute('data-motion', 'hop');
  await expect(mascot).not.toHaveAttribute('data-motion', 'hop', { timeout: 2000 });
  expect(errors).toEqual([]);
  const external = requests.map((r) => r.url()).filter((u) => !u.startsWith('chrome-extension://'));
  expect(external).toEqual([]);
});

test('side panel and toolbar mascot wake up on Overleaf and sleep elsewhere', async ({
  context,
  serviceWorker,
}) => {
  // Never touch live Overleaf: serve a stub page at a project URL.
  await context.route('https://www.overleaf.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Overleaf stub</title>',
    }),
  );
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Other</title>' }),
  );

  const workerErrors: string[] = [];
  serviceWorker.on('console', (m) => {
    if (m.type() === 'error') workerErrors.push(m.text());
  });

  const activeTabState = () =>
    serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tabId = tab?.id;
      if (tabId === undefined) throw new Error('no active tab');
      return {
        panel: (await chrome.sidePanel.getOptions({ tabId })).enabled,
        action: await chrome.action.isEnabled(tabId),
        title: await chrome.action.getTitle({ tabId }),
      };
    });

  const page = await context.newPage();
  await page.goto(PROJECT_URL);
  await expect
    .poll(activeTabState)
    .toEqual({ panel: true, action: true, title: 'Lemma: click to open the side panel' });

  await page.goto('https://example.com/');
  await expect.poll(activeTabState).toEqual({
    panel: false,
    action: false,
    title: 'Lemma is asleep. Open an Overleaf project to wake it up.',
  });
  expect(workerErrors).toEqual([]);
});
