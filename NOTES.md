# Notes

Status: Step 2 built (hold to breathe in, release to breathe out, soft spring, haptic tick on release). Not yet tested on a real phone. Not deployed: no Vercel project is linked yet (see Next).

## What exists
- `src/haze.frag`: pass 1, slow warped fbm haze rendered into a small offscreen buffer.
- `src/field.frag`: pass 2 at full resolution: upsampled haze, the warm light (core, halo, wide falloff), vignette, filmic curve, film grain.
- `src/field.ts`: WebGL2 (WebGL1 fallback) setup, two passes, context loss handling.
- `src/breath.ts`: the breath controller. Pointer (any number of fingers), space or enter to hold; modes rest, in, out; one spring carries the value; idle breath resumes 7 s after a release.
- `src/main.ts`: governor level table, light drift, calm handling, type and hint switching.
- `src/engine/spring.ts`: now takes a damping ratio (zeta). zeta 1 keeps the exact closed form; below 1 uses substepped semi-implicit Euler.
- `src/engine/haptics.ts`: `tick()`: navigator.vibrate(8) on Android, the hidden `<input type="checkbox" switch>` click on iOS Safari 18+, nothing on desktop.
- `index.html`: canvas, the line (three phrases stacked in one grid cell so they cross-fade without shifting), the hint (a separate fixed element below the line, see LCP note), a CSS gradient fallback when WebGL is missing.

