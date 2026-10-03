/** navigator.vibrate wrapper; a no-op where unsupported. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try { navigator.vibrate(pattern); } catch { /* unsupported */ }
}
