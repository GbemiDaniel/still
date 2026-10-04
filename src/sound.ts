/**
 * Sound that follows the breath: a soft open fifth that brightens and swells as the light
 * rises, and a little air that moves with the breath. Off until someone turns it on, and
 * the audio context is only created by that tap. Nothing is loaded: it is all synthesised.
 */
import { startAudio, getAudio } from './engine/audio';

const PAD_HZ = [110, 110.35, 164.81, 220];
const PAD_GAIN = [0.5, 0.5, 0.34, 0.12];

interface Graph {
  pad: GainNode;
  lowpass: BiquadFilterNode;
  airGain: GainNode;
  airBand: BiquadFilterNode;
  oscs: OscillatorNode[];
  out: GainNode;
}

function pinkNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  // Fade the loop seam so it never clicks.
  const f = 2048;
  for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[len - 1 - i] *= k; }
  return buf;
}

export function createSound() {
  let g: Graph | null = null;
  let on = false;
  let prev = 0;
  let speed = 0;
  let acc = 0;
  let offTimer = 0;
  let guided = false;

  function build(): Graph | null {
    const a = startAudio();
    if (!a) return null;
    const { ctx, master } = a;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 300;
    lowpass.Q.value = 0.4;
    const pad = ctx.createGain();
    pad.gain.value = 0.05;
    pad.connect(lowpass).connect(out);

    const oscs = PAD_HZ.map((hz, i) => {
      const o = ctx.createOscillator();
      o.type = i === 3 ? 'triangle' : 'sine';
      o.frequency.value = hz;
      const og = ctx.createGain();
      og.gain.value = PAD_GAIN[i];
      o.connect(og).connect(pad);
      o.start();
      return o;
    });

    const air = ctx.createBufferSource();
    air.buffer = pinkNoise(ctx);
    air.loop = true;
    const airBand = ctx.createBiquadFilter();
    airBand.type = 'bandpass';
    airBand.frequency.value = 600;
    airBand.Q.value = 0.6;
    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    air.connect(airBand).connect(airGain).connect(out);
    air.start();

    return { pad, lowpass, airGain, airBand, oscs, out };
  }

  return {
    get on() { return on; },
    /** A guided session: the tone rises and falls clearly with each breath. */
    setGuided(g: boolean) { guided = g; },
    /** Call inside the tap that switches sound on. Returns false if audio is not available. */
    enable(): boolean {
      g ??= build();
      const a = getAudio();
      if (!g || !a) return false;
      clearTimeout(offTimer);
      if (a.ctx.state === 'suspended') void a.ctx.resume();
      on = true;
      g.out.gain.cancelScheduledValues(a.ctx.currentTime);
      g.out.gain.setTargetAtTime(0.9, a.ctx.currentTime, 0.9);
      return true;
    },
    disable() {
      const a = getAudio();
      on = false;
      if (!g || !a) return;
      g.out.gain.setTargetAtTime(0, a.ctx.currentTime, 0.25);
      // Let the fade finish, then stop the audio hardware so it costs nothing.
      offTimer = window.setTimeout(() => { if (!on) void a.ctx.suspend(); }, 1400);
    },
    /** Soften to silence without switching off (the end of a session). */
    fadeTo(level: number, seconds: number) {
      const a = getAudio();
      if (!g || !a || !on) return;
      g.out.gain.setTargetAtTime(0.9 * level, a.ctx.currentTime, seconds / 3);
    },
    /** Follow the breath. Cheap: about 25 parameter updates a second. */
    update(breath: number, dtMs: number) {
      const a = getAudio();
      if (!on || !g || !a) return;
      acc += dtMs;
      if (acc < 40) return;
      const dt = acc / 1000;
      acc = 0;
      speed += ((breath - prev) / dt - speed) * 0.25;
      prev = breath;
      const t = a.ctx.currentTime;
      g.pad.gain.setTargetAtTime(guided ? 0.05 + 0.12 * breath : 0.045 + 0.1 * breath, t, 0.2);
      g.lowpass.frequency.setTargetAtTime(240 + 1150 * breath, t, 0.2);
      g.airBand.frequency.setTargetAtTime(450 + 1100 * breath, t, 0.2);
      // Air moves with the breath: a little more on the way in, a softer one on the way out.
      const air = speed > 0 ? Math.min(1, speed * 1.6) * 0.03 : Math.min(1, -speed * 1.6) * 0.018;
      g.airGain.gain.setTargetAtTime(air, t, 0.2);
      // Pitch rises with the light. In a guided session the rise is wide enough (a little over
      // a whole tone) to follow with eyes closed; free breathing keeps it a slight lift.
      const lift = guided ? 260 : 45;
      for (const o of g.oscs) o.detune.setTargetAtTime(breath * lift, t, guided ? 0.15 : 0.3);
    },
    /** Pause the hardware while the page is hidden; call with document.hidden. */
    hidden(h: boolean) {
      const a = getAudio();
      if (!a || !on) return;
      if (h) void a.ctx.suspend(); else void a.ctx.resume();
    },
  };
}

export type Sound = ReturnType<typeof createSound>;
