# Still

One warm light that breathes with you. A small, quiet tool for slowing down for a minute: a free mode, a guided breath with a longer breath out than in, and a breath timer. It works offline, installs to the home screen, and keeps nothing.

Still is a breathing guide, not medical advice. If you feel unwell, stop and seek help from a qualified professional.

## Case study

### Who it is for

Someone on their phone who wants a calm minute and does not want to set anything up. Maybe they are between meetings, or cannot settle at night. They do not want an account, a streak, a score or a lecture. They want something that looks as calm as it is supposed to feel, opens instantly even with no signal, and gets out of the way.

That person shapes everything below: one light, very few words, big targets for a tired thumb, and nothing that asks for anything.

### What it is

- **Free.** Press and hold anywhere to breathe in, let go to breathe out. The light swells and settles with a soft spring. Left alone, it breathes by itself.
- **Guided.** The light follows a fixed pace. Three paces, all with a longer breath out than in (4 in and 6 out, 5 and 7, 4 and 8), and sessions of one, three or five minutes. It ends with a slow fade and one quiet line.
- **Timer.** Shows how long you breathed in, held, and breathed out, in seconds. No score, no grade, no label. Then it forgets.

### Decisions

**One light, two shaders, no library.** The whole piece is two full-screen fragment shaders. A 3D library would only have added weight. The script is about 11 KB gzipped, fonts included in the build, nothing fetched from anywhere.

**Quality is never lowered silently.** A governor measures frame time and steps resolution and detail down in four levels, and shows every change with its reason in a debug readout. On a mid-range phone the first decision comes after about 1.5 seconds, so a load-time stall must not read as a slow device: it decides on the median, not the mean, and tries a level back up after a steady 15 seconds, waiting longer each time a step up fails. It holds still during a session, so quality never pops mid-breath.

**Calm motion is its own finished version.** For people who prefer reduced motion, the light moves in a narrower range, the haze is slower, grain holds still, and nothing overshoots. The pace of a guided breath stays the same, because the pace is the point. It was designed to look complete, not stripped back.

**The wording makes no promises.** Nothing says the tool treats, cures, lowers or improves anything. It says what it does: it moves with you at a pace you choose. A short line on screen says it is not medical advice and to seek help if you feel unwell. All wording and paces live in one file (`src/content.ts`) so they are easy to change.

**Sound is a choice, never a surprise.** It starts switched off, every time, and the audio system is not even created until you tap the switch. It is synthesised on the spot: a soft open fifth that brightens as the light rises, and a little air that moves with the breath. No files.

**Nothing is stored or sent.** No accounts, no analytics, no saved settings, no history. The page's security policy only allows its own files, so this is enforced, not just promised. The service worker only caches Still's own files for offline use. The keep-awake option uses the screen wake lock during a session and is released when it ends.

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
