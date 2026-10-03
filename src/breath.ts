/**
 * The breath. Hold anywhere (or the space bar) to breathe in, let go to breathe out.
 * A soft spring carries the light, so it eases in, settles with a little give after an
 * exhale, and never jumps. Left alone, it slips back into a slow idle breath.
 */
import { Spring } from './engine/spring';
import { tick } from './engine/haptics';

export type BreathMode = 'rest' | 'in' | 'out';

// Spring per mode: omega (speed) and zeta (damping, below 1 overshoots softly).
// Inhale reaches 90% in about 3 s; the exhale is longer, about 4 s down and a soft settle after.
const FEEL = {
  in: { omega: 1.3, zeta: 0.9 },
  out: { omega: 0.7, zeta: 0.72 },
  rest: { omega: 2.5, zeta: 1 },
};
// Calm: slower and fully damped, so nothing overshoots.
const CALM_SPEED = 0.75;
// After a release, wait this long before drifting back into the idle breath.
const RESUME_MS = 7000;
// Idle breath: about six breaths a minute (13 s in calm), in the lower part of the range,
// so holding always has somewhere to go.
const IDLE_DEPTH = 0.42;
const IDLE_S = 10;
const CALM_IDLE_S = 13;

export function createBreath(isCalm: () => boolean) {
  const spring = new Spring(0);
  const listeners = new Set<(mode: BreathMode) => void>();
  const pointers = new Set<number>();
  let mode: BreathMode = 'rest';
  let keyDown = false;
  let sinceRelease = 0;
  let idlePhase = 0;
  let holds = 0;

  function set(next: BreathMode) {
    mode = next;
    const f = FEEL[next];
    const calm = isCalm();
    spring.omega = f.omega * (calm ? CALM_SPEED : 1);
    spring.zeta = calm ? 1 : f.zeta;
    for (const fn of listeners) fn(next);
  }

  function hold() {
    if (mode === 'in') return;
    holds++;
    spring.target = 1;
    set('in');
  }

  function release(haptic: boolean) {
    if (mode !== 'in') return;
    if (haptic) tick();
    spring.target = 0;
    sinceRelease = 0;
    set('out');
  }

  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.add(e.pointerId);
    hold();
  });
  const up = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId) || pointers.size || keyDown) return;
    release(e.type === 'pointerup');
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  // Long-press menus would interrupt a held breath.
  addEventListener('contextmenu', (e) => e.preventDefault());

  const isBreathKey = (e: KeyboardEvent) =>
    (e.code === 'Space' || e.code === 'Enter') && !e.altKey && !e.ctrlKey && !e.metaKey;
  addEventListener('keydown', (e) => {
    if (!isBreathKey(e)) return;
    e.preventDefault();
    if (e.repeat) return;
    keyDown = true;
    hold();
  });
  addEventListener('keyup', (e) => {
    if (!isBreathKey(e)) return;
    keyDown = false;
    if (!pointers.size) release(true);
  });

  // Losing focus mid-breath lets it go quietly, without a tick.
  const drop = () => {
    pointers.clear();
    keyDown = false;
    release(false);
  };
  addEventListener('blur', drop);
  document.addEventListener('visibilitychange', () => document.hidden && drop());

  return {
    /** Advance by dt ms and return the breath, 0 (out) to 1 (in), with a little spring give. */
    update(dt: number): number {
      if (mode === 'out') {
        sinceRelease += dt;
        if (sinceRelease >= RESUME_MS) {
          idlePhase = 0;
          set('rest');
        }
      }
      if (mode === 'rest') {
        idlePhase += dt / 1000 / (isCalm() ? CALM_IDLE_S : IDLE_S);
        // Eased: slower at the top and bottom, like a real breath. Starts at the bottom.
        spring.target = IDLE_DEPTH * (0.5 - 0.5 * Math.cos(idlePhase * Math.PI * 2));
      }
      return spring.update(dt);
    },
    get mode() { return mode; },
    /** How many times someone has held. */
    get holds() { return holds; },
    onChange(fn: (mode: BreathMode) => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}
