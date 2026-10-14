/**
 * Lemma's mascot: a blocky builder in a hard hat, drawn on a 16×16 grid.
 *
 * Single source of truth for the toolbar icon (live, per tab), the packaged
 * PNG icons (scripts/generate-icons.ts) and the side panel's SVG mascot.
 * This file has no imports so Node can run it directly.
 */

export const GRID = 16;

/** Packaged icon sizes (public/icon/<size>.png) and the face they show. */
export const ICON_SIZES = [16, 32, 48, 128] as const;
export const ICON_EXPRESSION: Expression = 'awake';

export type Expression = 'awake' | 'blink' | 'asleep' | 'happy' | 'lookLeft' | 'lookRight';

export type Rgba = readonly [r: number, g: number, b: number, a: number];

export const PALETTE = {
  H: [0xf2, 0xb7, 0x05, 0xff], // hard hat
  h: [0xb8, 0x7f, 0x00, 0xff], // hat brim
  B: [0x3d, 0x7e, 0xb8, 0xff], // body
  K: [0x14, 0x1b, 0x24, 0xff], // eyes, "z"
} as const satisfies Record<string, Rgba>;

export type Ink = keyof typeof PALETTE;

// Eyes are drawn on top of this, per expression.
const BODY = [
  '................',
  '................',
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '...hhhhhhhhhh...',
  '...BBBBBBBBBB...',
  '...BBBBBBBBBB...',
  '...BBBBBBBBBB...',
  '...BBBBBBBBBB...',
  '.BBBBBBBBBBBBBB.',
  '.BBBBBBBBBBBBBB.',
  '...BBBBBBBBBB...',
  '...BBBBBBBBBB...',
  '....BB....BB....',
  '....BB....BB....',
  '................',
] as const;

/** A face pixel; ink defaults to 'K' (eyes). */
type Point = readonly [x: number, y: number, ink?: Ink];

/** A 2×2 eye pair whose left eye's top-left pixel is at (x, 7). */
function openEyes(x: number): Point[] {
  return [x, x + 4].flatMap((ex): Point[] => [
    [ex, 7],
    [ex + 1, 7],
    [ex, 8],
    [ex + 1, 8],
  ]);
}

const CLOSED_EYES: Point[] = [
  [5, 8],
  [6, 8],
  [9, 8],
  [10, 8],
];

const FACES: Record<Expression, Point[]> = {
  awake: openEyes(5),
  lookLeft: openEyes(4),
  lookRight: openEyes(6),
  blink: CLOSED_EYES,
  happy: [
    [4, 8],
    [5, 7],
    [6, 8],
    [9, 8],
    [10, 7],
    [11, 8],
  ],
  // Closed eyes plus a "z" in the top-right corner, in body colour so it
  // shows on both light and dark toolbars.
  asleep: [
    ...CLOSED_EYES,
    ...(
      [
        [12, 0],
        [13, 0],
        [14, 0],
        [15, 0],
        [14, 1],
        [13, 2],
        [12, 3],
        [13, 3],
        [14, 3],
        [15, 3],
      ] as const
    ).map(([x, y]): Point => [x, y, 'B']),
  ],
};

export interface Pixel {
  x: number;
  y: number;
  ink: Ink;
}

/** The opaque pixels of the mascot with the given expression, on the GRID×GRID canvas. */
export function pixels(expression: Expression): Pixel[] {
  const grid = BODY.map((row) => Array.from(row));
  for (const [x, y, ink = 'K'] of FACES[expression]) {
    const row = grid[y];
    if (row !== undefined) row[x] = ink;
  }
  const out: Pixel[] = [];
  grid.forEach((row, y) => {
    row.forEach((ch, x) => {
      if (ch in PALETTE) out.push({ x, y, ink: ch as Ink });
    });
  });
  return out;
}

/**
 * Rasterises the mascot to a size×size RGBA buffer (nearest-neighbour, so
 * pixel edges stay crisp). Suitable for `new ImageData(buf, size, size)`.
 */
export function rasterize(expression: Expression, size: number): Uint8ClampedArray<ArrayBuffer> {
  if (!Number.isInteger(size) || size < 1)
    throw new RangeError(`Invalid icon size: ${String(size)}`);
  const buf = new Uint8ClampedArray(size * size * 4);
  const scale = size / GRID;
  for (const { x, y, ink } of pixels(expression)) {
    const [r, g, b, a] = PALETTE[ink];
    for (let py = Math.round(y * scale); py < Math.round((y + 1) * scale); py++) {
      for (let px = Math.round(x * scale); px < Math.round((x + 1) * scale); px++) {
        buf.set([r, g, b, a], (py * size + px) * 4);
      }
    }
  }
  return buf;
}
