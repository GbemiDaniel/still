/**
 * Film grain as its own layer above the canvas, at full device resolution whatever the
 * governor does to the canvas's render scale. One noise tile is generated once and shown at
 * one texel per device pixel. Renewing it at 24 fps only moves the layer by whole device
 * pixels with a transform, so it is compositor work: no shader cost and no repaint.
 */
const TILE = 256;
// Peak alpha of a grain speck. 0.02 is about 40% lighter than the step 2 grain (0.034).
const STRENGTH = 0.02;
// Dark specks barely show on a near-black field and would grey the highlights, so they are
// lighter than bright ones, which keeps the grain subtle inside the light.
const DARK = 0.6;
const FILM_FPS = 24;

function noiseTile(): Promise<string> {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(TILE, TILE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // Triangular noise, like the shader grain it replaces: soft, with no hard speckle.
    const n = Math.random() + Math.random() - 1;
    const v = n > 0 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = Math.round(Math.abs(n) * STRENGTH * (n > 0 ? 1 : DARK) * 255);
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((res) => c.toBlob((b) => res(b ? URL.createObjectURL(b) : c.toDataURL())));
}

export function createGrain() {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;left:0;top:0;pointer-events:none;opacity:0;will-change:transform,opacity;' +
    'background-repeat:repeat;image-rendering:pixelated;z-index:1';
  document.body.appendChild(el);

  let dpr = 0;
  // Size in CSS px so one tile texel lands on one device pixel; the layer is one tile larger
  // than the viewport so it can shift by up to a tile without showing an edge.
  function fit() {
    const r = window.devicePixelRatio || 1;
    if (r === dpr) return;
    dpr = r;
    const t = TILE / dpr;
    el.style.backgroundSize = `${t}px ${t}px`;
    el.style.width = `calc(100% + ${t}px)`;
    el.style.height = `calc(100% + ${t}px)`;
  }
  fit();
  addEventListener('resize', fit);
  void noiseTile().then((url) => (el.style.backgroundImage = `url(${url})`));

  let lastFrame = -1;
  let lastOpacity = -1;
  return {
    /** Call once per frame: fade follows the canvas; the grain holds still in calm mode. */
    update(fade: number, calm: boolean) {
      if (fade !== lastOpacity) {
        lastOpacity = fade;
        el.style.opacity = String(fade);
      }
      const f = calm ? 0 : Math.floor(performance.now() / (1000 / FILM_FPS));
      if (f === lastFrame) return;
      lastFrame = f;
      // Whole device pixels only, so the tile is never resampled.
      const x = calm ? 0 : Math.floor(Math.random() * TILE);
      const y = calm ? 0 : Math.floor(Math.random() * TILE);
      el.style.transform = `translate3d(${-x / dpr}px,${-y / dpr}px,0)`;
    },
  };
}
