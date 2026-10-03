/**
 * The breath timer. Three stopwatches, in order: breathing in, holding, breathing out.
 * It only measures and shows durations. Nothing is scored, graded or kept.
 */
export type TimerPhase = 'idle' | 'in' | 'hold' | 'out';
export interface TimerResult { in: number; hold: number; out: number }

export function createTimer() {
  let phase: TimerPhase = 'idle';
  let t0 = 0;
  const d: TimerResult = { in: 0, hold: 0, out: 0 };
  const now = () => performance.now() / 1000;

  return {
    begin() {
      d.in = d.hold = d.out = 0;
      phase = 'in';
      t0 = now();
    },
    /** End the current phase and start the next. */
    next(to: 'hold' | 'out') {
      if (phase === 'idle' || phase === 'out') return;
      d[phase] = now() - t0;
      phase = to;
      t0 = now();
    },
    finish(): TimerResult {
      if (phase !== 'idle') d[phase] = now() - t0;
      phase = 'idle';
      return { ...d };
    },
    cancel() { phase = 'idle'; },
    /** Seconds in the current phase. */
    get elapsed() { return phase === 'idle' ? 0 : now() - t0; },
    get phase() { return phase; },
  };
}
