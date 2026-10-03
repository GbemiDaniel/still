import '@fontsource/cormorant-garamond/latin-300-italic.css';
import '@fontsource/jost/latin-400.css';
import { createGovernor } from './engine/governor';
import { mountDebug } from './engine/debug';
import { subscribe } from './engine/loop';
import { isCalm, onCalmChange } from './engine/motion';
import { createField, type FieldSettings, type FieldFrame } from './field';
import { createBreath } from './breath';
import { createGrain } from './grain';
import { createSound } from './sound';
import { createApp } from './app';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;

// A timed session holds quality still: a step up mid-breath would show as a small pop.
let inSession = false;

// What every quality level changes. Resolution scale comes from the governor's SCALES.
// Level 0 is full quality: native pixel ratio, five octaves of warped haze in a buffer at
// half CSS resolution (the haze is soft, so this is indistinguishable from full resolution).
const governor = createGovernor<FieldSettings>({
  levels: [
    { hazeScale: 0.5, octaves: 5, warp: true },
    { hazeScale: 0.5, octaves: 4, warp: true },
    { hazeScale: 0.4, octaves: 3, warp: true },
    { hazeScale: 0.33, octaves: 3, warp: false },
  ],
  warmup: () => draw(0),
  fadeMs: 2400,
  canRaise: () => !inSession,
});

const field = createField(canvas);
if (!field) document.documentElement.classList.add('no-gl');

let calm = isCalm();
document.documentElement.classList.toggle('calm', calm);
onCalmChange((c) => {
  calm = c;
  document.documentElement.classList.toggle('calm', c);
});

const breath = createBreath(() => calm);
const sound = createSound();
const app = createApp({ breath, sound, isCalm: () => calm, onSession: (a) => (inSession = a) });
let elapsed = 0;

// The light sits at the exact centre of the viewport and never moves off it: the breath
// only changes its size and energy (radially), and the haze carries the slow motion.
// Any positional drift starts in one direction and reads as off-centre, so there is none.
const frame: FieldFrame = { time: 0, breath: 0, lightX: 0, lightY: 0 };
// Grain lives in its own full device-resolution layer, so the governor's scale never coarsens it.
const grain = createGrain();

function draw(dt: number) {
  if (!field) return;
  const speed = calm ? 0.45 : 1;
  elapsed += (dt / 1000) * speed;

  // Calm keeps the breath in a narrower band, so the light swells without flaring.
  const b = breath.update(dt);
  frame.breath = calm ? 0.15 + 0.65 * b : b;
  frame.time = elapsed;
  sound.update(b, dt);

  field.resize(governor.pixelRatio, governor.settings.hazeScale);
  field.draw(frame, governor.settings);
}

mountDebug(governor);
governor.start();
subscribe((dt, _t, raw) => {
  app.update(dt, raw);
  draw(dt);
  // The light softens at the end of a guided session; opacity is compositor work.
  const o = governor.fade * app.dim;
  canvas.style.opacity = String(o);
  grain.update(o, calm);
});

// The line arrives after the light, once the font is ready, and the controls after it.
document.fonts.ready.then(() => app.reveal());

// Offline and installable: the service worker only caches Still's own files.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
