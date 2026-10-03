/**
 * Adaptive quality. The only place quality is ever lowered or raised.
 * Each project passes one table describing what every level changes.
 */
import { subscribe } from './loop';

export type Level = 0 | 1 | 2 | 3;
export const SCALES = [1, 0.85, 0.7, 0.55] as const;

export interface QualityChange {
  from: Level | null;
  to: Level;
  scale: number;
  reason: string;
}

export interface GovernorOptions<T> {
  /** What else each level changes (effect counts, steps, detail). Index = level. */
  levels: readonly [T, T, T, T];
  /** Draw one frame off screen so every shader compiles and every texture uploads. */
  warmup?: () => void;
  /** Fade-in duration in ms. */
  fadeMs?: number;
}

const IGNORE_FRAMES = 30;
const MEASURE_FRAMES = 60;
const WINDOW = 60;

export function createGovernor<T>(opts: GovernorOptions<T>) {
  const fadeMs = opts.fadeMs ?? 1200;
  const listeners = new Set<(c: QualityChange) => void>();
  const param = new URLSearchParams(location.search).get('quality');
  const forced = param !== null && /^[0-3]$/.test(param) ? (Number(param) as Level) : null;

  let level: Level = forced ?? 0;
  let started = false;
  let calibrated = forced !== null;
  let fadeStart = 0;
  let fade = 0;
  let frames = 0;
  const samples: number[] = [];

  const ring = new Float32Array(WINDOW);
  let ringCount = 0;
  let ringIdx = 0;
  let ringSum = 0;
  let slowFor = 0;
  let verySlowFor = 0;
  let fastFor = 0;

  const fmt = (n: number) => String(Math.round(n * 100) / 100);

  function emit(from: Level | null, to: Level, why: string) {
    level = to;
    const scale = SCALES[to];
    const reason = from === null
      ? `${why}, start at level ${to}, scale ${fmt(scale)}`
      : `${why}, level ${from} to ${to}, scale ${fmt(SCALES[from])} to ${fmt(scale)}`;
    const change: QualityChange = { from, to, scale, reason };
    for (const fn of listeners) fn(change);
  }

  function resetWatch() {
    ringCount = ringIdx = ringSum = 0;
    slowFor = verySlowFor = fastFor = 0;
  }

  function calibrate() {
    calibrated = true;
    const n = samples.length;
    const avg = n ? samples.reduce((a, b) => a + b, 0) / n : 16.7;
    const to: Level = avg <= 20 ? 0 : avg <= 26 ? 1 : avg <= 33 ? 2 : 3;
    emit(null, to, `calibration avg ${avg.toFixed(1)} ms over ${n} frames`);
    resetWatch();
  }

  function watch(dt: number) {
    if (ringCount === WINDOW) ringSum -= ring[ringIdx];
    else ringCount++;
    ring[ringIdx] = dt;
    ringSum += dt;
    ringIdx = (ringIdx + 1) % WINDOW;
    if (ringCount < WINDOW) return;
    const avg = ringSum / WINDOW;

    verySlowFor = avg > 33 ? verySlowFor + dt : 0;
    slowFor = avg > 20 ? slowFor + dt : 0;
    fastFor = avg < 12 ? fastFor + dt : 0;

    const step = (delta: number, secs: number) => {
      const to = Math.max(0, Math.min(3, level + delta)) as Level;
      if (to !== level) emit(level, to, `avg ${avg.toFixed(1)} ms over ${secs} s`);
      resetWatch();
    };
    if (verySlowFor >= 1000) step(2, 1);
    else if (slowFor >= 1500) step(1, 1.5);
    else if (fastFor >= 6000) step(-1, 6);
  }

  function tick(_dt: number, time: number, rawDt: number) {
    if (!fadeStart) fadeStart = time;
    fade = Math.min(1, (time - fadeStart) / fadeMs);
    if (!calibrated) {
      frames++;
      if (frames > IGNORE_FRAMES) samples.push(rawDt);
      // Decide on 60 samples, or with what is measured just before the fade completes.
      if (samples.length >= MEASURE_FRAMES || fade >= 0.95) calibrate();
      return;
    }
    if (forced === null && fade >= 1) watch(rawDt);
  }

  return {
    /** Warm up off screen, then begin the fade and measurement. Call once after setup. */
    start() {
      if (started) return;
      started = true;
      opts.warmup?.();
      if (forced !== null) emit(null, forced, `forced by ?quality=${forced}`);
      subscribe(tick);
    },
    get level() { return level; },
    get scale(): number { return SCALES[level]; },
    /** Device pixel ratio times the current resolution scale. */
    get pixelRatio() { return (window.devicePixelRatio || 1) * SCALES[level]; },
    /** The current level's project settings. */
    get settings(): T { return opts.levels[level]; },
    /** 0..1 fade-in progress; drive the canvas opacity with it. */
    get fade() { return fade; },
    get forced() { return forced !== null; },
    onChange(fn: (c: QualityChange) => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}

export type Governor<T = unknown> = ReturnType<typeof createGovernor<T>>;
