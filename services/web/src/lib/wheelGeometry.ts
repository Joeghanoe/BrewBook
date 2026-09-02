// The nine-wedge wheel's geometry, shared by the tagging sheet and the passport so both draw the same wheel.

export const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};

/** SVG path for the ring sector between radii ro/ri and angles a0..a1 (degrees, clockwise from 3 o'clock). */
export const annular = (cx: number, cy: number, ro: number, ri: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, ro, a0), [x1, y1] = polar(cx, cy, ro, a1);
  const [x2, y2] = polar(cx, cy, ri, a1), [x3, y3] = polar(cx, cy, ri, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${ro} ${ro} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} A ${ri} ${ri} 0 ${large} 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z`;
};

/** The full wheel: centre, outer and inner radius, and the SVG frame it sits in. */
export const WHEEL_GEOMETRY = { cx: 170, cy: 170, ro: 160, ri: 62, size: 330, viewBox: "-6 -6 352 352" } as const;

/** Wedge i of n, starting at 12 o'clock and going clockwise. */
export const wedgeAngles = (i: number, n: number) => {
  const step = 360 / n;
  const a0 = -90 + i * step;
  return { a0, a1: a0 + step, mid: a0 + step / 2, step };
};
