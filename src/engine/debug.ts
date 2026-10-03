/** Corner readout: fps, frame ms, quality level, scale, last change reason. */
import { subscribe } from './loop';
import type { Governor } from './governor';

export function mountDebug<T>(gov: Governor<T>): void {
  gov.onChange((c) => console.info(`[quality] ${c.reason}`));
  const on = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  if (!on) return;

  const el = document.createElement('pre');
  el.style.cssText =
    'position:fixed;left:calc(8px + env(safe-area-inset-left));bottom:calc(8px + env(safe-area-inset-bottom));' +
    'margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#cfe;' +
    'background:rgba(0,0,0,.6);border-radius:4px;pointer-events:none;z-index:9999;white-space:pre-wrap;max-width:min(60ch,90vw)';
  document.body.appendChild(el);

  let reason = '-';
  gov.onChange((c) => (reason = c.reason));

  let acc = 0, n = 0;
  subscribe((_dt, _t, raw) => {
    acc += raw; n++;
    if (acc < 250) return;
    const ms = acc / n;
    acc = n = 0;
    el.textContent =
      `fps   ${(1000 / ms).toFixed(0)}\nms    ${ms.toFixed(1)}\n` +
      `level ${gov.level}${gov.forced ? ' (forced)' : ''}\nscale ${gov.scale}\n${reason}`;
  });
}
