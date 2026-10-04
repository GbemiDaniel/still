/**
 * The interface and its flow: three modes (free, guided, timer), each with a few scenes.
 * It owns the line of text, the controls and the sheets, and tells the breath what to do.
 * Everything it shows comes from content.ts. The only thing kept is the preferred pace, on
 * this device (store.ts). Nothing is sent anywhere.
 */
import { PRESETS, LENGTHS, DEFAULT_LENGTH, COPY } from './content';
import { guessNatural, samePace, suggestPace, clampPace, half, PACE_KEYS, type Pace } from './pace';
import { loadSaved, savePace, forgetSaved } from './store';
import { createGuide, type Guide, type GuidePhase } from './guide';
import { createFinder, type Finder } from './find';
import { createPaceEditor } from './paceEditor';
import { createTimer, type TimerResult } from './timer';
import { keepAwake, wakeSupported } from './wake';
import { audioSupported } from './engine/audio';
import { vibrate } from './engine/haptics';
import type { Breath, BreathMode } from './breath';
import type { Sound } from './sound';

type View = 'free' | 'guided' | 'timer';
type Scene =
  | 'free'
  | 'guided-setup' | 'guided-find' | 'guided-found' | 'guided-run' | 'guided-end'
  | 'timer-setup' | 'timer-in' | 'timer-hold' | 'timer-out' | 'timer-result';

interface Action { label: string; run: () => void; kind?: 'primary' | 'quiet' }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canVibrate = 'vibrate' in navigator;
// Short phases (half a second of hold, say) would only flicker the line, so it keeps the last word.
const MIN_WORD_S = 1.5;
// Taps on buttons and sheets are for the interface, not for following the breath.
const isUi = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('button, a, input, [role="switch"], [data-ui]');

