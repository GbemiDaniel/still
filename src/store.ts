/**
 * The one thing Still keeps: the preferred pace, in this browser's local storage on this
 * device. No account, never sent anywhere, and "forget my pace" removes it.
 */
import { clampPace, PACE_KEYS, type Pace } from './pace';

const KEY = 'still.pace.v1';

export interface Saved {
  pace: Pace;
  /** The natural in and out someone timed with "find my pace", if they did. */
  natural: { inS: number; outS: number } | null;
  lengthIdx: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Saved>;
    if (!o.pace || !PACE_KEYS.every((k) => isNum(o.pace![k]))) return null;
    const n = o.natural;
    return {
      pace: clampPace(o.pace),
      natural: n && isNum(n.inS) && isNum(n.outS) ? { inS: n.inS, outS: n.outS } : null,
      lengthIdx: isNum(o.lengthIdx) ? o.lengthIdx : -1,
    };
  } catch {
    return null;
  }
}

export function savePace(s: Saved): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode or storage off: keep it for this visit only */ }
}

export function forgetSaved(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
}
