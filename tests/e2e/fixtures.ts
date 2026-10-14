import { chromium, test as base, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../../.output/chrome-mv3');

/** A Chromium context with the built extension loaded (run `npm run build` first). */
export const test = base.extend<{
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    const id = new URL(serviceWorker.url()).host;
    await use(id);
  },
});

export const expect = test.expect;
