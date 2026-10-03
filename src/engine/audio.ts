/** Lazy AudioContext created on the first user gesture, with master gain and mute. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 1;
let muted = false;

function ensure() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

addEventListener('pointerdown', ensure, { once: true, passive: true });
addEventListener('keydown', ensure, { once: true, passive: true });
addEventListener('touchend', ensure, { once: true, passive: true });

function apply() {
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
}

/** Context and master gain, or null until a user gesture has happened. */
export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  return ctx && master ? { ctx, master } : null;
}

export function setVolume(v: number) { volume = Math.max(0, Math.min(1, v)); apply(); }
export function setMuted(m: boolean) { muted = m; apply(); }
export function toggleMute(): boolean { setMuted(!muted); return muted; }
export function isMuted(): boolean { return muted; }
