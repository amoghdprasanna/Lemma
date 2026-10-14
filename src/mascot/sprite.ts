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

export type Expression =
  | 'awake'
  | 'blink'
  | 'asleep'
  | 'happy'
  | 'lookLeft'
  | 'lookRight'
  | 'think1'
  | 'think2'
  | 'think3';

/** Thinking animation: eyes up, then a "…" that fills in one dot at a time. */
export const THINK_FRAMES = ['think1', 'think2', 'think3'] as const satisfies readonly Expression[];

export type Rgba = readonly [r: number, g: number, b: number, a: number];

export const PALETTE = {
  H: [0xf2, 0xb7, 0x05, 0xff], // hard hat
  L: [0xff, 0xe0, 0x66, 0xff], // hat highlight
  h: [0xb8, 0x7f, 0x00, 0xff], // hat brim
  B: [0x3d, 0x7e, 0xb8, 0xff], // body
  b: [0x2c, 0x5f, 0x8f, 0xff], // body shade, legs
  P: [0xef, 0x7a, 0x85, 0xff], // cheeks
  K: [0x14, 0x1b, 0x24, 0xff], // outline, eyes, mouth
} as const satisfies Record<string, Rgba>;

export type Ink = keyof typeof PALETTE;

// Eyes and mouth are drawn on top of this, per expression. The dark outline
// keeps the silhouette readable on light and dark toolbars alike.
const BODY = [
  '................',
  '.....KKKKKK.....',
  '....KHLLHHHK....',
  '...KHLHHHHHHK...',
  '..KhhhhhhhhhhK..',
  '..KBBBBBBBBBBK..',
  '..KBBBBBBBBBBK..',
  '..KBBBBBBBBBBK..',
  '..KBBBBBBBBBBK..',
  '.KKBBBBBBBBBBKK.',
  'KBBBBBBBBBBBBBBK',
  'KbbKBBBBBBBBKbbK',
  '.KKKbbbbbbbbKKK.',
  '...KbbKKKKbbK...',
  '...KbbK..KbbK...',
  '...KKKK..KKKK...',
] as const;

/** A face pixel; ink defaults to 'K' (eyes, mouth). */
type Point = readonly [x: number, y: number, ink?: Ink];

/** A 2×2 eye pair whose left eye's top-left pixel is at (x, y). */
function openEyes(x: number, y = 7): Point[] {
  return [x, x + 4].flatMap((ex): Point[] => [
    [ex, y],
    [ex + 1, y],
    [ex, y + 1],
    [ex + 1, y + 1],
  ]);
}

const CLOSED_EYES: Point[] = [
  [5, 8],
  [6, 8],
  [9, 8],
  [10, 8],
];

const MOUTH: Point[] = [
  [7, 10],
  [8, 10],
];

/** Marks above the hat, in body colour so they show on both light and dark toolbars. */
function marks(points: readonly (readonly [number, number])[]): Point[] {
  return points.map(([x, y]): Point => [x, y, 'B']);
}

// A "z" squeezed in beside the hat's top-right corner.
const SNORE = marks([
  [12, 0],
  [13, 0],
  [14, 0],
  [15, 0],
  [15, 1],
  [14, 2],
  [13, 3],
  [14, 3],
  [15, 3],
]);

/** Eyes glancing up and to the right, with a sideways "hmm" mouth. */
const PONDER: Point[] = [...openEyes(6, 6), [8, 10], [9, 10]];
const DOTS = [11, 13, 15].map((x) => [x, 0] as const);

