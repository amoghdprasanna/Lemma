import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  HEAD_BOX,
  oswald,
  oswaldHead,
  TAIL_PIVOT,
  THINK_FRAMES,
  weenie,
  WEENIE_VIEW,
  type DogShape,
  type Expression,
  type Shape,
} from '@/src/mascot/oswald';
import { usePanelState } from './context';

/** How far (px) the pointer must be to one side before the eyes follow it. */
const LOOK_THRESHOLD = 24;
/** Within this distance (px) Oswald leans toward the pointer. */
const LEAN_RADIUS = 180;
const BLINK_MS = 150;
const HOP_MS = 720;
const BARK_MS = 1100;
const THINK_FRAME_MS = 400;
/** Three clicks within this window turn the hop into a somersault. */
const SPIN_WINDOW_MS = 900;

type Gaze = Extract<Expression, 'awake' | 'lookLeft' | 'lookRight'>;
type Motion = 'idle' | 'hop' | 'spin' | 'think' | 'sleep';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function Paths({ shapes }: { shapes: readonly (Shape | DogShape)[] }) {
  return shapes.map((s, i) => (
    <path
      key={i}
      d={s.d}
      fill={s.fill ?? 'none'}
      stroke={s.stroke}
      strokeWidth={s.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));
}

function byPart<T extends { part: string }>(shapes: readonly T[], part: T['part']): T[] {
  return shapes.filter((s) => s.part === part);
}

/**
 * Oswald, the side panel's mascot, in a bouncy cartoon style. He breathes and
 * wiggles his tentacles at rest, follows the pointer with his eyes and leans
 * toward it, winks and tips his hat when you hover, hops when clicked (three
 * quick clicks: a somersault), sways and thinks while Lemma works, hops when
 * it is done, and dozes off when there is no Overleaf editor. Reduced motion:
 * only his face changes.
 */
function Oswald({ onHop }: { onHop: () => void }) {
  const { thinking, editor } = usePanelState();
  const ref = useRef<HTMLButtonElement>(null);
  const clicks = useRef<number[]>([]);
  const [gaze, setGaze] = useState<Gaze>('awake');
  const [lean, setLean] = useState(0);
  const [hover, setHover] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [hop, setHop] = useState<{ n: number; spin: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const [wasThinking, setWasThinking] = useState(thinking);
  const sleeping = editor.state === 'unavailable';

  // Finished a piece of work: a little hop. (State adjusted during render,
  // so the hop starts on the same frame the thinking face goes away.)
  if (thinking !== wasThinking) {
    setWasThinking(thinking);
    if (!thinking) setHop((h) => ({ n: (h?.n ?? 0) + 1, spin: false }));
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect();
      if (box === undefined) return;
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      setGaze(dx < -LOOK_THRESHOLD ? 'lookLeft' : dx > LOOK_THRESHOLD ? 'lookRight' : 'awake');
      setLean(Math.hypot(dx, dy) < LEAN_RADIUS ? Math.max(-1, Math.min(1, dx / 110)) : 0);
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
            : hover
              ? 'wink'
              : gaze;
  const motion: Motion =
    hop !== null ? (hop.spin ? 'spin' : 'hop') : thinking ? 'think' : sleeping ? 'sleep' : 'idle';
  const shapes = oswald(expression);

  return (
    <button
      ref={ref}
      type="button"
      className="mascot oswald"
      data-motion={motion}
      data-hover={hover}
      style={{ '--lean': lean } as CSSProperties}
      aria-label="Say hi to Lemma"
      title={thinking ? 'Thinking…' : sleeping ? 'Asleep: no Overleaf editor here' : 'Oswald'}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={() => {
        const now = performance.now();
        clicks.current = [...clicks.current.filter((t) => now - t < SPIN_WINDOW_MS), now];
        const spin = clicks.current.length >= 3;
        if (spin) clicks.current = [];
        setHop((h) => ({ n: (h?.n ?? 0) + 1, spin }));
        onHop();
      }}
    >
      <svg viewBox="-4 -8 108 112" aria-hidden="true" focusable="false">
        <ellipse
          key={`shadow-${String(hop?.n ?? 0)}`}
          className="m-shadow"
          cx={50}
          cy={99}
          rx={32}
          ry={3.5}
        />
        <g className="m-lean">
          {/* Re-keyed per hop so the animation restarts on every click. */}
          <g key={hop?.n ?? 0} className="m-body">
            <g className="o-legs">
              <Paths shapes={byPart(shapes, 'legs')} />
            </g>
            <Paths shapes={byPart(shapes, 'body')} />
            <g className="o-hat">
              <Paths shapes={byPart(shapes, 'hat')} />
            </g>
            <Paths shapes={byPart(shapes, 'face')} />
            <Paths shapes={byPart(shapes, 'marks')} />
          </g>
        </g>
      </svg>
    </button>
  );
}

/**
 * Weenie, Oswald's dachshund. Wags at rest (faster when you hover or Oswald
 * hops), sniffs about while Lemma thinks, and barks with a hop when clicked.
 */
function Weenie({ excited }: { excited: boolean }) {
  const { thinking } = usePanelState();
  const [barks, setBarks] = useState(0);
  const [barking, setBarking] = useState(false);

  useEffect(() => {
    if (barks === 0) return;
    const timer = window.setTimeout(() => {
      setBarking(false);
    }, BARK_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [barks]);

  const shapes = weenie(barking ? 'bark' : 'calm');
  const mood = barking ? 'bark' : thinking ? 'sniff' : 'calm';
  const tailOrigin = { transformOrigin: `${String(TAIL_PIVOT.x)}px ${String(TAIL_PIVOT.y)}px` };

  return (
    <button
      type="button"
      className="mascot weenie"
      data-mood={mood}
      data-excited={excited}
      aria-label="Pet Weenie"
      title="Weenie"
      onClick={() => {
        setBarks((n) => n + 1);
        setBarking(true);
      }}
    >
      {barking && (
        <span key={barks} className="woof" aria-hidden="true">
          Woof!
        </span>
      )}
      <svg
        viewBox={`0 0 ${String(WEENIE_VIEW.width)} ${String(WEENIE_VIEW.height)}`}
        aria-hidden="true"
        focusable="false"
      >
        <ellipse className="m-shadow" cx={50} cy={57} rx={40} ry={2.5} />
        <g key={barks} className="w-body">
          <g className="w-tail" style={tailOrigin}>
            <Paths shapes={byPart(shapes, 'tail')} />
          </g>
          <Paths shapes={byPart(shapes, 'body')} />
          <g className="w-head">
            <Paths shapes={byPart(shapes, 'head')} />
            <g className="w-ear">
              <Paths shapes={byPart(shapes, 'ear')} />
            </g>
          </g>
        </g>
      </svg>
    </button>
  );
}

/** Oswald and Weenie side by side in the title bar. */
export function Mascots() {
  const [hops, setHops] = useState(0);
  const [excited, setExcited] = useState(false);
  useEffect(() => {
    if (hops === 0) return;
    const timer = window.setTimeout(() => {
      setExcited(false);
    }, HOP_MS * 2);
    return () => {
      window.clearTimeout(timer);
    };
  }, [hops]);
  return (
    <div className="mascots">
      <Oswald
        onHop={() => {
          setHops((n) => n + 1);
          setExcited(true);
        }}
      />
      <Weenie excited={excited} />
    </div>
  );
}

const HEAD_VIEW = [HEAD_BOX.x, HEAD_BOX.y, HEAD_BOX.size, HEAD_BOX.size].map(String).join(' ');

/** A still Oswald head for chat bubbles and empty states. */
export function MascotAvatar({
  size,
  expression = 'awake',
}: {
  size: number;
  expression?: Expression;
}) {
  return (
    <svg
      className="avatar"
      viewBox={HEAD_VIEW}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <Paths shapes={oswaldHead(expression)} />
    </svg>
  );
}
