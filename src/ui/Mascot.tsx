import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  FLAT,
  GRID,
  shapes,
  THINK_FRAMES,
  VOXEL,
  type Expression,
  type Rect,
  type Rgba,
} from '@/src/mascot/sprite';
import { usePanelState } from './context';

/** How far (px) the pointer must be to one side before the eyes follow it. */
const LOOK_THRESHOLD = 24;
/** Within this distance (px) the mascot leans toward the pointer. */
const LEAN_RADIUS = 160;
const BLINK_MS = 140;
const HOP_MS = 720;
const THINK_FRAME_MS = 400;
/** Three clicks within this window turn the hop into a somersault. */
const SPIN_WINDOW_MS = 900;

type Gaze = Extract<Expression, 'awake' | 'lookLeft' | 'lookRight'>;
type Motion = 'idle' | 'hop' | 'spin' | 'think' | 'sleep';

const rgb = ([r, g, b]: Rgba) => `rgb(${String(r)} ${String(g)} ${String(b)})`;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// The sprite never changes per expression, so draw each one once.
const drawn = new Map<Expression, { crisp: Rect[]; soft: Rect[] }>();
function layers(expression: Expression) {
  let l = drawn.get(expression);
  if (!l) {
    const all = shapes(expression, VOXEL);
    l = {
      crisp: all.filter((r) => r.kind !== 'bevel'),
      soft: all.filter((r) => r.kind === 'bevel'),
    };
    drawn.set(expression, l);
  }
  return l;
}

function Rects({ rects }: { rects: Rect[] }) {
  return rects.map(({ x, y, w, h, rgba }, i) => (
    // Overlap by a hair so anti-aliasing never shows seams between cells.
    <rect key={i} x={x} y={y} width={w + 0.02} height={h + 0.02} fill={rgb(rgba)} />
  ));
}

/**
 * The side panel's mascot: the toolbar builder in 2.5D (a lit, bevelled
 * voxel sprite on a soft shadow), animated in a rubber-hose cartoon style.
 * It breathes at rest, follows the pointer with its eyes and leans toward
 * it, squashes and stretches through a hop when clicked (three quick clicks:
 * a somersault), sways and thinks while Lemma works, then hops when done.
 * With reduced motion it only changes its face.
 */
export function Mascot({ size = 48 }: { size?: number }) {
  const { thinking, editor } = usePanelState();
  const ref = useRef<HTMLButtonElement>(null);
  const clicks = useRef<number[]>([]);
  const [gaze, setGaze] = useState<Gaze>('awake');
  const [lean, setLean] = useState(0);
  const [blinking, setBlinking] = useState(false);
  const [hop, setHop] = useState<{ n: number; spin: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const [wasThinking, setWasThinking] = useState(thinking);
  const sleeping = editor.state === 'unavailable';

  const startHop = (spin: boolean) => {
    setHop((h) => ({ n: (h?.n ?? 0) + 1, spin }));
  };

  // Finished a piece of work: a little hop. (State adjusted during render,
  // so the hop starts on the same frame the thinking face goes away.)
  if (thinking !== wasThinking) {
    setWasThinking(thinking);
    if (!thinking) startHop(false);
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect();
      if (box === undefined) return;
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      setGaze(dx < -LOOK_THRESHOLD ? 'lookLeft' : dx > LOOK_THRESHOLD ? 'lookRight' : 'awake');
      const near = Math.hypot(dx, dy) < LEAN_RADIUS;
      setLean(near ? Math.max(-1, Math.min(1, dx / 90)) : 0);
    };
    const onLeave = () => {
      setGaze('awake');
      setLean(0);
    };
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  useEffect(() => {
    let timer: number;
    const scheduleBlink = () => {
      timer = window.setTimeout(
        () => {
          setBlinking(true);
          timer = window.setTimeout(() => {
            setBlinking(false);
            scheduleBlink();
          }, BLINK_MS);
        },
        2500 + Math.random() * 3500,
      );
    };
    scheduleBlink();
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (hop === null) return;
    const timer = window.setTimeout(() => {
      setHop(null);
    }, HOP_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [hop]);

  useEffect(() => {
    if (!thinking || reducedMotion()) return;
    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
    }, THINK_FRAME_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [thinking]);

  const expression: Expression =
    hop !== null
      ? 'happy'
      : thinking
        ? reducedMotion()
          ? 'think3'
          : (THINK_FRAMES[tick % THINK_FRAMES.length] ?? 'think3')
        : sleeping
          ? 'asleep'
          : blinking
            ? 'blink'
            : gaze;
  const motion: Motion =
    hop !== null ? (hop.spin ? 'spin' : 'hop') : thinking ? 'think' : sleeping ? 'sleep' : 'idle';
  const { crisp, soft } = layers(expression);

  return (
    <button
      ref={ref}
      type="button"
      className="mascot"
      data-motion={motion}
      style={{ '--lean': lean } as CSSProperties}
      aria-label="Say hi to Lemma"
      title={thinking ? 'Thinking…' : sleeping ? 'Asleep: no Overleaf editor here' : undefined}
      onClick={() => {
        const now = performance.now();
        clicks.current = [...clicks.current.filter((t) => now - t < SPIN_WINDOW_MS), now];
        const spin = clicks.current.length >= 3;
        if (spin) clicks.current = [];
        startHop(spin);
      }}
    >
      <svg viewBox="-1 -2 19 21" width={size} height={size} aria-hidden="true" focusable="false">
        <ellipse key={hop?.n ?? 0} className="m-shadow" cx={8.5} cy={17.6} rx={6.5} ry={0.9} />
        <g className="m-lean">
          {/* Re-keyed per hop so the animation restarts on every click. */}
          <g key={hop?.n ?? 0} className="m-body">
            <g shapeRendering="crispEdges">
              <Rects rects={crisp} />
            </g>
            <Rects rects={soft} />
          </g>
        </g>
      </svg>
    </button>
  );
}

const AVATAR = shapes('awake', FLAT);

/** A still, flat mascot for chat bubbles and empty states. */
export function MascotAvatar({ size }: { size: number }) {
  return (
    <svg
      className="avatar"
      viewBox={`0 0 ${String(GRID)} ${String(GRID)}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <Rects rects={AVATAR} />
    </svg>
  );
}
