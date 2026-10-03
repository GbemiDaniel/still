import '@fontsource/cormorant-garamond/latin-300-italic.css';
import { createGovernor } from './engine/governor';
import { mountDebug } from './engine/debug';
import { subscribe } from './engine/loop';
import { isCalm, onCalmChange } from './engine/motion';
import { createField, type FieldSettings, type FieldFrame } from './field';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const line = document.querySelector<HTMLElement>('#line')!;

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

// Idle breath until step 2 hands it to the user: about six breaths a minute.
const BREATH_S = 10;
const CALM_BREATH_S = 13;
let phase = 0;
let elapsed = 0;

const frame: FieldFrame = { time: 0, breath: 0, lightX: 0, lightY: 0.07, grainSeed: 0, grain: 0.034 };

function draw(dt: number) {
  if (!field) return;
  const speed = calm ? 0.45 : 1;
  elapsed += (dt / 1000) * speed;
  phase += dt / 1000 / (calm ? CALM_BREATH_S : BREATH_S);

  // Eased breath: slower at the top and bottom, like a real one.
  const s = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  frame.breath = calm ? 0.3 + 0.35 * s : s;
  frame.time = elapsed;
  // Slow Lissajous drift a little above centre, leaving room for the type.
  const amp = calm ? 0.025 : 0.05;
  frame.lightX = amp * Math.sin(elapsed * 0.11);
  frame.lightY = 0.07 + amp * 0.8 * Math.sin(elapsed * 0.083 + 1.3);
  // Grain renews at 24 fps like film; in calm mode it holds still.
  frame.grainSeed = calm ? 1 : Math.floor(performance.now() / (1000 / 24)) % 997;

  field.resize(governor.pixelRatio, governor.settings.hazeScale);
  field.draw(frame, governor.settings);
}

mountDebug(governor);
governor.start();
subscribe((dt) => {
  draw(dt);
  canvas.style.opacity = String(governor.fade);
});

// The line arrives after the light, once the font is ready.
document.fonts.ready.then(() => {
  setTimeout(() => line.classList.add('on'), calm ? 600 : 1400);
});
