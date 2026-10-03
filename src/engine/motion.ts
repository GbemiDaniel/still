/**
 * Calm motion. True when the OS asks for reduced motion (iOS Reduce Motion,
 * Android Remove animations, desktop prefers-reduced-motion) or the URL has ?calm.
 * Calm keeps the piece finished: no parallax or tilt, no flashing or fast flicker,
 * slower easing, and a still, composed hero where continuous motion would distract.
 */
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const forced = new URLSearchParams(location.search).has('calm');
const listeners = new Set<(calm: boolean) => void>();

export function isCalm(): boolean {
  return forced || mq.matches;
}

export function onCalmChange(fn: (calm: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

mq.addEventListener('change', () => {
  const calm = isCalm();
  for (const fn of listeners) fn(calm);
});
