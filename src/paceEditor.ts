/**
 * The pace editor, inside its sheet: presets as starting points, then breathe in, hold,
 * breathe out and rest, each in half-second steps. The hold can be zero.
 */
import { COPY, PRESETS } from './content';
import { cycleOf, PACE_KEYS, RANGE, STEP, samePace, type Pace, type PaceKey } from './pace';

const $ = (id: string) => document.getElementById(id)!;

export function createPaceEditor(onChange: (p: Pace) => void) {
  let pace: Pace = { ...PRESETS[0].pace };

  $('pace-title').textContent = COPY.pace.title;
  $('pace-dizzy').textContent = COPY.dizzy;
  $('pace-find').textContent = COPY.pace.find;
  $('pace-done').textContent = COPY.pace.done;

  const chips = PRESETS.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = p.name;
    b.addEventListener('click', () => set({ ...p.pace }));
    $('presets').appendChild(b);
    return b;
  });

  const rows = new Map<PaceKey, { out: HTMLOutputElement; less: HTMLButtonElement; more: HTMLButtonElement }>();
  for (const key of PACE_KEYS) {
    const label = COPY.pace.labels[key];
    const box = document.createElement('div');
    box.className = 'stepper';
    box.innerHTML =
      `<span class="lab"></span><span class="ctl"><button type="button" class="less">&minus;</button>` +
      `<output aria-live="polite"></output><button type="button" class="more">+</button></span>`;
    const lab = box.querySelector('.lab')!;
    lab.textContent = label;
    if (key === 'holdS') {
      const opt = document.createElement('i');
      opt.textContent = ` ${COPY.pace.optional}`;
      lab.appendChild(opt);
    }
    const out = box.querySelector('output')!;
    const less = box.querySelector<HTMLButtonElement>('.less')!;
    const more = box.querySelector<HTMLButtonElement>('.more')!;
    less.setAttribute('aria-label', `${COPY.pace.less} ${label}`);
    more.setAttribute('aria-label', `${COPY.pace.more} ${label}`);
    less.addEventListener('click', () => set({ ...pace, [key]: Math.max(RANGE[key][0], pace[key] - STEP) }));
    more.addEventListener('click', () => set({ ...pace, [key]: Math.min(RANGE[key][1], pace[key] + STEP) }));
    rows.set(key, { out, less, more });
    $('steppers').appendChild(box);
  }

  function paint() {
    for (const [key, r] of rows) {
      r.out.textContent = COPY.pace.seconds(pace[key]);
      r.less.disabled = pace[key] <= RANGE[key][0];
      r.more.disabled = pace[key] >= RANGE[key][1];
    }
    PRESETS.forEach((p, i) => chips[i].setAttribute('aria-pressed', String(samePace(p.pace, pace))));
    $('cycle').textContent = COPY.pace.cycle(cycleOf(pace));
  }

  function set(p: Pace) {
    pace = p;
    paint();
    onChange({ ...p });
  }

  return {
    /** Show this pace without reporting a change. */
    load(p: Pace) {
      pace = { ...p };
      paint();
    },
  };
}