export function createApp(opts: {
  breath: Breath;
  sound: Sound;
  isCalm: () => boolean;
  /** Tells the host a timed session is running (the quality governor holds still during one). */
  onSession: (active: boolean) => void;
}) {
  const { breath, sound, isCalm, onSession } = opts;

  const ui = $('ui');
  const line = $('line');
  const spans = [...line.querySelectorAll('span')];
  const hint = $('hint');
  const count = $('count');
  const countFace = $('count-face');
  const countText = $('count-text');
  const progress = $('progress');
  const progressBar = progress.firstElementChild as HTMLElement;
  const status = $('status');
  const tabs = $('tabs');
  const actions = $('actions');
  const gear = $('gear');
  const panes = [...document.querySelectorAll<HTMLElement>('.pane')];

  // The preferred pace, from this device if it was saved here before.
  const saved = loadSaved();
  let pace: Pace = saved?.pace ?? { ...PRESETS[0].pace };
  let natural: { inS: number; outS: number } | null = saved?.natural ?? null;
  let lengthIdx = saved && LENGTHS[saved.lengthIdx] ? saved.lengthIdx : DEFAULT_LENGTH;
  let hasSaved = !!saved;
  let suggestion: Pace | null = null;

  let scene: Scene = 'free';
  let guide: Guide | null = null;
  let guidePhase: GuidePhase | '' = '';
  let finder: Finder | null = null;
  const timer = createTimer();
  let awake = wakeSupported;
  let vibe = false;
  let sessionActive = false;
  let dim = 1;
  let dimTarget = 1;
  let lineTimer = 0;
  let hintTimer = 0;
  let hintReady = false;
  let lastCount = '';
  let lastSpoken = -1;
  let lastProgress = -1;

  // ---- The line: two spans cross-fading in one cell ----
  let shown = 0;
  let current = COPY.free.rest;
  function say(text: string) {
    clearTimeout(lineTimer);
    if (text === current) return;
    current = text;
    const prev = spans[shown];
    prev.classList.remove('on');
    if (!text) return;
    const next = spans[1 - shown];
    next.textContent = text;
    next.classList.add('on');
    shown = 1 - shown;
  }
  const sayLater = (text: string, ms: number) => { lineTimer = window.setTimeout(() => say(text), ms); };
  const announce = (text: string) => { status.textContent = text; };

  // ---- The hint: one quiet line under the line ----
  const touch = matchMedia('(pointer: coarse)').matches;
  function showHint(text: string | null, ms = 0) {
    clearTimeout(hintTimer);
    if (!text) { hint.classList.remove('on'); return; }
    hint.textContent = text;
    hint.classList.add('on');
    if (ms) hintTimer = window.setTimeout(() => hint.classList.remove('on'), ms);
  }

  // ---- Static copy ----
  const notice = $('notice');
  const dizzy = document.createElement('span');
  dizzy.className = 'dizzy';
  dizzy.textContent = COPY.dizzy;
  const short = document.createElement('span');
  short.textContent = COPY.noticeShort;
  notice.append(dizzy, short);
  $('notice-long').textContent = `${COPY.noticeLong} ${COPY.dizzy}`;
  $('privacy').textContent = COPY.privacy;
  $('sheet-title').textContent = COPY.options.title;
  gear.setAttribute('aria-label', COPY.options.open);
  $('begin-guided').textContent = COPY.guided.begin;
  $('find-pace').textContent = COPY.pace.find;
  $('begin-timer').textContent = COPY.timer.begin;
  $('timer-note').textContent = COPY.timer.note;
  $('sheet-close').textContent = COPY.options.close;
  $('forget').textContent = COPY.options.forget;
  $('pace-open').setAttribute('aria-label', COPY.pace.open);
  const soundSw = $('sw-sound');
  const vibeSw = $('sw-vibe');
  const awakeSw = $('sw-awake');
  const label = (el: HTMLElement, b: string, i: string) => {
    el.querySelector('b')!.textContent = b;
    el.querySelector('i')!.textContent = i;
  };
  label(soundSw, COPY.options.sound, COPY.options.soundNote);
  label(vibeSw, COPY.options.vibe, COPY.options.vibeNote);
  label(awakeSw, COPY.options.awake, COPY.options.awakeNote);
  if (!audioSupported) soundSw.hidden = true;
  if (!canVibrate) vibeSw.hidden = true;
  if (!wakeSupported) awakeSw.hidden = true;

  // ---- Tabs ----
  const tabButtons = (['free', 'guided', 'timer'] as const).map((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = COPY.tabs[v];
    b.addEventListener('click', () => go(v === 'free' ? 'free' : `${v}-setup`));
    tabs.appendChild(b);
    return b;
  });

  // ---- Guided setup: pace and length ----
  const lengthChips = LENGTHS.map((v, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = COPY.guided.length(v);
    b.addEventListener('click', () => {
      lengthIdx = i;
      paintSetup();
      if (hasSaved) remember();
    });
    $('lengths').appendChild(b);
    return b;
  });
  function paintSetup() {
    const preset = PRESETS.find((p) => samePace(p.pace, pace));
    $('pace-open').querySelector('.name')!.textContent = preset ? preset.name : COPY.pace.yours;
    $('pace-open').querySelector('.detail')!.textContent = COPY.pace.summary(pace);
    lengthChips.forEach((b, i) => b.setAttribute('aria-pressed', String(i === lengthIdx)));
    $('forget').hidden = !hasSaved;
  }
  function remember() {
    savePace({ pace, natural, lengthIdx });
    hasSaved = true;
    paintSetup();
  }
  paintSetup();

  $('begin-guided').addEventListener('click', () => go('guided-run'));
  $('find-pace').addEventListener('click', () => go('guided-find'));
  $('begin-timer').addEventListener('click', () => go('timer-in'));

  // ---- Sheets: options and pace ----
  const anyOpen = () => document.querySelector('.sheet.open');
  function makeSheet(el: HTMLElement, focusEl: HTMLElement) {
    let opener: HTMLElement | null = null;
    const api = {
      open() {
        opener = document.activeElement as HTMLElement | null;
        el.inert = false;
        el.classList.add('open');
        ui.inert = true;
        focusEl.focus({ preventScroll: true });
      },
      close() {
        if (!el.classList.contains('open')) return;
        el.classList.remove('open');
        el.inert = true;
        ui.inert = false;
        (opener ?? gear).focus({ preventScroll: true });
      },
    };
    el.addEventListener('click', (e) => { if (e.target === el) api.close(); });
    return api;
  }
  const options = makeSheet($('sheet'), $('sheet-close'));
  const paceSheet = makeSheet($('pace-sheet'), $('pace-done'));
  gear.addEventListener('click', () => {
    gear.setAttribute('aria-expanded', 'true');
    options.open();
  });
  $('sheet-close').addEventListener('click', () => { options.close(); gear.setAttribute('aria-expanded', 'false'); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !anyOpen()) return;
    options.close();
    paceSheet.close();
    gear.setAttribute('aria-expanded', 'false');
  });

  const editor = createPaceEditor((p) => {
    pace = p;
    paintSetup();
  });
  $('pace-open').addEventListener('click', () => {
    editor.load(pace);
    paceSheet.open();
  });
  // Closing the editor keeps the pace on this device, as the preferred one.
  $('pace-done').addEventListener('click', () => { remember(); paceSheet.close(); });
  $('pace-find').addEventListener('click', () => { paceSheet.close(); go('guided-find'); });

  $('forget').addEventListener('click', () => {
    forgetSaved();
    hasSaved = false;
    pace = { ...PRESETS[0].pace };
    natural = null;
    lengthIdx = DEFAULT_LENGTH;
    paintSetup();
    announce(COPY.options.forgotten);
    $('sheet-close').focus({ preventScroll: true });
  });

  // ---- Actions row (shown while a session runs, and at its end) ----
  function setActions(list: Action[]) {
    actions.classList.remove('on');
    actions.replaceChildren(
      ...list.map((a) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn ${a.kind ?? ''}`;
        b.textContent = a.label;
        b.addEventListener('click', a.run);
        return b;
      }),
    );
    actions.inert = !list.length;
    if (list.length) requestAnimationFrame(() => actions.classList.add('on'));
  }

  // ---- Sessions: wake lock and the quality governor's hold ----
  function session(on: boolean) {
    if (on === sessionActive) return;
    sessionActive = on;
    ui.classList.toggle('running', on);
    keepAwake(on && awake);
    onSession(on);
  }

  // ---- Scenes ----
  function go(next: Scene) {
    const view = next.split('-')[0] as View;
    const was = scene;
    scene = next;
    ui.dataset.scene = next;

    // Which pane and which controls can be reached.
    panes.forEach((p) => {
      const on = p.dataset.pane === next;
      p.classList.toggle('on', on);
      p.inert = !on;
    });
    const showTabs = next === 'free' || next.endsWith('setup');
    tabs.classList.toggle('away', !showTabs);
    tabs.inert = !showTabs;
    tabButtons.forEach((b, i) => b.setAttribute('aria-current', String(['free', 'guided', 'timer'][i] === view)));

    showHint(next === 'free' && hintReady && !breath.holds ? (touch ? COPY.free.hintTouch : COPY.free.hintKey) : null);
    progress.classList.toggle('on', next === 'guided-run');
    count.classList.toggle('on', next === 'guided-find' || next === 'timer-in' || next === 'timer-hold' || next === 'timer-out');
    dimTarget = next === 'guided-end' ? 0.3 : 1;
    sound.setGuided(next === 'guided-run');
    sound.fadeTo(next === 'guided-end' ? 0.35 : 1, next === 'guided-end' ? 6 : 1.5);
    if (was === 'guided-find' && next !== 'guided-found') finder = null;

    switch (next) {
      case 'free':
        session(false);
        breath.drive(null);
        breath.enabled = true;
        say(COPY.free[breath.mode === 'in' ? 'in' : breath.mode === 'out' ? 'out' : 'rest']);
        setActions([]);
        announce('');
        break;

      case 'guided-setup':
        session(false);
        leaveManual();
        paintSetup();
        say('');
        setActions([]);
        break;

      // Hold to breathe in, let go to breathe out, a few times, at their own pace.
      case 'guided-find':
        session(false);
        breath.drive(null);
        breath.enabled = true;
        finder = createFinder();
        paintDots();
        say(COPY.find.line);
        showHint(COPY.find.hint);
        setActions([{ label: COPY.find.cancel, kind: 'quiet', run: () => go('guided-setup') }]);
        announce(COPY.find.started);
        break;

      case 'guided-found': {
        leaveManual();
        const r = finder!.result();
        finder = null;
        suggestion = suggestPace(r.inS, r.outS);
        natural = { inS: half(r.inS), outS: half(r.outS) };
        $('found-note').textContent = COPY.find.natural(natural.inS, natural.outS);
        const L = COPY.find.labels;
        const cell = (lab: string, v: number) => `<div><dt>${lab}</dt><dd>${v}<small>s</small></dd></div>`;
        $('found').innerHTML = cell(L.in, suggestion.inS) + cell(L.out, suggestion.outS) + cell(L.rest, suggestion.restS);
        say(COPY.find.found);
        setActions([
          { label: COPY.find.again, run: () => go('guided-find') },
          { label: COPY.find.use, kind: 'primary', run: () => { pace = suggestion!; remember(); go('guided-setup'); } },
        ]);
        announce(`${COPY.find.natural(natural.inS, natural.outS)} ${COPY.pace.summary(suggestion)} seconds.`);
        break;
      }

      case 'guided-run': {
        const len = LENGTHS[lengthIdx];
        leaveManual();
        // Start from their own measured rhythm if they found it, else a little quicker than the pace.
        const start: Pace = natural
          ? clampPace({ inS: natural.inS, holdS: 0, outS: natural.outS, restS: Math.min(0.5, pace.restS) })
          : guessNatural(pace);
        guide = createGuide({ target: pace, natural: start, lengthS: len });
        guidePhase = '';
        lastProgress = -1;
        session(true);
        say(COPY.guided.settle);
        showHint(COPY.guided.settleHint);
        setActions([
          { label: COPY.guided.slower, kind: 'quiet', run: () => { guide?.slower(); note(COPY.guided.slowerNote); } },
          { label: COPY.guided.end, kind: 'quiet', run: () => go('guided-end') },
          { label: COPY.guided.faster, kind: 'quiet', run: () => { guide?.faster(); note(COPY.guided.fasterNote); } },
        ]);
        announce(COPY.guided.started(pace, len));
        break;
      }

      case 'guided-end':
        session(false);
        // If they settled on slower or faster, that becomes their preferred pace.
        if (guide && Math.abs(guide.factor - 1) > 0.01) {
          const f = guide.factor;
          const scaled = { ...pace };
          for (const k of PACE_KEYS) scaled[k] = pace[k] * f;
          pace = clampPace(scaled);
          remember();
        }
        guide = null;
        followers.clear();
        breath.drive(null);
        say('');
        sayLater(COPY.guided.closing, 1800);
        setActions([
          { label: COPY.guided.again, run: () => go('guided-setup') },
          { label: COPY.guided.done, kind: 'primary', run: () => go('free') },
        ]);
        announce(COPY.guided.closing);
        break;

      case 'timer-setup':
        session(false);
        leaveManual();
        say('');
        setActions([]);
        break;

      case 'timer-in':
        leaveManual();
        session(true);
        timer.begin();
        lastCount = '';
        lastSpoken = -1;
        breath.press();
        say(COPY.timer.in);
        setActions([
          { label: COPY.timer.stop, kind: 'quiet', run: stopTimer },
          { label: COPY.timer.hold, run: () => { timer.next('hold'); go('timer-hold'); } },
          { label: COPY.timer.breatheOut, kind: 'primary', run: () => { timer.next('out'); go('timer-out'); } },
        ]);
        announce(COPY.timer.in);
        break;

      case 'timer-hold':
        say(COPY.timer.holding);
        setActions([
          { label: COPY.timer.stop, kind: 'quiet', run: stopTimer },
          { label: COPY.timer.breatheOut, kind: 'primary', run: () => { timer.next('out'); go('timer-out'); } },
        ]);
        announce(COPY.timer.holding);
        break;

      case 'timer-out':
        breath.letGo(false);
        say(COPY.timer.out);
        setActions([
          { label: COPY.timer.stop, kind: 'quiet', run: stopTimer },
          { label: COPY.timer.done, kind: 'primary', run: () => go('timer-result') },
        ]);
        announce(COPY.timer.out);
        break;

      case 'timer-result': {
        const r = timer.finish();
        session(false);
        breath.letGo(false);
        showResult(r);
        say(COPY.timer.result);
        setActions([
          { label: COPY.timer.again, run: () => go('timer-setup') },
          { label: COPY.timer.close, kind: 'primary', run: () => go('free') },
        ]);
        break;
      }
    }
  }

  // A quiet confirmation under the line that never touches the breath itself.
  function note(text: string) {
    showHint(text, 2600);
    announce(text);
  }

  // Guided and timer modes take the breath off the pointer; a held breath is let go first.
  function leaveManual() {
    breath.enabled = false;
    breath.letGo(false);
  }

  function stopTimer() {
    timer.cancel();
    breath.letGo(false);
    go('timer-setup');
  }

  function showResult(r: TimerResult) {
    const L = COPY.timer.labels;
    const cell = (lab: string, v: number, skipped = false) =>
      `<div><dt>${lab}</dt><dd>${skipped ? '-' : `${v.toFixed(1)}<small>s</small>`}</dd></div>`;
    $('result').innerHTML = cell(L.in, r.in) + cell(L.hold, r.hold, r.hold === 0) + cell(L.out, r.out);
    announce(
      `${L.in} ${r.in.toFixed(1)} seconds. ${r.hold ? `${L.hold} ${r.hold.toFixed(1)} seconds. ` : ''}${L.out} ${r.out.toFixed(1)} seconds.`,
    );
  }

  function paintDots() {
    if (!finder) return;
    const n = finder.needed;
    countFace.className = 'dots';
    countFace.textContent = Array.from({ length: n }, (_, i) => (i < finder!.count ? '●' : '○')).join('');
    countText.textContent = COPY.find.progress(finder.count, n);
  }

  // ---- The breath controller drives free mode and "find my pace" ----
  breath.onChange((mode: BreathMode) => {
    if (scene === 'free') {
      say(COPY.free[mode]);
      // The hint has done its job after the first hold.
      if (mode === 'in') showHint(null);
      return;
    }
    if (scene === 'guided-find' && finder) {
      if (mode === 'in') finder.press();
      else if (mode === 'out') finder.release();
      paintDots();
      if (finder.done) go('guided-found');
    }
  });

  // ---- Holding along during a guided session: it only informs the pace, never the light ----
  const followers = new Set<number>();
  addEventListener('pointerdown', (e) => {
    if (scene !== 'guided-run' || !guide || isUi(e.target)) return;
    if (!followers.size) guide.press();
    followers.add(e.pointerId);
  });
  const up = (e: PointerEvent) => {
    if (!followers.delete(e.pointerId) || followers.size) return;
    guide?.release();
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  // ---- Options ----
  // Sound starts only from this tap, and starts off every time the page loads.
  soundSw.addEventListener('click', () => {
    if (sound.on) {
      sound.disable();
    } else if (!sound.enable()) {
      return;
    }
    soundSw.setAttribute('aria-checked', String(sound.on));
  });
  vibeSw.addEventListener('click', () => {
    vibe = !vibe;
    vibeSw.setAttribute('aria-checked', String(vibe));
    if (vibe) vibrate(16);
  });
  awakeSw.addEventListener('click', () => {
    awake = !awake;
    awakeSw.setAttribute('aria-checked', String(awake));
    keepAwake(sessionActive && awake);
  });

  document.addEventListener('visibilitychange', () => sound.hidden(document.hidden));

  // A mouse click leaves a focus ring behind that would catch the space bar; keyboard use keeps its focus.
  addEventListener('click', (e) => {
    if (e.detail > 0 && e.target instanceof HTMLElement && e.target.closest('#tabs, #actions, .pane')) {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  });

  const PHASE_WORDS: Partial<Record<GuidePhase, string>> = {
    in: COPY.guided.in, hold: COPY.guided.hold, out: COPY.guided.out, rest: COPY.guided.rest,
  };

  go('free');

  return {
    /** Bring the interface in after the light, once fonts are ready. */
    reveal() {
      const calm = isCalm();
      setTimeout(() => line.classList.add('on'), calm ? 600 : 1400);
      setTimeout(() => ui.classList.add('on'), calm ? 1400 : 2200);
      setTimeout(() => {
        hintReady = true;
        if (scene === 'free' && !breath.holds) showHint(touch ? COPY.free.hintTouch : COPY.free.hintKey);
      }, calm ? 2600 : 4200);
    },
    /** True while a timed session runs. */
    get active() { return sessionActive; },
    /** 0..1, how much of the light shows: it softens at the end of a guided session. */
    get dim() { return dim; },
    /** Call once per frame. rawDt is the true frame time in ms. */
    update(dt: number, rawDt: number) {
      if (guide) {
        // Timed on the real clock, so a slow frame never stretches the session.
        const s = guide.update(Math.min(rawDt, 250));
        breath.drive(s.value);
        if (s.phase !== guidePhase) {
          const first = guidePhase === 'settle';
          guidePhase = s.phase;
          if (s.phase === 'done') {
            go('guided-end');
          } else {
            const word = PHASE_WORDS[s.phase];
            if (word && guide.phaseLength >= MIN_WORD_S) say(word);
            if (first) showHint(null);
            // With eyes closed: a light pulse as the breath turns in, a double one as it turns out.
            if (vibe && s.phase === 'in') vibrate(16);
            else if (vibe && s.phase === 'out') vibrate([10, 70, 10]);
          }
        }
        if (guide && s.progress - lastProgress > 0.002) {
          lastProgress = s.progress;
          progressBar.style.transform = `scaleX(${s.progress.toFixed(4)})`;
        }
      }
      if (scene === 'timer-in' || scene === 'timer-hold' || scene === 'timer-out') {
        const e = timer.elapsed;
        const t = e.toFixed(1);
        if (t !== lastCount) {
          lastCount = t;
          // Padded with figure spaces (as wide as a digit) so the readout never shifts, up to 99.9 s.
          countFace.className = '';
          countFace.innerHTML = `${t.padStart(4, ' ')}<small>s</small>`;
        }
        // The text a screen reader finds, refreshed once a second rather than ten times.
        const whole = Math.floor(e);
        if (whole !== lastSpoken) {
          lastSpoken = whole;
          const word = scene === 'timer-in' ? COPY.timer.in : scene === 'timer-hold' ? COPY.timer.holding : COPY.timer.out;
          countText.textContent = COPY.timer.spoken(word, whole);
        }
      }
      // Soft fade out at the end of a guided session, and back when it is left.
      const tau = dimTarget < dim ? 1800 : 700;
      dim += (dimTarget - dim) * (1 - Math.exp(-dt / tau));
      if (Math.abs(dim - dimTarget) < 0.002) dim = dimTarget;
    },
  };
}
