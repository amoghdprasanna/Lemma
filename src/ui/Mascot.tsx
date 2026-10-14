import { useEffect, useRef, useState } from 'react';
import { GRID, PALETTE, pixels, type Expression, type Rgba } from '@/src/mascot/sprite';

/** How far (px) the pointer must be to one side before the eyes follow it. */
const LOOK_THRESHOLD = 24;
const BLINK_MS = 140;
const CHEER_MS = 700;

type Gaze = Extract<Expression, 'awake' | 'lookLeft' | 'lookRight'>;

const rgb = ([r, g, b]: Rgba) => `rgb(${String(r)} ${String(g)} ${String(b)})`;

/**
 * The side panel's mascot. Its eyes follow the pointer, it blinks now and
 * then, and it hops when clicked. Same sprite as the toolbar icon.
 */
export function Mascot({ size = 40 }: { size?: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [gaze, setGaze] = useState<Gaze>('awake');
  const [blinking, setBlinking] = useState(false);
  const [cheers, setCheers] = useState(0);
  const [cheering, setCheering] = useState(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect();
      if (box === undefined) return;
      const dx = e.clientX - (box.left + box.width / 2);
      setGaze(dx < -LOOK_THRESHOLD ? 'lookLeft' : dx > LOOK_THRESHOLD ? 'lookRight' : 'awake');
    };
    const onLeave = () => {
      setGaze('awake');
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
    if (cheers === 0) return;
    const timer = window.setTimeout(() => {
      setCheering(false);
    }, CHEER_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [cheers]);

  const expression: Expression = cheering ? 'happy' : blinking ? 'blink' : gaze;

  return (
    <button
      ref={ref}
      type="button"
      className="mascot"
      aria-label="Say hi to Lemma"
      onClick={() => {
        setCheers((n) => n + 1);
        setCheering(true);
      }}
    >
      <svg
        // Re-keying restarts the hop animation on every click.
        key={cheers}
        className={cheering ? 'mascot-hop' : undefined}
        viewBox={`0 0 ${String(GRID)} ${String(GRID)}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        {pixels(expression).map(({ x, y, ink }) => (
          <rect
            key={`${String(x)},${String(y)}`}
            x={x}
            y={y}
            width={1}
            height={1}
            fill={rgb(PALETTE[ink])}
          />
        ))}
      </svg>
    </button>
  );
}
