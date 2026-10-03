/**
 * Corner readout: fps, frame ms, quality level, scale, last change reason.
 * Small, top left, clear of the touch area. One tap collapses it to a dot coloured by
 * quality level, another tap brings it back. Collapsed state is not stored.
 */
import { subscribe } from './loop';
import type { Governor } from './governor';

// Dot colour per level: full quality is green, the lowest is red.
const LEVEL_COLOURS = ['#7fdc9a', '#d6dc7f', '#f0b060', '#f07a6a'];

export function mountDebug<T>(gov: Governor<T>): void {
  gov.onChange((c) => console.info(`[quality] ${c.reason}`));
  const on = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  if (!on) return;

  // A button, so the breath ignores taps on it and it is reachable by keyboard.
  const el = document.createElement('button');
  el.type = 'button';
  el.dataset.ui = '';
  el.setAttribute('aria-label', 'quality readout, tap to collapse');
  el.setAttribute('aria-expanded', 'true');
  el.style.cssText =
    'position:fixed;left:calc(6px + env(safe-area-inset-left));top:calc(6px + env(safe-area-inset-top));z-index:9999;' +
    'margin:0;padding:3px 5px;border:0;border-radius:4px;text-align:left;cursor:pointer;touch-action:manipulation;' +
    'font:9.5px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#cfe;background:rgba(0,0,0,.55);' +
    'white-space:pre-wrap;overflow-wrap:anywhere;max-width:min(46vw,190px);-webkit-user-select:none;user-select:none';

  const text = document.createElement('span');
  const dot = document.createElement('span');
  dot.setAttribute('aria-hidden', 'true');
  dot.style.cssText = 'display:none;width:8px;height:8px;border-radius:50%;margin:4px';
  el.append(text, dot);
  document.body.appendChild(el);

  let collapsed = false;
  const paintDot = () => (dot.style.background = LEVEL_COLOURS[gov.level]);
  el.addEventListener('click', () => {
    collapsed = !collapsed;
    text.style.display = collapsed ? 'none' : '';
    dot.style.display = collapsed ? 'block' : 'none';
    // Collapsed, it is a clear 32 px target holding an 8 px dot, so it stays easy to tap.
    el.style.padding = collapsed ? '8px' : '3px 5px';
    el.style.background = collapsed ? 'transparent' : 'rgba(0,0,0,.55)';
    el.setAttribute('aria-expanded', String(!collapsed));
    el.setAttribute('aria-label', collapsed ? 'quality readout, tap to expand' : 'quality readout, tap to collapse');
    paintDot();
  });

  let reason = '-';
  gov.onChange((c) => {
    reason = c.reason;
    paintDot();
  });

  let acc = 0, n = 0;
  subscribe((_dt, _t, raw) => {
    acc += raw; n++;
    if (acc < 250) return;
    const ms = acc / n;
    acc = n = 0;
    if (collapsed) return;
    text.textContent =
      `${(1000 / ms).toFixed(0)} fps  ${ms.toFixed(1)} ms\n` +
      `level ${gov.level}${gov.forced ? ' (forced)' : ''}  scale ${gov.scale}\n${reason}`;
  });
}
