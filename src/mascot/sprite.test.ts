import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { encodePng } from './png';
import {
  GRID,
  ICON_EXPRESSION,
  ICON_SIZES,
  PALETTE,
  pixels,
  rasterize,
  type Expression,
} from './sprite';

const EXPRESSIONS: Expression[] = ['awake', 'blink', 'asleep', 'happy', 'lookLeft', 'lookRight'];

function pixelAt(buf: Uint8ClampedArray, size: number, x: number, y: number): number[] {
  const i = (y * size + x) * 4;
  return [...buf.subarray(i, i + 4)];
}

describe('mascot sprite', () => {
  it('keeps every pixel on the grid', () => {
    for (const e of EXPRESSIONS) {
      for (const { x, y } of pixels(e)) {
        expect([x, y].every((v) => v >= 0 && v < GRID)).toBe(true);
      }
    }
  });

  it('draws a distinct face for every expression', () => {
    const faces = EXPRESSIONS.map((e) => JSON.stringify(pixels(e)));
    expect(new Set(faces).size).toBe(EXPRESSIONS.length);
  });

  it('puts open eyes where the awake face expects them', () => {
    const buf = rasterize('awake', GRID);
    expect(pixelAt(buf, GRID, 5, 7)).toEqual([...PALETTE.K]);
    expect(pixelAt(buf, GRID, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it.each([16, 19, 32, 48, 128])('scales to %ipx without gaps', (size) => {
    const buf = rasterize('awake', size);
    expect(buf.length).toBe(size * size * 4);
    // Body centre is opaque at every size; the far corner stays transparent.
    expect(pixelAt(buf, size, Math.floor(size / 2), Math.floor((size * 11) / GRID))[3]).toBe(255);
    expect(pixelAt(buf, size, size - 1, size - 1)[3]).toBe(0);
    const opaque = (b: Uint8ClampedArray) => b.filter((_, i) => i % 4 === 3 && b[i] === 255).length;
    expect(opaque(buf)).toBeGreaterThan(0.3 * size * size);
  });

  it('rejects invalid sizes', () => {
    expect(() => rasterize('awake', 0)).toThrow(RangeError);
    expect(() => rasterize('awake', 1.5)).toThrow(RangeError);
  });

  it.each(ICON_SIZES)('packaged icon %ipx is up to date (run `npm run icons`)', (size) => {
    const committed = readFileSync(
      path.resolve(import.meta.dirname, `../../public/icon/${String(size)}.png`),
    );
    expect(encodePng(rasterize(ICON_EXPRESSION, size), size, size).equals(committed)).toBe(true);
  });
});
