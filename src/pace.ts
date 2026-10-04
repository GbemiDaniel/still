/**
 * A breathing pace: seconds breathing in, holding (optional, can be zero), breathing out,
 * and resting before the next breath. Everything moves in half-second steps.
 */
export interface Pace {
  inS: number;
  holdS: number;
  outS: number;
  restS: number;
}
export type PaceKey = keyof Pace;
export const PACE_KEYS: readonly PaceKey[] = ['inS', 'holdS', 'outS', 'restS'];

// The hold is capped low on purpose: it is there for people who like a pause, not as a goal.
export const RANGE: Record<PaceKey, readonly [number, number]> = {
  inS: [2, 10],
  holdS: [0, 4],
  outS: [2, 14],
  restS: [0, 6],
};
export const STEP = 0.5;

export const half = (s: number) => Math.round(s * 2) / 2;
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

export function clampPace(p: Pace): Pace {
  return {
    inS: clamp(half(p.inS), RANGE.inS),
    holdS: clamp(half(p.holdS), RANGE.holdS),
    outS: clamp(half(p.outS), RANGE.outS),
    restS: clamp(half(p.restS), RANGE.restS),
  };
}

export const cycleOf = (p: Pace) => p.inS + p.holdS + p.outS + p.restS;
export const samePace = (a: Pace, b: Pace) => PACE_KEYS.every((k) => a[k] === b[k]);
export const fmtS = (s: number) => (Number.isInteger(s) ? String(s) : s.toFixed(1));

/**
 * From someone's natural breath, a starting pace a little slower than their own, with an
 * out-breath a little longer than the in-breath. No hold: that stays their choice.
 */
export function suggestPace(naturalIn: number, naturalOut: number): Pace {
  const inS = Math.max(half(naturalIn * 1.1), half(naturalIn) + STEP);
  const outS = Math.max(half(Math.max(naturalOut, inS) * 1.15), inS + 1);
  return clampPace({ inS, holdS: 0, outS, restS: 0.5 });
}

/** When nobody has timed their own breath, start a little quicker than the chosen pace. */
export function guessNatural(target: Pace): Pace {
  return clampPace({ inS: target.inS * 0.8, holdS: 0, outS: target.outS * 0.75, restS: Math.min(0.5, target.restS) });
}
