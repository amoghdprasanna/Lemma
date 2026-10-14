import { browser } from 'wxt/browser';
import { HEAD_BOX, oswaldHead, paint, THINK_FRAMES, type Expression } from './oswald';

/**
 * The toolbar icon is Oswald's head, and his face tracks the tab:
 * - asleep: not an Overleaf project (action disabled, so Chrome also greys it)
 * - awake:  an Overleaf project; clicking opens the side panel
 * - happy:  the side panel is open on this tab
 * - thinking: the panel is checking the paper or the on-device model is answering
 */
export type Mood = 'asleep' | 'awake' | 'happy' | 'thinking';

const TITLES: Record<Mood, string> = {
  asleep: 'Lemma is asleep. Open an Overleaf project to wake it up.',
  awake: 'Lemma: click to open the side panel',
  happy: 'Lemma: side panel open',
  thinking: 'Lemma is thinking…',
};

const FACE: Record<Mood, Expression> = {
  asleep: 'asleep',
  awake: 'wink',
  happy: 'happy',
  thinking: 'think3',
};

/** Toolbar icons are 16 dip; 32 covers high-DPI screens. */
const TOOLBAR_SIZES = [16, 32] as const;

const imageCache = new Map<Expression, Record<number, ImageData>>();

/** Oswald's head at one toolbar size, drawn on an OffscreenCanvas (available in service workers). */
function draw(expression: Expression, size: number): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Lemma: no 2D canvas for the toolbar icon');
  paint(ctx, oswaldHead(expression), size, (d) => new Path2D(d), HEAD_BOX);
  return ctx.getImageData(0, 0, size, size);
}

function imageData(expression: Expression): Record<number, ImageData> {
  let images = imageCache.get(expression);
  if (images === undefined) {
    images = Object.fromEntries(TOOLBAR_SIZES.map((size) => [size, draw(expression, size)]));
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
    showFace(tabId, FACE[mood]),
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
  ['wink', 840],
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

const THINK_FRAME_MS = 400;
/** Stop animating eventually, so a panel that died mid-thought can't spin the icon forever. */
const MAX_THINK_FRAMES = 150;

/** Shows the thinking face; with `animate`, the "…" fills in on a loop until the mood changes. */
export async function think(tabId: number, animate: boolean): Promise<void> {
  await setMood(tabId, 'thinking');
  if (!animate) return;
  const generation = generations.get(tabId);
  let frame = 0;
  const step = () => {
    if (generations.get(tabId) !== generation || frame >= MAX_THINK_FRAMES) return;
    void showFace(tabId, THINK_FRAMES[frame % THINK_FRAMES.length] ?? 'think3');
    frame++;
    setTimeout(step, THINK_FRAME_MS);
  };
  step();
}

/** Frees per-tab bookkeeping. */
export function forgetTab(tabId: number): void {
  generations.delete(tabId);
}
