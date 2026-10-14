/**
 * Lemma's mascots: Oswald, a round blue octopus in a bowler hat, and his
 * dog Weenie, as flat 2D vector shapes on a 100×100 canvas.
 *
 * Single source of truth for the side panel's SVG, the live toolbar icon
 * (drawn with Path2D on an OffscreenCanvas) and the packaged PNG icons
 * (scripts/generate-icons.ts). This file has no imports so Node can run it.
 */

export const VIEW = 100;

export type Expression =
  | 'awake'
  | 'wink'
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

/** The packaged icon's face: Oswald's wink. */
export const ICON_EXPRESSION: Expression = 'wink';
export const ICON_SIZES = [16, 32, 48, 128] as const;

export const COLORS = {
  blue: '#2a8cf0',
  blueShade: '#1767c9',
  blueDeep: '#0f4fa3',
  blueLight: '#7cc2ff',
  ink: '#111418',
  white: '#ffffff',
  tan: '#d99a5b',
  tanShade: '#b8783d',
  brown: '#7a4a24',
  collar: '#e0443e',
  tongue: '#f07c8f',
} as const;

/**
 * One filled and/or stroked SVG path. `part` groups shapes for animation:
 * the side panel moves legs, body and face separately.
 */
export interface Shape {
  part: 'legs' | 'body' | 'hat' | 'face' | 'marks';
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${String(cx - r)} ${String(cy)}a${String(r)} ${String(r)} 0 1 0 ${String(2 * r)} 0a${String(r)} ${String(r)} 0 1 0 ${String(-2 * r)} 0Z`;

// ---------------------------------------------------------------- Oswald

/** Curly tentacles: the back row in a deeper blue, the front row in body blue. */
const LEGS_BACK = [
  'M30 70 C22 80 14 84 6 80 C10 88 22 90 32 82 Z',
  'M70 70 C78 80 86 84 94 80 C90 88 78 90 68 82 Z',
  'M40 74 C36 86 30 92 22 94 C30 98 40 94 46 82 Z',
  'M60 74 C64 86 70 92 78 94 C70 98 60 94 54 82 Z',
];
const LEGS_FRONT = [
  'M26 64 C16 68 8 64 3 56 C2 66 12 76 28 72 Z',
  'M74 64 C84 68 92 64 97 56 C98 66 88 76 72 72 Z',
  'M36 72 C30 82 22 86 14 86 C20 94 34 92 42 80 Z',
  'M64 72 C70 82 78 86 86 86 C80 94 66 92 58 80 Z',
  'M46 76 C44 86 40 92 34 96 C42 99 50 94 51 82 Z',
  'M54 76 C56 86 60 92 66 96 C58 99 50 94 49 82 Z',
];

const HEAD = { cx: 50, cy: 44, r: 34 };

/** Eye centres: the face is turned a little to the right, as in the reference. */
const EYE_L = { x: 34, y: 42 };
const EYE_R = { x: 61, y: 35 };

function openEye(x: number, y: number, dx = 0, dy = 0): Shape[] {
  return [
    { part: 'face', d: circle(x + dx, y + dy, 4.6), fill: COLORS.ink },
    { part: 'face', d: circle(x + dx - 1.6, y + dy - 1.6, 1.5), fill: COLORS.white },
  ];
}

/** A closed eye as an upward arc (a wink or a blink). */
function closedEye(x: number, y: number): Shape {
  return {
    part: 'face',
    d: `M${String(x - 5)} ${String(y + 1)} Q${String(x)} ${String(y - 4)} ${String(x + 5)} ${String(y + 1)}`,
    stroke: COLORS.ink,
    width: 2.4,
  };
}

/** A sleeping eye: a downward arc. */
function sleepyEye(x: number, y: number): Shape {
  return {
    part: 'face',
    d: `M${String(x - 5)} ${String(y - 1)} Q${String(x)} ${String(y + 3)} ${String(x + 5)} ${String(y - 1)}`,
    stroke: COLORS.ink,
    width: 2.4,
  };
}

const GRIN: Shape[] = [
  { part: 'face', d: 'M45 56 Q58 54 70 49 Q71 64 61 69 Q50 72 45 56 Z', fill: COLORS.ink },
  { part: 'face', d: 'M53 66 Q59 63 64 65 Q60 69 55 68 Z', fill: COLORS.tongue },
];
const BIG_GRIN: Shape[] = [
  { part: 'face', d: 'M42 54 Q58 53 72 46 Q74 66 62 71 Q47 74 42 54 Z', fill: COLORS.ink },
  { part: 'face', d: 'M51 67 Q59 63 66 66 Q61 71 54 70 Z', fill: COLORS.tongue },
];
const HMM: Shape = {
  part: 'face',
  d: 'M55 60 Q60 58 65 59',
  stroke: COLORS.ink,
  width: 2.4,
};
const SNORE_MOUTH: Shape = { part: 'face', d: circle(58, 60, 2.6), fill: COLORS.ink };

/** Marks above the head (the "…" and the snore), in deep blue so they show on any toolbar. */
const DOTS = [
  { part: 'marks', d: circle(80, 10, 3.2), fill: COLORS.blueDeep },
  { part: 'marks', d: circle(89, 7, 3.2), fill: COLORS.blueDeep },
  { part: 'marks', d: circle(98, 4, 3.2), fill: COLORS.blueDeep },
] as const satisfies readonly Shape[];
const ZZZ: Shape = {
  part: 'marks',
  d: 'M78 4h12l-12 12h12',
  stroke: COLORS.blueDeep,
  width: 3,
};

function face(expression: Expression): Shape[] {
  switch (expression) {
    case 'awake':
      return [...openEye(EYE_L.x, EYE_L.y), ...openEye(EYE_R.x, EYE_R.y), ...GRIN];
    case 'lookLeft':
      return [...openEye(EYE_L.x, EYE_L.y, -2), ...openEye(EYE_R.x, EYE_R.y, -2), ...GRIN];
    case 'lookRight':
      return [...openEye(EYE_L.x, EYE_L.y, 2), ...openEye(EYE_R.x, EYE_R.y, 2), ...GRIN];
    case 'wink':
      return [...openEye(EYE_L.x, EYE_L.y), closedEye(EYE_R.x, EYE_R.y), ...GRIN];
    case 'blink':
      return [closedEye(EYE_L.x, EYE_L.y + 1), closedEye(EYE_R.x, EYE_R.y + 1), ...GRIN];
    case 'happy':
      return [closedEye(EYE_L.x, EYE_L.y), closedEye(EYE_R.x, EYE_R.y), ...BIG_GRIN];
    case 'asleep':
      return [sleepyEye(EYE_L.x, EYE_L.y), sleepyEye(EYE_R.x, EYE_R.y), SNORE_MOUTH, ZZZ];
    case 'think1':
    case 'think2':
    case 'think3': {
      const n = Number(expression.slice(-1));
      return [
        ...openEye(EYE_L.x, EYE_L.y, 1.5, -2.5),
        ...openEye(EYE_R.x, EYE_R.y, 1.5, -2.5),
        HMM,
        ...DOTS.slice(0, n),
      ];
    }
  }
}

/** Oswald with the given face, back to front. */
export function oswald(expression: Expression): Shape[] {
  const { cx, cy, r } = HEAD;
  return [
    ...LEGS_BACK.map((d): Shape => ({ part: 'legs', d, fill: COLORS.blueDeep })),
    ...LEGS_FRONT.map((d): Shape => ({ part: 'legs', d, fill: COLORS.blue })),
    // Head: a darker rim on the lower right, the lit face offset up and left.
    { part: 'body', d: circle(cx, cy, r), fill: COLORS.blueShade },
    { part: 'body', d: circle(cx - 2.6, cy - 2.6, r - 3.6), fill: COLORS.blue },
    { part: 'body', d: 'M26 24 Q32 15 42 13', stroke: COLORS.blueLight, width: 3 },
    // Bowler hat, perched on the top left.
    { part: 'hat', d: 'M24 16 Q22 4 33 3 Q44 3 43 15 Z', fill: COLORS.ink },
    { part: 'hat', d: 'M19 17 Q33 11 48 15 Q35 21 19 17 Z', fill: COLORS.ink },
    { part: 'hat', d: 'M28 7 Q31 5 35 5', stroke: '#5b6470', width: 1.6 },
    ...face(expression),
  ];
}

/** Oswald's head, hat and face only: the toolbar icon, which is too small for legs. */
export function oswaldHead(expression: Expression): Shape[] {
  return oswald(expression).filter((s) => s.part !== 'legs');
}

/** A square region of the 100×100 canvas to fit into an icon. */
export interface Box {
  x: number;
  y: number;
  size: number;
}

export const FULL_BOX: Box = { x: 0, y: 0, size: VIEW };
/** Tight around the head and hat (and the thinking dots), for 16 and 32 px. */
export const HEAD_BOX: Box = { x: 12, y: 0, size: 82 };

/** What a packaged icon of this size shows: the whole Oswald when there is room, else his head. */
export function iconArt(size: number): { shapes: Shape[]; box: Box } {
  return size >= 48
    ? { shapes: oswald(ICON_EXPRESSION), box: FULL_BOX }
    : { shapes: oswaldHead(ICON_EXPRESSION), box: HEAD_BOX };
}

// ---------------------------------------------------------------- Weenie

export type WeeniePart = 'tail' | 'body' | 'head' | 'ear';

export interface DogShape {
  part: WeeniePart;
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
}

/**
 * Weenie, Oswald's long little dachshund, side on and facing left (toward
 * Oswald), on a 100×60 canvas. The tail pivots at TAIL_PIVOT to wag.
 */
export const WEENIE_VIEW = { width: 100, height: 60 } as const;
export const TAIL_PIVOT = { x: 86, y: 30 } as const;

export function weenie(mood: 'calm' | 'bark' | 'sniff' = 'calm'): DogShape[] {
  const mouth: DogShape[] =
    mood === 'bark'
      ? [
          { part: 'head', d: 'M5 33 Q12 40 20 34 Q13 37 5 33 Z', fill: COLORS.ink },
          { part: 'head', d: 'M10 36 Q13 39 16 36', fill: COLORS.tongue },
        ]
      : [{ part: 'head', d: 'M8 33 Q13 36 18 33', stroke: COLORS.ink, width: 1.8 }];
  return [
    { part: 'tail', d: 'M84 30 Q94 22 96 12', stroke: COLORS.tanShade, width: 5 },
    // Back legs, then the long hot-dog body, then front legs.
    { part: 'body', d: 'M74 38 h7 v14 q0 3 -3 3 h-4 Z', fill: COLORS.tanShade },
    { part: 'body', d: 'M30 38 h7 v14 q0 3 -3 3 h-4 Z', fill: COLORS.tanShade },
    { part: 'body', d: 'M24 20 h56 a12 12 0 0 1 0 24 h-56 a12 12 0 0 1 0 -24 Z', fill: COLORS.tan },
    {
      part: 'body',
      d: 'M30 40 h48 a8 8 0 0 0 6 -4 a12 12 0 0 1 -4 8 h-56 a12 12 0 0 1 -6 -3 Z',
      fill: COLORS.tanShade,
    },
    { part: 'body', d: 'M66 38 h7 v14 q0 3 -3 3 h-4 Z', fill: COLORS.tan },
    { part: 'body', d: 'M22 38 h7 v14 q0 3 -3 3 h-4 Z', fill: COLORS.tan },
    { part: 'body', d: 'M22 21 Q20 30 24 40', stroke: COLORS.collar, width: 4 },
    // Head with a long snout.
    { part: 'head', d: circle(18, 22, 12), fill: COLORS.tan },
    { part: 'head', d: 'M14 24 Q4 23 2 28 Q2 34 10 34 Q18 34 20 28 Z', fill: COLORS.tan },
    { part: 'head', d: circle(3.5, 27, 2.6), fill: COLORS.ink },
    { part: 'head', d: circle(15, 18, 2.2), fill: COLORS.ink },
    { part: 'head', d: circle(14.3, 17.3, 0.7), fill: COLORS.white },
    ...mouth,
    { part: 'ear', d: 'M20 12 Q31 12 30 28 Q29 36 24 34 Q20 24 20 12 Z', fill: COLORS.brown },
  ];
}

// ---------------------------------------------------------------- raster

/** Minimal 2D context surface shared by OffscreenCanvas and the icon script. */
export interface PaintContext {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  fill(path: Path2D): void;
  stroke(path: Path2D): void;
}

/** Paints shapes onto a `size`×`size` canvas, fitting `box` of the 100×100 art into it. */
export function paint(
  ctx: PaintContext,
  shapes: readonly Shape[],
  size: number,
  makePath: (d: string) => Path2D,
  box: Box = FULL_BOX,
): void {
  const k = size / box.size;
  ctx.setTransform(k, 0, 0, k, -box.x * k, -box.y * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of shapes) {
    const path = makePath(s.d);
    if (s.fill) {
      ctx.fillStyle = s.fill;
      ctx.fill(path);
    }
    if (s.stroke) {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = s.width ?? 2;
      ctx.stroke(path);
    }
  }
}
