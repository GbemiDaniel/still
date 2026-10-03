/** Unified pointer tracking. Position is 0..1 of the viewport; velocity in units per second. */
export interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  down: boolean;
}

export const pointer: PointerState = { x: 0.5, y: 0.5, vx: 0, vy: 0, down: false };

let lastT = 0;

function move(e: PointerEvent) {
  const x = e.clientX / innerWidth;
  const y = e.clientY / innerHeight;
  const dt = (e.timeStamp - lastT) / 1000;
  if (lastT && dt > 0) {
    pointer.vx = (x - pointer.x) / dt;
    pointer.vy = (y - pointer.y) / dt;
  }
  lastT = e.timeStamp;
  pointer.x = x;
  pointer.y = y;
}

function release() {
  pointer.down = false;
  pointer.vx = pointer.vy = 0;
}

addEventListener('pointermove', move, { passive: true });
addEventListener('pointerdown', (e) => { lastT = 0; move(e); pointer.down = true; }, { passive: true });
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
addEventListener('blur', release);

/** Call once per frame so velocity settles when the pointer stops. */
export function decayVelocity(dtMs: number) {
  const k = Math.exp(-dtMs / 100);
  pointer.vx *= k;
  pointer.vy *= k;
}
