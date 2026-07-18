/**
 * Reusable entrance recipes for the motion layer.
 *
 * These are PURE config producers — they return Moti-shaped
 * `{ from, animate, transition }` objects to spread onto a `<MotiView>` (moti is
 * re-exported from `components/motion`). Keeping them pure means they carry no
 * native dependency and are reduced-motion aware via an explicit `reduced` flag:
 * when `reduced` is true the element starts AT its resting state with a 0ms
 * transition, so it appears instantly with no movement.
 *
 *   import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
 *   const reduced = useReducedMotion();
 *   items.map((it, i) => (
 *     <MotiView key={it.id} {...slideUpSequence({ reduced, delay: staggerIn(i) })}>
 *       ...
 *     </MotiView>
 *   ));
 */
import { durations } from '../../theme/motion';

type MotiValues = {
  opacity?: number;
  translateY?: number;
  translateX?: number;
  scale?: number;
};

// Discriminated union so a recipe spreads directly onto <MotiView> (Moti's
// `transition` prop is itself discriminated: timing configs carry `duration`,
// spring configs carry `damping`/`stiffness`/`mass`). A loose union with all
// fields optional is NOT assignable to that prop — keep these arms separate.
type MotiTransition =
  | { type: 'timing'; duration?: number; delay?: number }
  | { type: 'spring'; damping?: number; stiffness?: number; mass?: number; delay?: number };

export type MotiRecipe = {
  from: MotiValues;
  animate: MotiValues;
  transition: MotiTransition;
};

/**
 * Per-item entrance delay for staggered lists/grids.
 * Guideline: 30–50ms per item — defaults to 40ms with a small base offset.
 */
export function staggerIn(index: number, step = 40, base = 0): number {
  if (!Number.isFinite(index) || index <= 0) return Math.max(0, base);
  return base + index * step;
}

/**
 * Fade + slide-up entrance. `distance` = px the element rises from (default 12).
 * Reduced motion → starts in place, 0ms (instant, no translate).
 *
 * `play` (default true): while false, the element HOLDS invisible at its start
 * state — no motion, no reveal. Flip it true and the entrance runs with its
 * configured delay/duration. This is how the entry screens keep their stagger
 * from playing unseen underneath the launch splash overlay (`useSplashDone`).
 */
export function slideUpSequence(opts?: {
  reduced?: boolean;
  delay?: number;
  distance?: number;
  duration?: number;
  play?: boolean;
}): MotiRecipe {
  const { reduced = false, delay = 0, distance = 12, duration = durations.normal, play = true } = opts ?? {};
  if (!play) {
    const held = { opacity: 0, translateY: reduced ? 0 : distance };
    return { from: held, animate: held, transition: { type: 'timing', duration: 0, delay: 0 } };
  }
  if (reduced) {
    return {
      from: { opacity: 1, translateY: 0 },
      animate: { opacity: 1, translateY: 0 },
      transition: { type: 'timing', duration: 0, delay: 0 },
    };
  }
  return {
    from: { opacity: 0, translateY: distance },
    animate: { opacity: 1, translateY: 0 },
    transition: { type: 'timing', duration, delay },
  };
}

/**
 * Springy success "pop" (scale up from slightly small + fade in) — for confirm
 * states, unlocked badges, checkmarks. Reduced motion → instant, no scale.
 */
export function successPop(opts?: { reduced?: boolean; delay?: number }): MotiRecipe {
  const { reduced = false, delay = 0 } = opts ?? {};
  if (reduced) {
    return {
      from: { opacity: 1, scale: 1 },
      animate: { opacity: 1, scale: 1 },
      transition: { type: 'timing', duration: 0, delay: 0 },
    };
  }
  return {
    from: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: 'spring', damping: 12, stiffness: 220, mass: 0.8, delay },
  };
}
