# Still

One warm light that breathes with you. A small, quiet tool for slowing down for a minute: a free mode, a guided breath that adapts to your own pace, and a breath timer. It works offline, installs to the home screen, and keeps only your preferred pace, on your device.

Still is a breathing guide, not medical advice. If you feel unwell, stop and seek help from a qualified professional. If you feel dizzy or uncomfortable, stop and breathe normally.

## Case study

### Who it is for

Someone on their phone who wants a calm minute and does not want to set anything up. Maybe they are between meetings, or cannot settle at night. They do not want an account, a streak, a score or a lecture. They want something that looks as calm as it is supposed to feel, opens instantly even with no signal, and gets out of the way.

That person shapes everything below: one light, very few words, big targets for a tired thumb, and nothing that asks for anything.

### What it is

- **Free.** Press and hold anywhere to breathe in, let go to breathe out. The light swells and settles with a soft spring. Left alone, it breathes by itself.
- **Guided.** The light follows your pace: breathe in, an optional hold, breathe out and rest, each set in half-second steps. Three presets (gentle, balanced, longer out) are only starting points. Sessions of one, three or five minutes end with a slow fade and one quiet line.
- **Find my pace.** Before a session you can breathe naturally a few times, holding to breathe in and letting go to breathe out. Still times your own in and out and suggests a starting pace a little slower, with a slightly longer out-breath.
- **Ease-in.** A session starts at your natural rhythm and moves towards your pace a step each breath. If you hold along and seem to struggle, or stop holding along, it stays where it is instead of pushing on. Slower and faster buttons change the pace from the next breath, never in the middle of one.
- **Eyes closed.** With sound on, a soft tone rises as you breathe in and falls as you breathe out. With vibration on (where the phone supports it), a light pulse marks each turn of the breath.
- **Timer.** Shows how long you breathed in, held, and breathed out, in seconds. No score, no grade, no label. Then it forgets.

### Decisions

**One light, two shaders, no library.** The whole piece is two full-screen fragment shaders. A 3D library would only have added weight. The script is about 11 KB gzipped, fonts included in the build, nothing fetched from anywhere.

**Quality is never lowered silently.** A governor measures frame time and steps resolution and detail down in four levels, and shows every change with its reason in a debug readout. On a mid-range phone the first decision comes after about 1.5 seconds, so a load-time stall must not read as a slow device: it decides on the median, not the mean, and tries a level back up after a steady 15 seconds, waiting longer each time a step up fails. It holds still during a session, so quality never pops mid-breath.

**Calm motion is its own finished version.** For people who prefer reduced motion, the light moves in a narrower range, the haze is slower, grain holds still, and nothing overshoots. The pace of a guided breath stays the same, because the pace is the point. It was designed to look complete, not stripped back.

**The wording makes no promises.** Nothing says the tool treats, cures, lowers or improves anything. It says what it does: it moves with you at a pace you choose. A short line on screen says it is not medical advice and to seek help if you feel unwell, and in guided mode another says to stop and breathe normally if you feel dizzy or uncomfortable. All wording and presets live in one file (`src/content.ts`) so they are easy to change.

**Sound is a choice, never a surprise.** It starts switched off, every time, and the audio system is not even created until you tap the switch. It is synthesised on the spot: a soft open fifth that brightens as the light rises, and a little air that moves with the breath. No files.

**People differ, so the pace adapts.** A fixed pace suits some people and strains others. Timing someone's own breath first, starting there, and easing towards a slightly slower pace means nobody begins already out of breath. The tool watches for signs it is asking too much (letting go long before the in-breath ends, pressing again early in the out-breath) and holds steady rather than pushing. Holds are optional, capped at four seconds and never suggested: no preset holds, and no wording encourages longer holds.

**Only the pace is kept, and only on your device.** No accounts, no analytics, no history. The preferred pace sits in the browser's local storage on that device and can be removed with "forget my pace". The page's security policy only allows its own files, so this is enforced, not just promised. The service worker only caches Still's own files for offline use. The keep-awake option uses the screen wake lock during a session and is released when it ends.

**Touch first.** Every control is at least 48 px, usually 52 to 56. Text is warm off-white on near-black, well past readable contrast. Hold-anywhere ignores taps on buttons, so the controls and the breath never fight.

**Type.** Cormorant Garamond Light Italic for the voice, because a high-contrast serif at one line reads as quiet and finished. Jost for the tools, because small thin serifs lose contrast on a phone. Steady digits for the timer. Both are self-hosted, latin only, about 32 KB together.

### What I would test next

On a real phone: the haptic tick, a thumb held through a full breath, sound through the speaker and headphones, install from the browser menu, and whether the pace feels right at the end of a long day.

## Run it

```
npm install
npm run dev        # development
npm run build      # type check and build, also writes sw.js
npm run preview    # serve the build with the production security headers
node scripts/make-icons.mjs   # redraw the app icons
```

Add `?debug` for the quality readout, `?quality=0..3` to force a level, `?calm` for the calm version.
