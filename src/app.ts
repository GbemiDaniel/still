/**
 * The interface and its flow: three modes (free, guided, timer), each with a few scenes.
 * It owns the line of text, the controls and the options sheet, and tells the breath what
 * to do. Everything it shows comes from content.ts. Nothing is stored or sent.
 */
import { PACES, LENGTHS, DEFAULT_PACE, DEFAULT_LENGTH, COPY } from './content';
import { createGuide, type Guide } from './guide';
import { createTimer, type TimerResult } from './timer';
import { keepAwake, wakeSupported } from './wake';
import { audioSupported } from './engine/audio';
import type { Breath, BreathMode } from './breath';
import type { Sound } from './sound';

type View = 'free' | 'guided' | 'timer';
type Scene =
  | 'free'
  | 'guided-setup' | 'guided-run' | 'guided-end'
  | 'timer-setup' | 'timer-in' | 'timer-hold' | 'timer-out' | 'timer-result';

interface Action { label: string; run: () => void; kind?: 'primary' | 'quiet' }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

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
  const progress = $('progress');
  const progressBar = progress.firstElementChild as HTMLElement;
  const status = $('status');
  const tabs = $('tabs');
  const actions = $('actions');
  const gear = $('gear');
  const sheet = $('sheet');
  const panes = [...document.querySelectorAll<HTMLElement>('.pane')];

  let scene: Scene = 'free';
  let paceIdx = DEFAULT_PACE;
  let lengthIdx = DEFAULT_LENGTH;
  let guide: Guide | null = null;
  let guidePhase = '';
  const timer = createTimer();
  let awake = wakeSupported;
  let sessionActive = false;
  let dim = 1;
  let dimTarget = 1;
  let lineTimer = 0;
  let hintReady = false;
  let lastCount = '';
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

  // ---- Static copy ----
  const touch = matchMedia('(pointer: coarse)').matches;
  hint.textContent = touch ? COPY.free.hintTouch : COPY.free.hintKey;
  $('notice').textContent = COPY.noticeShort;
  $('notice-long').textContent = COPY.noticeLong;
  $('privacy').textContent = COPY.privacy;
  $('sheet-title').textContent = COPY.options.title;
  gear.setAttribute('aria-label', COPY.options.open);
  $('begin-guided').textContent = COPY.guided.begin;
  $('begin-timer').textContent = COPY.timer.begin;
  $('timer-note').textContent = COPY.timer.note;
  $('sheet-close').textContent = COPY.options.close;
  const soundSw = $('sw-sound');
  const awakeSw = $('sw-awake');
  soundSw.querySelector('b')!.textContent = COPY.options.sound;
  soundSw.querySelector('i')!.textContent = COPY.options.soundNote;
  awakeSw.querySelector('b')!.textContent = COPY.options.awake;
  awakeSw.querySelector('i')!.textContent = COPY.options.awakeNote;
  if (!audioSupported) soundSw.hidden = true;
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
  const paceBox = $('paces');
  const lengthBox = $('lengths');
  const paceChips = PACES.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = `<span></span><small></small>`;
    b.firstElementChild!.textContent = p.name;
    b.lastElementChild!.textContent = COPY.guided.paceDetail(p);
    b.addEventListener('click', () => { paceIdx = i; paintChips(); });
    paceBox.appendChild(b);
    return b;
  });
  const lengthChips = LENGTHS.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = COPY.guided.length(s);
    b.addEventListener('click', () => { lengthIdx = i; paintChips(); });
    lengthBox.appendChild(b);
    return b;
  });
  function paintChips() {
    paceChips.forEach((b, i) => b.setAttribute('aria-pressed', String(i === paceIdx)));
    lengthChips.forEach((b, i) => b.setAttribute('aria-pressed', String(i === lengthIdx)));
  }
  paintChips();

  $('begin-guided').addEventListener('click', () => go('guided-run'));
  $('begin-timer').addEventListener('click', () => go('timer-in'));

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

    hint.classList.toggle('on', next === 'free' && hintReady && !breath.holds);
    progress.classList.toggle('on', next === 'guided-run');
    count.classList.toggle('on', next === 'timer-in' || next === 'timer-hold' || next === 'timer-out');
    dimTarget = next === 'guided-end' ? 0.3 : 1;
    sound.fadeTo(next === 'guided-end' ? 0.35 : 1, next === 'guided-end' ? 6 : 1.5);

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
        say('');
        setActions([]);
        break;

      case 'guided-run': {
        const pace = PACES[paceIdx];
        const len = LENGTHS[lengthIdx];
        leaveManual();
        guide = createGuide(pace, len);
        guidePhase = '';
        lastProgress = -1;
        session(true);
        say(COPY.guided.settle);
        setActions([{ label: COPY.guided.end, kind: 'quiet', run: () => go('guided-end') }]);
        announce(COPY.guided.started(pace, len));
        break;
      }

      case 'guided-end':
        session(false);
        guide = null;
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
    const cell = (label: string, s: number, skipped = false) =>
      `<div><dt>${label}</dt><dd>${skipped ? '-' : `${s.toFixed(1)}<small>s</small>`}</dd></div>`;
    $('result').innerHTML = cell(L.in, r.in) + cell(L.hold, r.hold, r.hold === 0) + cell(L.out, r.out);
    announce(
      `${L.in} ${r.in.toFixed(1)} seconds. ${r.hold ? `${L.hold} ${r.hold.toFixed(1)} seconds. ` : ''}${L.out} ${r.out.toFixed(1)} seconds.`,
    );
  }

  // ---- Free mode follows the breath controller ----
  breath.onChange((mode: BreathMode) => {
    if (scene !== 'free') return;
    say(COPY.free[mode]);
    // The hint has done its job after the first hold.
    if (mode === 'in') hint.classList.remove('on');
  });

  // ---- Options sheet ----
  let opener: HTMLElement | null = null;
  function openSheet() {
    opener = document.activeElement as HTMLElement | null;
    sheet.inert = false;
    sheet.classList.add('open');
    gear.setAttribute('aria-expanded', 'true');
    ui.inert = true;
    $('sheet-close').focus({ preventScroll: true });
  }
  function closeSheet() {
    sheet.classList.remove('open');
    sheet.inert = true;
    ui.inert = false;
    gear.setAttribute('aria-expanded', 'false');
    (opener ?? gear).focus({ preventScroll: true });
  }
  gear.addEventListener('click', openSheet);
  $('sheet-close').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet(); });

  // Sound starts only from this tap, and starts off every time the page loads.
  soundSw.addEventListener('click', () => {
    if (sound.on) {
      sound.disable();
    } else if (!sound.enable()) {
      return;
    }
    soundSw.setAttribute('aria-checked', String(sound.on));
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

  go('free');

  return {
    /** Bring the interface in after the light, once fonts are ready. */
    reveal() {
      const calm = isCalm();
      setTimeout(() => line.classList.add('on'), calm ? 600 : 1400);
      setTimeout(() => ui.classList.add('on'), calm ? 1400 : 2200);
      setTimeout(() => {
        hintReady = true;
        if (scene === 'free' && !breath.holds) hint.classList.add('on');
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
          guidePhase = s.phase;
          if (s.phase === 'in') say(COPY.guided.in);
          else if (s.phase === 'out') say(COPY.guided.out);
          else if (s.phase === 'done') go('guided-end');
        }
        if (s.progress - lastProgress > 0.002) {
          lastProgress = s.progress;
          progressBar.style.transform = `scaleX(${s.progress.toFixed(4)})`;
        }
      }
      if (scene === 'timer-in' || scene === 'timer-hold' || scene === 'timer-out') {
        const t = timer.elapsed.toFixed(1);
        if (t !== lastCount) {
          lastCount = t;
          count.innerHTML = `${t}<small>s</small>`;
        }
      }
      // Soft fade out at the end of a guided session, and back when it is left.
      const tau = dimTarget < dim ? 1800 : 700;
      dim += (dimTarget - dim) * (1 - Math.exp(-dt / tau));
      if (Math.abs(dim - dimTarget) < 0.002) dim = dimTarget;
    },
  };
}
