/**
 * The guided breath. Pure timeline, no DOM. The value is 0 (out) to 1 (in) with a cosine
 * ease, so the light slows at the top and bottom of each breath like a real one.
 *
 * Ease-in: the first breath is the person's natural rhythm, and each breath after moves a
 * step towards the chosen pace. If they seem to struggle (let go well before the in-breath
 * ends, or press again early in the out-breath) or stop holding along, the pace holds steady
 * instead of moving on. Slower and faster scale the pace from the next breath, never the
 * current one.
 */
import { cycleOf, PACE_KEYS, type Pace } from './pace';

export type GuidePhase = 'settle' | 'in' | 'hold' | 'out' | 'rest' | 'done';
export interface GuideState { value: number; phase: GuidePhase; progress: number }

// A short lead-in so the light can find its place before the first breath.
const SETTLE_S = 3;
const FACTOR_STEP = 0.06;
const FACTOR_RANGE = [0.7, 1.4] as const;
const ORDER = ['in', 'hold', 'out', 'rest'] as const;
type Breathing = (typeof ORDER)[number];
const KEY: Record<Breathing, keyof Pace> = { in: 'inS', hold: 'holdS', out: 'outS', rest: 'restS' };

export function createGuide(o: { target: Pace; natural: Pace; lengthS: number }) {
  const end = SETTLE_S + o.lengthS;
  // About a third of the session to reach the chosen pace, between 2 and 8 breaths.
  const rampBreaths = Math.max(2, Math.min(8, Math.round(o.lengthS / cycleOf(o.target) / 3)));

  let t = 0;
  let phaseT = 0;
  let phase: GuidePhase = 'settle';
  let breaths = 0;
  let ramp = 0;
  let factor = 1;
  let steady = false;
  const cur: Pace = { ...o.natural };
  // Following: when they last held along, and breaths where they seemed to struggle.
  let touched = false;
  let lastTouch = 0;
  let lastStruggle = -10;
  const state: GuideState = { value: 0, phase, progress: 0 };

  function startBreath() {
    if (t >= end) { phase = 'done'; return; }
    if (breaths > 0) {
      const struggling = breaths - lastStruggle <= 1;
      const stopped = touched && breaths - lastTouch >= 2;
      steady = struggling || stopped;
      if (!steady) ramp = Math.min(1, ramp + 1 / rampBreaths);
    }
    const k = ramp * ramp * (3 - 2 * ramp);
    for (const key of PACE_KEYS) cur[key] = (o.natural[key] + (o.target[key] - o.natural[key]) * k) * factor;
    breaths++;
    phase = 'in';
  }

  function next(p: Breathing): GuidePhase {
    for (let i = ORDER.indexOf(p) + 1; i < ORDER.length; i++) if (cur[KEY[ORDER[i]]] > 0) return ORDER[i];
    startBreath();
    return phase;
  }

  const progressIn = () => (phase === 'settle' || phase === 'done' ? 0 : phaseT / cur[KEY[phase]]);

  return {
    update(dtMs: number): GuideState {
      t += dtMs / 1000;
      if (phase === 'settle') {
        if (t >= SETTLE_S) { phaseT = t - SETTLE_S; startBreath(); }
      } else if (phase !== 'done') {
        phaseT += dtMs / 1000;
        while (phase !== 'done' && phase !== 'settle' && phaseT >= cur[KEY[phase]]) {
          phaseT -= cur[KEY[phase]];
          phase = next(phase);
        }
      }
      const p = progressIn();
      state.phase = phase;
      state.value =
        phase === 'in' ? 0.5 - 0.5 * Math.cos(Math.PI * p)
        : phase === 'hold' ? 1
        : phase === 'out' ? 0.5 + 0.5 * Math.cos(Math.PI * p)
        : 0;
      state.progress = Math.min(1, t / end);
      return state;
    },
    /** They pressed to breathe in along with the light. */
    press() {
      touched = true;
      lastTouch = breaths;
      // Pressing again early in the out-breath: it was longer than felt comfortable.
      if (phase === 'out' && progressIn() < 0.6) lastStruggle = breaths;
    },
    /** They let go. Well before the in-breath ends (or early in a hold): too long for now. */
    release() {
      if ((phase === 'in' && progressIn() < 0.6) || (phase === 'hold' && progressIn() < 0.4)) lastStruggle = breaths;
    },
    slower() { factor = Math.min(FACTOR_RANGE[1], factor * (1 + FACTOR_STEP)); },
    faster() { factor = Math.max(FACTOR_RANGE[0], factor / (1 + FACTOR_STEP)); },
    get factor() { return factor; },
    /** True while the pace is held steady because they seemed to struggle or stopped following. */
    get steady() { return steady; },
    /** Seconds the current phase lasts. */
    get phaseLength() { return phase === 'settle' || phase === 'done' ? 0 : cur[KEY[phase]]; },
  };
}

export type Guide = ReturnType<typeof createGuide>;
