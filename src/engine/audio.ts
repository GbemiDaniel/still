/**
 * Lazy AudioContext with a master gain and mute. Nothing is created until `startAudio()`,
 * which must be called from inside a user gesture (a tap on a toggle, say).
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 1;
let muted = false;

/** Create the context on first use and resume it. Call inside a tap or key handler. */
export function startAudio(): { ctx: AudioContext; master: GainNode } | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, master: master! };
}

function apply() {
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
}

/** Context and master gain, or null until `startAudio()` has run. */
export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  return ctx && master ? { ctx, master } : null;
}

export const audioSupported = typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window;

export function setVolume(v: number) { volume = Math.max(0, Math.min(1, v)); apply(); }
export function setMuted(m: boolean) { muted = m; apply(); }
export function toggleMute(): boolean { setMuted(!muted); return muted; }
export function isMuted(): boolean { return muted; }
