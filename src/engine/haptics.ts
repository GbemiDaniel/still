/** navigator.vibrate wrapper; a no-op where unsupported. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try { navigator.vibrate(pattern); } catch { /* unsupported */ }
}

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
const coarse = matchMedia('(pointer: coarse)').matches;

/**
 * One light haptic tick. Call it synchronously inside a user gesture handler
 * (pointerup, touchend, click, keydown), or iOS ignores it.
 * Android: navigator.vibrate. iOS Safari 18+ has no vibrate, but toggling an
 * `<input type="checkbox" switch>` plays the system selection haptic, so a hidden
 * one is clicked. Elsewhere (desktop, older iOS) it does nothing.
 */
export function tick(): void {
  if (canVibrate) { vibrate(8); return; }
  if (!coarse) return;
  try {
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch { /* unsupported */ }
}
