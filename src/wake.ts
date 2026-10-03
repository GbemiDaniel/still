/** Keep the screen awake during a session, where the browser allows it. Nothing is stored. */
export const wakeSupported = 'wakeLock' in navigator;

let sentinel: WakeLockSentinel | null = null;
let want = false;

async function acquire() {
  if (!wakeSupported || !want || sentinel || document.hidden) return;
  try {
    const s = await navigator.wakeLock.request('screen');
    if (!want) { void s.release(); return; }
    sentinel = s;
    s.addEventListener('release', () => { if (sentinel === s) sentinel = null; });
  } catch { /* refused, for example on low battery: the screen just sleeps as usual */ }
}

export function keepAwake(on: boolean): void {
  want = on;
  if (on) { void acquire(); return; }
  void sentinel?.release();
  sentinel = null;
}

// The lock is dropped whenever the page is hidden, so take it again on return.
document.addEventListener('visibilitychange', () => { if (!document.hidden) void acquire(); });
