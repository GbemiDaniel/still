/**
 * "Find my pace": times someone's natural breath while they hold to breathe in and let go
 * to breathe out. One breath counts once the next press closes its out-breath. Taps and
 * very long holds are ignored, and the median keeps one odd breath from skewing the result.
 */
const IN_RANGE = [1, 15] as const;
const OUT_RANGE = [1, 20] as const;

const median = (a: number[]) => {
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function createFinder(needed = 4) {
  const ins: number[] = [];
  const outs: number[] = [];
  let pressAt = 0;
  let releaseAt = 0;
  let pendingIn: number | null = null;
  const now = () => performance.now() / 1000;

  return {
    needed,
    press() {
      const t = now();
      if (pendingIn !== null && releaseAt) {
        const out = t - releaseAt;
        if (out >= OUT_RANGE[0] && out <= OUT_RANGE[1]) {
          ins.push(pendingIn);
          outs.push(out);
        }
      }
      pendingIn = null;
      releaseAt = 0;
      pressAt = t;
    },
    release() {
      if (!pressAt) return;
      const t = now();
      const d = t - pressAt;
      pressAt = 0;
      const ok = d >= IN_RANGE[0] && d <= IN_RANGE[1];
      pendingIn = ok ? d : null;
      releaseAt = ok ? t : 0;
    },
    get count() { return ins.length; },
    get done() { return ins.length >= needed; },
    /** Median natural in and out, in seconds. */
    result() { return { inS: median(ins), outS: median(outs) }; },
  };
}

export type Finder = ReturnType<typeof createFinder>;
