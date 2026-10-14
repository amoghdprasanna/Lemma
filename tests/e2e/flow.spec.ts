import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

declare const chrome: typeof import('wxt/browser').browser;

const PROJECT_URL = 'https://www.overleaf.com/project/64a1f0c2e4b0a1b2c3d4e5f6';
const MOCK_JS = path.join(import.meta.dirname, 'mock-overleaf/dist/mock.js');

const DOC = String.raw`\documentclass{article}
\usepackage{amsmath}
\begin{document}
\section{Introduction}
Some context for the reader.
\section{Results}
The energy is
$$ E = mc^2 $$
as expected.
\bibliography{refs}
\end{document}
`;

const LOG = String.raw`(./main.tex
! Undefined control sequence.
l.12 The state \kett
                    {\psi}
`;

const HTML = `<!doctype html><html><head><title>Mock Overleaf</title></head><body>
<div id="editor"></div>
<script type="text/plain" id="initial-doc">${DOC}</script>
<div class="logs-pane-content"><pre class="log-entry-content-raw">${LOG}</pre></div>
<script src="/__mock/mock.js"></script>
</body></html>`;

async function openProject(context: import('@playwright/test').BrowserContext): Promise<Page> {
  await context.route('https://www.overleaf.com/__mock/mock.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: readFileSync(MOCK_JS, 'utf8') }),
  );
  await context.route('https://www.overleaf.com/project/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: HTML }),
  );
  const page = await context.newPage();
  await page.goto(PROJECT_URL);
  await page.waitForFunction(() => typeof window.mock !== 'undefined');
  return page;
}

test('reads the editor, previews and applies a fix that Overleaf undo reverts', async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  const external: string[] = [];
  context.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith('chrome-extension://') && !url.startsWith('https://www.overleaf.com/')) {
      external.push(url);
    }
  });

  const page = await openProject(context);
  const tabId = await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id ?? -1;
  });
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${String(tabId)}`);

  await expect(panel.getByText('main.tex')).toBeVisible();
  const fix = panel.getByRole('button', { name: 'Replace $$…$$ with \\[…\\]' });
  await expect(fix).toBeVisible();

  // Preview first: nothing changes until Apply.
  await fix.click();
  const dialog = panel.getByRole('dialog');
  await expect(dialog).toContainText('\\[ E = mc^2 \\]');
  expect(await page.evaluate(() => window.mock.text())).toContain('$$ E = mc^2 $$');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.mock.text())).toContain('\\[ E = mc^2 \\]');

  // One Overleaf undo step reverts the whole fix.
  await page.evaluate(() => window.mock.undo());
  expect(await page.evaluate(() => window.mock.text())).toContain('$$ E = mc^2 $$');

  // The panel follows the document again.
  await expect(panel.getByRole('button', { name: 'Replace $$…$$ with \\[…\\]' })).toBeVisible();

  expect(external).toEqual([]);
});

test('shows the outline, translates the compile log and opens learning cards', async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  await openProject(context);
  const tabId = await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id ?? -1;
  });
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${String(tabId)}`);
  await expect(panel.getByText('main.tex')).toBeVisible();

  await panel.getByRole('tab', { name: 'Outline' }).click();
  const outline = panel.getByRole('list', { name: 'Paper outline' });
  await expect(outline).toContainText('Introduction');
  await expect(outline).toContainText('Results');

  await panel.getByRole('tab', { name: 'Log' }).click();
  await panel.getByRole('button', { name: 'Read log from Overleaf' }).click();
  await expect(panel.getByText('Unknown command \\kett')).toBeVisible();

  // Keyboard navigation between tabs.
  await panel.getByRole('tab', { name: 'Log' }).focus();
  await panel.keyboard.press('ArrowRight');
  await expect(panel.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await panel.getByRole('tab', { name: 'Learn' }).click();
  await panel.getByRole('button', { name: /^Notes/ }).click();
  await panel.getByRole('button', { name: /Avoid \$\$…\$\$/ }).click();
  await expect(panel.getByRole('heading', { name: 'Avoid $$…$$' })).toBeVisible();
});
