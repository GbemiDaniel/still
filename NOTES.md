# Notes

Status: Step 1 built (shader field, light, grain, one line of type, calm version). Not deployed yet: no Vercel project is linked to the repo.

## What exists
- `src/haze.frag`: pass 1, slow warped fbm haze rendered into a small offscreen buffer.
- `src/field.frag`: pass 2 at full resolution: upsampled haze, the warm light (core, halo, wide falloff), vignette, filmic curve, film grain.
- `src/field.ts`: WebGL2 (WebGL1 fallback) setup, two passes, context loss handling.
- `src/main.ts`: governor level table, idle breath, light drift, calm handling, type fade-in.
- `index.html`: canvas, the one line of type, a CSS gradient fallback when WebGL is missing.

## Decisions
- Stack: Vite + TypeScript + raw WebGL, no 3D library. The whole piece is two full-screen fragment shaders, so a library would only add weight. JS is about 4 KB gzipped.
- Two-pass render: the haze is low-frequency, so it renders at half CSS resolution and is upsampled, while light, tone curve and grain stay at native pixel ratio. A single full-resolution pass cost about 62 ms a frame at DPR 3 in the first perf audit.
- Field units: viewport height, capped at 1.6x width, so the light keeps its size on tall portrait phones (it filled 60% of the width at 390x844 without the cap).
- Colours: near-black with a cool violet cast (#050407 page background), light built from ember (1, .36, .10), amber (1, .60, .28) and a warm-white core (1, .90, .76), in linear light through a soft filmic curve. Warm against cool keeps the light the only warm thing on screen.
- Grain: triangular hash noise at device pixels, renewed at 24 fps like film, lighter in highlights. It also dithers banding. Calm mode holds it still.
- Type: Cormorant Garamond Light Italic, self-hosted via @fontsource (latin subset only, about 22 KB woff2). A quiet, high-contrast serif that reads as elegant at one line. Lowercase, slight letter spacing, warm off-white at 84%, placed 17svh above the bottom so the light owns the upper field.
- Copy: "breathe with the light". It is true now (idle breath) and still true once hold-to-breathe arrives.
- Idle breath: 10 s cycle (about six breaths a minute, a common slow-breathing pace), cosine eased. Calm: 13 s, narrower range, half drift speed, still grain.
- Quality levels (governor table in `src/main.ts`, resolution from governor SCALES): L0 haze 0.5x CSS, 5 octaves, warp. L1 4 octaves. L2 haze 0.4x, 3 octaves. L3 haze 0.33x, no warp.
- No WebGL: a CSS radial gradient of the same light, so it still looks intentional.

## Measurements (local preview, 390x844 at DPR 3, 4x CPU, Fast 4G)
- Single pass: calibrated level 1, then 62 ms frames, dropped to level 3 (scale 0.55).
- Two pass: calibrated at 29.7 ms, start and settle at level 2 (scale 0.7), steady 60 fps after, worst frame 33 ms. LCP about 1.4 s, CLS 0.
- Visual QA at 390x844 and 1280x800: field near-black away from the light, clear amber falloff, no blockiness from upsampling, type reads well. Calm looks finished. Faint vertical streaking visible in calm only (still grain over 8-bit haze).

## Next
- The governor only steps up when the average is under 12 ms for 6 s, which a 60 Hz vsynced display never reports. Once it steps down it stays down. Decide whether to change that rule in `src/engine/governor.ts`.
- Calibration runs during load (font, first compile) and may read pessimistically. Consider whether to start measuring after fonts are ready.
- Faint streaking in calm mode: try a half-texel dither on the haze sample or a float haze buffer where supported.
- Link a Vercel project to GbemiDaniel/still so pushes to main deploy, then confirm the URL.
- Step 2: hold anywhere to breathe in, release to breathe out (spring on uBreath), haptic tick on release, test on a real phone.
