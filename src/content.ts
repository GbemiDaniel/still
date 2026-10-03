/**
 * Every pace and every word the interface shows lives here, so they are easy to change.
 * Keep the wording free of medical claims and of em-dashes.
 */

export interface Pace {
  id: string;
  name: string;
  /** Seconds breathing in. */
  inS: number;
  /** Seconds breathing out. Always longer than the in breath. */
  outS: number;
}

// Each pace takes 10 or 12 seconds a breath, so the session lengths below hold a whole
// number of breaths. If you change a pace, the session rounds to the nearest whole breath.
export const PACES: readonly Pace[] = [
  { id: 'easy', name: 'easy', inS: 4, outS: 6 },
  { id: 'slow', name: 'slow', inS: 5, outS: 7 },
  { id: 'long', name: 'long out', inS: 4, outS: 8 },
];
export const DEFAULT_PACE = 0;

/** Session lengths in seconds. */
export const LENGTHS: readonly number[] = [60, 180, 300];
export const DEFAULT_LENGTH = 1;

export const COPY = {
  tabs: { free: 'free', guided: 'guided', timer: 'timer' },
  free: {
    rest: 'breathe with the light',
    in: 'breathe in',
    out: 'breathe out',
    hintTouch: 'touch and hold',
    hintKey: 'press and hold',
  },
  guided: {
    paceLabel: 'pace',
    lengthLabel: 'length',
    paceDetail: (p: Pace) => `${p.inS} in, ${p.outS} out`,
    length: (s: number) => `${s / 60} min`,
    begin: 'begin',
    end: 'end',
    settle: 'settle in',
    in: 'breathe in',
    out: 'breathe out',
    closing: 'rest here as long as you like',
    again: 'again',
    done: 'done',
    started: (p: Pace, s: number) => `Guided breathing started. ${p.name} pace, ${s / 60} ${s === 60 ? 'minute' : 'minutes'}.`,
  },
  timer: {
    note: 'time your own breath. tap begin as you start to breathe in.',
    begin: 'begin',
    stop: 'stop',
    hold: 'hold',
    breatheOut: 'breathe out',
    done: 'done',
    in: 'breathing in',
    holding: 'holding',
    out: 'breathing out',
    result: 'this was one breath',
    labels: { in: 'in', hold: 'held', out: 'out' },
    again: 'again',
    close: 'done',
  },
  options: {
    title: 'options',
    open: 'options',
    close: 'close',
    sound: 'sound',
    soundNote: 'a soft tone that follows your breath',
    awake: 'keep screen awake',
    awakeNote: 'during sessions',
  },
  privacy: 'Nothing is stored or sent. No accounts. Works offline.',
  noticeShort: 'Not medical advice. If you feel unwell, seek help.',
  noticeLong:
    'Still is a breathing guide, not medical advice. If you feel unwell, stop and seek help from a qualified professional.',
};