const FACES: Record<Expression, Point[]> = {
  awake: [...openEyes(5), ...MOUTH],
  lookLeft: [...openEyes(4), [6, 10], [7, 10]],
  lookRight: [...openEyes(6), [8, 10], [9, 10]],
  blink: [...CLOSED_EYES, ...MOUTH],
  happy: [
    [4, 8],
    [5, 7],
    [6, 8],
    [9, 8],
    [10, 7],
    [11, 8],
    [4, 9, 'P'],
    [11, 9, 'P'],
    [6, 10],
    [7, 11],
    [8, 11],
    [9, 10],
  ],
  asleep: [...CLOSED_EYES, ...MOUTH, ...SNORE],
  think1: [...PONDER, ...marks(DOTS.slice(0, 1))],
  think2: [...PONDER, ...marks(DOTS.slice(0, 2))],
  think3: [...PONDER, ...marks(DOTS)],
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

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function scaleRgb([r, g, b, a]: Rgba, k: number): Rgba {
  return [clamp(r * k), clamp(g * k), clamp(b * k), a];
}

/**
 * Front-face colour with soft lighting from the top left, which gives the
 * sprite its 2.5D volume. The outline and face ink stay flat.
 */
export function litColor({ x, y, ink }: Pixel): Rgba {
  const base = PALETTE[ink];
  if (ink === 'K') return base;
  // +0.5 at the top-left corner, −0.5 at the bottom-right.
  const t = 0.5 - (x + y) / (2 * (GRID - 1));
  return scaleRgb(base, 1 + 0.45 * t);
}

/** Side faces of the extruded slab: navy behind the outline, a darker tone behind colour. */
const SLAB: Rgba = [0x22, 0x35, 0x55, 0xff];
function sideColor(ink: Ink): Rgba {
  return ink === 'K' ? SLAB : scaleRgb(PALETTE[ink], 0.55);
}

/** An axis-aligned rectangle in grid units, painted in order. */
export interface Rect {
  /** side: extruded slab; face: a lit front pixel; bevel: an edge highlight or shadow. */
  kind: 'side' | 'face' | 'bevel';
  x: number;
  y: number;
  w: number;
  h: number;
  rgba: Rgba;
}

export interface Look {
  /** How far (in grid cells) the voxel slab extrudes down and to the right. 0 = flat. */
  depth: number;
  /** Width (in cells) of the light/dark bevel along the edges of each colour region. 0 = none. */
  bevel: number;
}

export const FLAT: Look = { depth: 0, bevel: 0 };
/** The 2.5D look: a navy slab behind the sprite and bevelled colour regions. */
export const VOXEL: Look = { depth: 1, bevel: 0.18 };

const SLAB_STEP = 0.25;

/**
 * The mascot as rectangles, back to front: the extruded slab, then the lit
 * front faces, then bevel highlights and shadows where a colour region ends.
 * Both the PNG icons and the side panel's SVG draw exactly this.
 */
export function shapes(expression: Expression, look: Look = FLAT): Rect[] {
  const sprite = pixels(expression);
  const out: Rect[] = [];
  for (let d = look.depth; d > 0; d -= SLAB_STEP) {
    for (const p of sprite)
      out.push({ kind: 'side', x: p.x + d, y: p.y + d, w: 1, h: 1, rgba: sideColor(p.ink) });
  }
  const at = new Map(sprite.map((p) => [`${String(p.x)},${String(p.y)}`, p.ink]));
  const same = (p: Pixel, dx: number, dy: number) =>
    at.get(`${String(p.x + dx)},${String(p.y + dy)}`) === p.ink;
  for (const p of sprite) {
    const rgba = litColor(p);
    out.push({ kind: 'face', x: p.x, y: p.y, w: 1, h: 1, rgba });
    const b = look.bevel;
    if (b <= 0 || p.ink === 'K') continue;
    if (!same(p, 0, -1))
      out.push({ kind: 'bevel', x: p.x, y: p.y, w: 1, h: b, rgba: scaleRgb(rgba, 1.25) });
    if (!same(p, -1, 0))
      out.push({ kind: 'bevel', x: p.x, y: p.y, w: b, h: 1, rgba: scaleRgb(rgba, 1.15) });
    if (!same(p, 0, 1))
      out.push({ kind: 'bevel', x: p.x, y: p.y + 1 - b, w: 1, h: b, rgba: scaleRgb(rgba, 0.78) });
    if (!same(p, 1, 0))
      out.push({ kind: 'bevel', x: p.x + 1 - b, y: p.y, w: b, h: 1, rgba: scaleRgb(rgba, 0.85) });
  }
  return out;
}

/** The look for a packaged icon: voxel when there is room for it, flat and crisp at toolbar sizes. */
export function iconLook(size: number): Look {
  return size >= 48 ? VOXEL : FLAT;
}

/**
 * Rasterises the mascot to a size×size RGBA buffer (nearest-neighbour, so
 * pixel edges stay crisp). Suitable for `new ImageData(buf, size, size)`.
 * The sprite shrinks to make room for any extrusion.
 */
export function rasterize(
  expression: Expression,
  size: number,
  look: Look = FLAT,
): Uint8ClampedArray<ArrayBuffer> {
  if (!Number.isInteger(size) || size < 1)
    throw new RangeError(`Invalid icon size: ${String(size)}`);
  const buf = new Uint8ClampedArray(size * size * 4);
  const scale = size / (GRID + look.depth);
  for (const { x, y, w, h, rgba } of shapes(expression, look)) {
    for (let py = Math.round(y * scale); py < Math.min(size, Math.round((y + h) * scale)); py++) {
      for (let px = Math.round(x * scale); px < Math.min(size, Math.round((x + w) * scale)); px++) {
        buf.set(rgba, (py * size + px) * 4);
      }
    }
  }
  return buf;
}
