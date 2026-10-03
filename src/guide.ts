/**
 * The guided breath: a fixed pace with a longer breath out than in, for a set length.
 * Pure timeline, no DOM. The value is 0 (out) to 1 (in) with a cosine ease, so the light
 * slows at the top and the bottom of each breath like a real one.
 */
import type { Pace } from './content';

export type GuidePhase = 'settle' | 'in' | 'out' | 'done';
export interface GuideState { value: number; phase: GuidePhase; progress: number }

// A short lead-in so the light can find its place before the first breath.
const SETTLE_S = 3;

export function createGuide(pace: Pace, lengthS: number) {
  const cycle = pace.inS + pace.outS;
  const breaths = Math.max(1, Math.round(lengthS / cycle));
  const total = SETTLE_S + breaths * cycle;
  let t = 0;
  const state: GuideState = { value: 0, phase: 'settle', progress: 0 };

  return {
    /** Advance by dt ms and return the shared state object. */
    update(dtMs: number): GuideState {
      t += dtMs / 1000;
      state.progress = Math.min(1, t / total);
      if (t >= total) {
        state.value = 0;
        state.phase = 'done';
      } else if (t < SETTLE_S) {
        state.value = 0;
        state.phase = 'settle';
      } else {
        const c = (t - SETTLE_S) % cycle;
        if (c < pace.inS) {
          state.value = 0.5 - 0.5 * Math.cos((Math.PI * c) / pace.inS);
          state.phase = 'in';
        } else {
          state.value = 0.5 + 0.5 * Math.cos((Math.PI * (c - pace.inS)) / pace.outS);
          state.phase = 'out';
        }
      }
      return state;
    },
  };
}

export type Guide = ReturnType<typeof createGuide>;
