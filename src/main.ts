import '@fontsource/cormorant-garamond/latin-300-italic.css';
import { createGovernor } from './engine/governor';
import { mountDebug } from './engine/debug';
import { subscribe } from './engine/loop';
import { isCalm, onCalmChange } from './engine/motion';
import { createField, type FieldSettings, type FieldFrame } from './field';
import { createBreath } from './breath';
import { createGrain } from './grain';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const line = document.querySelector<HTMLElement>('#line')!;
const hint = document.querySelector<HTMLElement>('#hint')!;

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
});

const field = createField(canvas);
if (!field) document.documentElement.classList.add('no-gl');

let calm = isCalm();
onCalmChange((c) => (calm = c));

const breath = createBreath(() => calm);
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

  field.resize(governor.pixelRatio, governor.settings.hazeScale);
  field.draw(frame, governor.settings);
}

mountDebug(governor);
governor.start();
subscribe((dt) => {
  draw(dt);
  canvas.style.opacity = String(governor.fade);
  grain.update(governor.fade, calm);
});

// The line follows the breath: rest, in, out. Only one phrase is visible at a time.
const phrases = line.querySelectorAll<HTMLElement>('[data-mode]');
breath.onChange((mode) => {
  for (const el of phrases) {
    const on = el.dataset.mode === mode;
    el.classList.toggle('on', on);
    el.setAttribute('aria-hidden', String(!on));
  }
  // The hint has done its job after the first hold.
  if (mode === 'in') hint.classList.remove('on');
});

// The line arrives after the light, once the font is ready; the hint follows if nobody has held yet.
hint.textContent = matchMedia('(pointer: coarse)').matches ? 'touch and hold' : 'press and hold';
document.fonts.ready.then(() => {
  setTimeout(() => line.classList.add('on'), calm ? 600 : 1400);
  setTimeout(() => breath.holds || hint.classList.add('on'), calm ? 2600 : 4200);
});
