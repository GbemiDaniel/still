/**
 * The first-visit welcome: three short steps, never a gate. "start breathing now" and "skip"
 * are on every step, so the breathing screen is always one tap away. The steps share one grid
 * cell, so the card keeps the height of the tallest and nothing jumps between steps. Focus
 * moves to each step's heading, so a screen reader reads the step as it arrives.
 */
import { COPY } from './content';

const $ = (id: string) => document.getElementById(id)!;

export function createWelcome(opts: {
  /** Show the sheet, putting focus on this element. */
  open: (focus: HTMLElement) => void;
  close: () => void;
  /** They chose to start breathing (as opposed to skip). */
  onStart: () => void;
}) {
  const W = COPY.welcome;
  const box = $('welcome-steps');
  const dots = [...$('welcome-dots').children] as HTMLElement[];
  const back = $('welcome-back') as HTMLButtonElement;
  const next = $('welcome-next') as HTMLButtonElement;

  $('welcome').setAttribute('aria-label', W.label);
  $('welcome-skip').textContent = W.skip;
  back.textContent = W.back;
  next.textContent = W.next;
  $('welcome-start').textContent = W.start;
  $('welcome-notice').textContent = COPY.noticeShort;

  const steps = [W.one, W.two, W.three].map((s, i, all) => {
    const sec = document.createElement('section');
    sec.className = 'step';
    const h = document.createElement('h2');
    h.tabIndex = -1;
    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = W.step(i + 1, all.length);
    h.append(sr, s.title);
    sec.appendChild(h);
    if ('body' in s) {
      for (const t of s.body) {
        const p = document.createElement('p');
        p.textContent = t;
        sec.appendChild(p);
      }
    } else {
      const ul = document.createElement('ul');
      for (const item of s.list) {
        const li = document.createElement('li');
        if (Array.isArray(item)) {
          const b = document.createElement('b');
          b.textContent = item[0];
          li.append(b, ' ', item[1]);
        } else {
          li.textContent = item;
        }
        ul.appendChild(li);
      }
      sec.appendChild(ul);
    }
    box.appendChild(sec);
    return { sec, h };
  });

  // Focus can only land on a visible element, so if the step is still appearing, try once more
  // on the next frame rather than leaving focus behind the sheet.
  function focusHeading(i: number) {
    const h = steps[i].h;
    h.focus({ preventScroll: true });
    if (document.activeElement !== h) requestAnimationFrame(() => h.focus({ preventScroll: true }));
  }

  let at = 0;
  function show(i: number, focus: boolean) {
    at = i;
    steps.forEach(({ sec }, j) => {
      sec.classList.toggle('on', j === i);
      sec.inert = j !== i;
    });
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
    // Hidden, not removed, so the row never shifts.
    back.classList.toggle('gone', i === 0);
    back.inert = i === 0;
    next.classList.toggle('gone', i === steps.length - 1);
    next.inert = i === steps.length - 1;
    if (focus) focusHeading(i);
  }

  back.addEventListener('click', () => show(Math.max(0, at - 1), true));
  next.addEventListener('click', () => show(Math.min(steps.length - 1, at + 1), true));
  $('welcome-skip').addEventListener('click', () => opts.close());
  $('welcome-start').addEventListener('click', () => { opts.close(); opts.onStart(); });

  return {
    open() {
      show(0, false);
      opts.open(steps[0].h);
      if (document.activeElement !== steps[0].h) requestAnimationFrame(() => steps[0].h.focus({ preventScroll: true }));
    },
  };
}
