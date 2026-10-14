import { browser } from 'wxt/browser';
import { rasterize, type Expression } from './sprite';

/**
 * The toolbar icon is the mascot, and its face tracks the tab:
 * - asleep: not an Overleaf project (action disabled, so Chrome also greys it)
 * - awake:  an Overleaf project; clicking opens the side panel
 * - happy:  the side panel is open on this tab
 */
export type Mood = 'asleep' | 'awake' | 'happy';

const TITLES: Record<Mood, string> = {
  asleep: 'Lemma is asleep. Open an Overleaf project to wake it up.',
  awake: 'Lemma: click to open the side panel',
  happy: 'Lemma: side panel open',
};

/** Toolbar icons are 16 dip; 32 covers high-DPI screens. */
const TOOLBAR_SIZES = [16, 32] as const;

const imageCache = new Map<Expression, Record<number, ImageData>>();

function imageData(expression: Expression): Record<number, ImageData> {
  let images = imageCache.get(expression);
  if (images === undefined) {
    images = Object.fromEntries(
      TOOLBAR_SIZES.map((size) => [size, new ImageData(rasterize(expression, size), size, size)]),
    );
    imageCache.set(expression, images);
  }
  return images;
}

// Bumped on every mood change so a running animation stops if the tab moves on.
const generations = new Map<number | undefined, number>();

function nextGeneration(tabId: number | undefined): number {
  const generation = (generations.get(tabId) ?? 0) + 1;
  generations.set(tabId, generation);
  return generation;
}

async function showFace(tabId: number | undefined, expression: Expression): Promise<void> {
  await browser.action.setIcon(
    tabId === undefined
      ? { imageData: imageData(expression) }
      : { tabId, imageData: imageData(expression) },
  );
}

/** Sets the face, tooltip and enabled state for one tab, or the default when tabId is undefined. */
export async function setMood(tabId: number | undefined, mood: Mood): Promise<void> {
  nextGeneration(tabId);
  await Promise.all([
    showFace(tabId, mood),
    browser.action.setTitle(
      tabId === undefined ? { title: TITLES[mood] } : { tabId, title: TITLES[mood] },
    ),
    mood === 'asleep' ? browser.action.disable(tabId) : browser.action.enable(tabId),
  ]);
}

const WAKE_UP: readonly (readonly [Expression, number])[] = [
  ['blink', 0],
  ['awake', 140],
  ['blink', 700],
  ['awake', 840],
];

/** Wakes the mascot on a tab with a short double blink. */
export async function wakeUp(tabId: number): Promise<void> {
  await setMood(tabId, 'awake');
  const generation = generations.get(tabId);
  for (const [expression, at] of WAKE_UP) {
    setTimeout(() => {
      if (generations.get(tabId) === generation) void showFace(tabId, expression);
    }, at);
  }
}

/** Frees per-tab bookkeeping. */
export function forgetTab(tabId: number): void {
  generations.delete(tabId);
}
