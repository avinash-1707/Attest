// Engraved-curve generators for the "certified instrument" art system.
// Pure math, deterministic (no RNG) — safe to call at module load and on the server.
// A rosette is a circle whose radius ripples with a sine; layering several with a
// rotating phase produces the interlaced guilloche seen on certificates and banknotes.

interface RosetteOpts {
  cx: number;
  cy: number;
  base: number;
  amp: number;
  petals: number;
  phase?: number;
  steps?: number;
}

export function rosette({
  cx,
  cy,
  base,
  amp,
  petals,
  phase = 0,
  steps = 540,
}: RosetteOpts): string {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = base + amp * Math.sin(petals * t + phase);
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2);
  }
  return d + 'Z';
}

// A stack of nested rosettes that drift in radius and phase — one engraved "weave".
export function guillocheStack(opts: {
  cx: number;
  cy: number;
  rings: number;
  innerBase: number;
  ringGap: number;
  amp: number;
  petals: number;
  phaseStep?: number;
}): string[] {
  const { cx, cy, rings, innerBase, ringGap, amp, petals, phaseStep = 0.42 } = opts;
  return Array.from({ length: rings }, (_, i) =>
    rosette({
      cx,
      cy,
      base: innerBase + i * ringGap,
      amp,
      petals,
      phase: i * phaseStep,
    }),
  );
}

// Evenly spaced tick marks around a circle — the instrument-dial scale.
export function dialTicks(opts: {
  cx: number;
  cy: number;
  radius: number;
  count: number;
  minor: number;
  major: number;
  majorEvery?: number;
}): Array<{ x1: number; y1: number; x2: number; y2: number; major: boolean }> {
  const { cx, cy, radius, count, minor, major, majorEvery = 5 } = opts;
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % majorEvery === 0;
    const len = isMajor ? major : minor;
    return {
      x1: +(cx + radius * Math.cos(a)).toFixed(2),
      y1: +(cy + radius * Math.sin(a)).toFixed(2),
      x2: +(cx + (radius - len) * Math.cos(a)).toFixed(2),
      y2: +(cy + (radius - len) * Math.sin(a)).toFixed(2),
      major: isMajor,
    };
  });
}
