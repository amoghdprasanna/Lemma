import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HEAD_BOX,
  ICON_SIZES,
  iconArt,
  oswald,
  oswaldHead,
  paint,
  THINK_FRAMES,
  weenie,
  type Expression,
  type PaintContext,
} from './oswald';
import { decodePng } from './png';

const EXPRESSIONS: Expression[] = [
  'awake',
  'wink',
  'blink',
  'asleep',
  'happy',
  'lookLeft',
  'lookRight',
  ...THINK_FRAMES,
];

describe('Oswald', () => {
  it('draws a distinct face for every expression', () => {
    const faces = EXPRESSIONS.map((e) =>
      JSON.stringify(oswald(e).filter((s) => s.part !== 'body')),
    );
    expect(new Set(faces).size).toBe(EXPRESSIONS.length);
  });

  it('paints every shape with a fill or a stroke', () => {
    for (const e of EXPRESSIONS) {
      for (const s of oswald(e)) expect(s.fill ?? s.stroke).toBeTruthy();
    }
    for (const s of weenie('bark')) expect(s.fill ?? s.stroke).toBeTruthy();
  });

  it('fills in the thinking dots one at a time', () => {
    expect(THINK_FRAMES.map((e) => oswald(e).filter((s) => s.part === 'marks').length)).toEqual([
      1, 2, 3,
    ]);
  });

  it('leaves the legs off the toolbar head', () => {
    expect(oswaldHead('wink').some((s) => s.part === 'legs')).toBe(false);
    expect(oswald('wink').some((s) => s.part === 'legs')).toBe(true);
  });

  it('fits the chosen box into the canvas and paints back to front', () => {
    const calls: string[] = [];
    const ctx: PaintContext = {
      setTransform: (...m) => calls.push(`t:${m.map((v) => v.toFixed(3)).join(',')}`),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      fill: () => calls.push('fill'),
      stroke: () => calls.push('stroke'),
    };
    const shapes = oswaldHead('wink');
    paint(ctx, shapes, 32, () => ({}) as Path2D, HEAD_BOX);
    const k = 32 / HEAD_BOX.size;
    expect(calls[0]).toBe(
      `t:${[k, 0, 0, k, -HEAD_BOX.x * k, 0].map((v) => v.toFixed(3)).join(',')}`,
    );
    expect(calls.filter((c) => c === 'fill').length).toBe(shapes.filter((s) => s.fill).length);
  });
});

describe('packaged icons', () => {
  it('are up to date with the art (run `npm run icons`)', () => {
    const hash = createHash('sha256')
      .update(JSON.stringify(ICON_SIZES.map((size) => iconArt(size))))
      .digest('hex');
    const stored = readFileSync(
      path.resolve(import.meta.dirname, '../../scripts/icons.hash'),
      'utf8',
    );
    expect(stored.trim()).toBe(hash);
  });

  it.each(ICON_SIZES)('%ipx is a square PNG with Oswald on it', (size) => {
    const png = decodePng(
      readFileSync(path.resolve(import.meta.dirname, `../../public/icon/${String(size)}.png`)),
    );
    expect([png.width, png.height]).toEqual([size, size]);
    const opaque = png.rgba.filter((v, i) => i % 4 === 3 && v > 200).length;
    expect(opaque).toBeGreaterThan(0.3 * size * size);
    // Mostly blue: Oswald, not a blank or stale image.
    let blue = 0;
    for (let i = 0; i < png.rgba.length; i += 4) {
      const [r, g, b, a] = [
        png.rgba[i] ?? 0,
        png.rgba[i + 1] ?? 0,
        png.rgba[i + 2] ?? 0,
        png.rgba[i + 3] ?? 0,
      ];
      if (a > 200 && b > 150 && b > r + 60 && b > g) blue++;
    }
    expect(blue).toBeGreaterThan(0.2 * size * size);
  });
});
