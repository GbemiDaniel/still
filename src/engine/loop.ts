/** Single shared requestAnimationFrame loop. */
export type Tick = (dt: number, time: number, rawDt: number) => void;

const MAX_DT = 50;
const subs = new Set<Tick>();
let raf = 0;
let last = 0;

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  const raw = last ? now - last : 16.7;
  last = now;
  const dt = Math.min(raw, MAX_DT);
  for (const fn of subs) fn(dt, now, raw);
}

function start() {
  if (raf || document.hidden || !subs.size) return;
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
}

document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

/** dt and rawDt are in ms; dt is clamped to 50 ms. Returns an unsubscribe function. */
export function subscribe(fn: Tick): () => void {
  subs.add(fn);
  start();
  return () => {
    subs.delete(fn);
    if (!subs.size) stop();
  };
}
