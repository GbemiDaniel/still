import { createGovernor } from './engine/governor';
import { mountDebug } from './engine/debug';
import { subscribe } from './engine/loop';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;

// Each project defines what every level changes here, in this one table.
const governor = createGovernor({
  levels: [{}, {}, {}, {}],
  warmup: () => { /* draw one frame off screen */ },
});
mountDebug(governor);
governor.start();
subscribe(() => { canvas.style.opacity = String(governor.fade); });