## Decisions
- Stack: Vite + TypeScript + raw WebGL, no 3D library. The whole piece is two full-screen fragment shaders, so a library would only add weight. JS is about 4 KB gzipped.
- Two-pass render: the haze is low-frequency, so it renders at half CSS resolution and is upsampled, while light, tone curve and grain stay at native pixel ratio. A single full-resolution pass cost about 62 ms a frame at DPR 3 in the first perf audit.
- Field units: viewport height, capped at 1.6x width, so the light keeps its size on tall portrait phones (it filled 60% of the width at 390x844 without the cap).
- Colours: near-black with a cool violet cast (#050407 page background), light built from ember (1, .36, .10), amber (1, .60, .28) and a warm-white core (1, .90, .76), in linear light through a soft filmic curve. Warm against cool keeps the light the only warm thing on screen.
- Grain: triangular hash noise at device pixels, renewed at 24 fps like film, lighter in highlights. It also dithers banding. Calm mode holds it still.
- Type: Cormorant Garamond Light Italic, self-hosted via @fontsource (latin subset only, about 22 KB woff2). A quiet, high-contrast serif that reads as elegant at one line. Lowercase, slight letter spacing, warm off-white at 84%, placed 17svh above the bottom so the light owns the upper field.
- Copy: "breathe with the light" at rest, "breathe in" while held, "breathe out" after release, back to rest when idle resumes. Hint below it, "touch and hold" (coarse pointer) or "press and hold", fades in about 4 s after load and leaves for good on the first hold. It is the only instruction, so the piece still needs no explanation.
- Breath range: idle breathing stays in the lower 42% (IDLE_DEPTH), so a hold always has somewhere to go. The first visual QA showed holding looked nearly identical to rest because idle already used the full range. The shader range also widened: core radius 0.045 to 0.11, energy 0.7 to 1.4, wide falloff reaching across the field, haze warming up, vignette opening. The light also rises slightly on the in-breath, like a chest.
- Spring feel: inhale omega 1.3, zeta 0.9 (about 3 s to 90%). Exhale omega 0.7, zeta 0.72: longer than the inhale, as a real exhale is, settling with a soft ~4% give below rest. Idle tracking omega 2.5, critically damped. Calm: 0.75x speed and zeta 1, so nothing overshoots, and the breath maps to 0.15 to 0.8.
- Haptic: one 8 ms tick on release only (as briefed). A blur or tab switch mid-breath releases quietly, without a tick. iOS needs the call inside the pointerup handler, so it fires there synchronously.
- Long-press context menus are prevented and `touch-action: none` is on the page, so a held thumb never triggers selection, zoom or menus.
- Idle breath: 10 s cycle (about six breaths a minute, a common slow-breathing pace), cosine eased. Calm: 13 s, narrower range, 0.45x drift speed, still grain.
- Quality levels (governor table in `src/main.ts`, resolution from governor SCALES): L0 haze 0.5x CSS, 5 octaves, warp. L1 4 octaves. L2 haze 0.4x, 3 octaves. L3 haze 0.33x, no warp.
- No WebGL: a CSS radial gradient of the same light, so it still looks intentional.

## Measurements (local preview, 390x844 at DPR 3, 4x CPU, Fast 4G)
- Single pass: calibrated level 1, then 62 ms frames, dropped to level 3 (scale 0.55).
- Two pass: calibrated at 29.7 ms, start and settle at level 2 (scale 0.7), steady 60 fps after, worst frame 33 ms. LCP about 1.4 s, CLS 0.
- Visual QA at 390x844 and 1280x800: field near-black away from the light, clear amber falloff, no blockiness from upsampling, type reads well. Calm looks finished. Faint vertical streaking visible in calm only (still grain over 8-bit haze).

- Step 2 (local preview, 390x844): hold timeline measured from the real breath value at 60 fps: idle 0 to 0.41, held 0.62 at 1 s, 0.97 at 3 s, 1.00 at 4 s; brightness 0.2 field units from the light goes from 44 (rest trough) to 116 (held). Release eases down over about 4 s with a slight dip below rest, then idle resumes 7 s after release.
- Visual QA (step 2): held vs rest clearly different and premium, no blown-out core, no hard edges or banding, hint legible but quiet, calm hold still reads as a breath, no console errors.
- QA caveat: the Playwright window can be throttled to about 1 frame a second when occluded, and emulated reduced motion persists across reloads. Two early QA runs were invalid because of this. Always open a fresh page and confirm about 60 rAF a second first.
- LCP: with the hint inside the line's container, its fade repainted the line at about 5 s and Chrome counted that as LCP. With the hint as its own element, no late entry, the same as step 1. Perf audits that hold with synthetic `dispatchEvent` presses also keep LCP measuring while the phrases change (a real touch stops LCP measurement), so use trusted input (page.mouse or CDP Input) in audits.
- Perf (step 2, 4x CPU, DPR 3): audits were noisy. Calibration read 18.6 ms in one run (level 0, then stepped down to level 3 within 3 s) and 34.5 ms over only 28 frames in another (level 3). The hold only changes uniforms, so this is the same fill cost as step 1, not new work. CLS 0. TBT about 430 ms, mostly startup (shader compile).

## Next
- The governor only steps up when the average is under 12 ms for 6 s, which a 60 Hz vsynced display never reports. Once it steps down it stays down. Decide whether to change that rule in `src/engine/governor.ts`.
- Calibration runs during load (font, first compile) and may read pessimistically. Consider whether to start measuring after fonts are ready.
- Faint streaking in calm mode: try a half-texel dither on the haze sample or a float haze buffer where supported.
- Link a Vercel project to GbemiDaniel/still so pushes to main deploy, then confirm the URL. Still not linked as of step 2: the claude.ai Vercel connector can list projects but gets 403 on the dees-projects scope, and the Vercel CLI is not installed. Fix: import the repo at vercel.com/new (Vite preset, no settings needed), or re-authorize the connector for that team.
- Test step 2 on a real phone: the haptic tick (Android vibrate, iOS 18+ switch trick), long-press behaviour, thumb hold through a full breath, and how the spring feels in the hand.
- The governor settles at level 2 or 3 on the throttled profile and never steps back up (see the first item). Worth fixing before step 3 so a phone that warms up recovers quality.
- Step 3: sound that follows the breath behind a toggle (src/engine/audio.ts is ready), final typography, performance check, case study draft in README.md.
