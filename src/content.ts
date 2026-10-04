/**
 * Every preset and every word the interface shows lives here, so they are easy to change.
 * Keep the wording free of medical claims, never encourage longer holds, and no em-dashes.
 */
import { fmtS, type Pace } from './pace';

export interface Preset { id: string; name: string; pace: Pace }

// Starting points only: anything can be adjusted in half-second steps. No preset holds.
export const PRESETS: readonly Preset[] = [
  { id: 'gentle', name: 'gentle', pace: { inS: 4, holdS: 0, outS: 6, restS: 1 } },
  { id: 'balanced', name: 'balanced', pace: { inS: 5, holdS: 0, outS: 5, restS: 1 } },
  { id: 'longer', name: 'longer out', pace: { inS: 4, holdS: 0, outS: 8, restS: 1 } },
];

/** Session lengths in seconds. A session ends at the end of the breath that crosses it. */
export const LENGTHS: readonly number[] = [60, 180, 300];
export const DEFAULT_LENGTH = 1;

const s = fmtS;

export const COPY = {
  tabs: { free: 'free', guided: 'guided', timer: 'timer' },
  free: {
    rest: 'breathe with the light',
    in: 'breathe in',
    out: 'breathe out',
    hintTouch: 'touch and hold',
    hintKey: 'press and hold',
  },
  pace: {
    title: 'your pace',
    open: 'adjust pace',
    yours: 'yours',
    labels: { inS: 'breathe in', holdS: 'hold', outS: 'breathe out', restS: 'rest' },
    optional: 'optional',
    less: 'less',
    more: 'more',
    seconds: (v: number) => `${s(v)} s`,
    summary: (p: Pace) =>
      [`${s(p.inS)} in`, p.holdS ? `${s(p.holdS)} hold` : '', `${s(p.outS)} out`, p.restS ? `${s(p.restS)} rest` : '']
        .filter(Boolean).join(' · '),
    cycle: (v: number) => `one breath takes ${s(v)} s`,
    find: 'find my pace',
    done: 'done',
  },
  find: {
    line: 'breathe naturally',
    hint: 'hold as you breathe in, let go as you breathe out',
    cancel: 'cancel',
    started: 'Finding your pace. Hold as you breathe in, let go as you breathe out, a few times.',
    found: 'here is a starting point',
    progress: (n: number, of: number) => `${n} of ${of} breaths timed`,
    natural: (i: number, o: number) => `your breath: about ${s(i)} s in, ${s(o)} s out. a starting pace a little slower, with a longer breath out:`,
    labels: { in: 'in', out: 'out', rest: 'rest' },
    again: 'try again',
    use: 'use this',
  },
  guided: {
    lengthLabel: 'length',
    length: (v: number) => `${v / 60} min`,
    begin: 'begin',
    end: 'end',
    slower: 'slower',
    faster: 'faster',
    slowerNote: 'a little slower from the next breath',
    fasterNote: 'a little quicker from the next breath',
    settle: 'follow the light',
    settleHint: 'or hold along with it, if you like',
    in: 'breathe in',
    hold: 'hold',
    out: 'breathe out',
    rest: 'rest',
    closing: 'rest here as long as you like',
    again: 'again',
    done: 'done',
    started: (p: Pace, v: number) =>
      `Guided breathing started, ${v / 60} ${v === 60 ? 'minute' : 'minutes'}. It begins near your own rhythm and eases towards ${COPY.pace.summary(p)} seconds.`,
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
    spoken: (phase: string, secs: number) => `${phase}, ${secs} ${secs === 1 ? 'second' : 'seconds'}`,
    labels: { in: 'in', hold: 'held', out: 'out' },
    again: 'again',
    close: 'done',
  },
  options: {
    title: 'options',
    open: 'options',
    close: 'close',
    sound: 'sound',
    soundNote: 'a soft tone that rises as you breathe in and falls as you breathe out',
    vibe: 'vibration',
    vibeNote: 'a light pulse as each breath turns',
    awake: 'keep screen awake',
    awakeNote: 'during sessions',
    forget: 'forget my pace',
    forgotten: 'Your saved pace has been removed from this device.',
  },
  privacy: 'No accounts. Nothing is sent anywhere. Your pace is kept on this device only. Works offline.',
  dizzy: 'If you feel dizzy or uncomfortable, stop and breathe normally.',
  noticeShort: 'Not medical advice. If you feel unwell, seek help.',
  noticeLong:
    'Still is a breathing guide, not medical advice. If you feel unwell, stop and seek help from a qualified professional.',
};
