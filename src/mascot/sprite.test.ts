import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from './png';
import {
  GRID,
  ICON_EXPRESSION,
  ICON_SIZES,
  iconLook,
  litColor,
  PALETTE,
  VOXEL,
  pixels,
  rasterize,
  THINK_FRAMES,
  type Expression,
} from './sprite';

const EXPRESSIONS: Expression[] = [
  'awake',
  'blink',
  'asleep',
  'happy',
  'lookLeft',
  'lookRight',
  ...THINK_FRAMES,
];

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

  it('outlines the silhouette so it reads on light and dark toolbars', () => {
    const buf = rasterize('awake', GRID);
    // Left edge of the arms and the top of the hat are outline, not fill.
    expect(pixelAt(buf, GRID, 0, 10)).toEqual([...PALETTE.K]);
    expect(pixelAt(buf, GRID, 7, 1)).toEqual([...PALETTE.K]);
  });

  it('fills in the thinking dots one at a time', () => {
    const dots = THINK_FRAMES.map(
      (e) => pixels(e).filter(({ y, ink }) => y === 0 && ink === 'B').length,
    );
    expect(dots).toEqual([1, 2, 3]);
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

  it('lights the body from the top left for a 2.5D look', () => {
    const top = litColor({ x: 3, y: 5, ink: 'B' });
    const bottom = litColor({ x: 12, y: 12, ink: 'B' });
    expect(top[2]).toBeGreaterThan(bottom[2]);
    expect(litColor({ x: 3, y: 5, ink: 'K' })).toEqual(PALETTE.K);
  });

  it('extrudes a voxel side when given depth, without spilling off the canvas', () => {
    const flat = rasterize('awake', 128);
    const deep = rasterize('awake', 128, VOXEL);
    expect(deep.length).toBe(flat.length);
    // The bottom-right of the right foot is empty when flat, filled by the side face when deep.
    const opaque = (b: Uint8ClampedArray) => b.filter((_, i) => i % 4 === 3 && b[i] === 255).length;
    expect(opaque(deep)).toBeGreaterThan(opaque(flat) * 0.9);
  });

  it('rejects invalid sizes', () => {
    expect(() => rasterize('awake', 0)).toThrow(RangeError);
    expect(() => rasterize('awake', 1.5)).toThrow(RangeError);
  });

  it.each(ICON_SIZES)('packaged icon %ipx is up to date (run `npm run icons`)', (size) => {
    const committed = decodePng(
      readFileSync(path.resolve(import.meta.dirname, `../../public/icon/${String(size)}.png`)),
    );
    expect([committed.width, committed.height]).toEqual([size, size]);
    expect(
      committed.rgba.equals(Buffer.from(rasterize(ICON_EXPRESSION, size, iconLook(size)).buffer)),
    ).toBe(true);
  });

  it('round-trips pixels through the PNG encoder', () => {
    const rgba = rasterize('happy', 48, iconLook(48));
    expect(decodePng(encodePng(rgba, 48, 48)).rgba.equals(Buffer.from(rgba.buffer))).toBe(true);
  });
});
