import { useEffect, useMemo, useRef, useState } from "react";

const IDLE_MIN_MS = 55_000, IDLE_SPREAD_MS = 70_000;
const TWITCHES = ["blink", "slowblink", "aside", "invert", "double"] as const;
// The home eye: the seal's eye on a 64×44 grid, iris as tall as the opening.
const GLYPH = { cx: 32, cy: 22, rx: 9.6, ry: 12 };
const GLYPH_CREASE = "M32 12.5 q6 9.5 0 19";
const GLYPH_FROM = GLYPH.cx - (2 * (GLYPH.ry + 1) + 3);

/**
 * The eye is decoration with a job (§10): it is also the way into the current bag. It twitches
 * only when nothing else is happening — never during a brew, a sheet or a rating — a minute or
 * two apart, under a second, and not at all when the system asks for reduced motion.
 */
export const EyeGlyph = ({ onClick, idle = false }: { onClick?: () => void; idle?: boolean }) => {
  const [twitch, setTwitch] = useState<string | null>(null);
  const sweepA = useRef<SVGAnimateElement>(null);
  const sweepB = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    if (!idle) { setTwitch(null); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let clear = 0;
    const schedule = (): number => window.setTimeout(() => {
      const t = TWITCHES[Math.floor(Math.random() * TWITCHES.length)];
      setTwitch(t);
      // The invert is the seal's sweep at glyph size: a circle crosses the iris and back.
      if (t === "invert") { sweepA.current?.beginElement(); window.setTimeout(() => sweepB.current?.beginElement(), 450); }
      clear = window.setTimeout(() => setTwitch(null), 900);
      next = schedule();
    }, IDLE_MIN_MS + Math.random() * IDLE_SPREAD_MS);
    let next = schedule();
    return () => { window.clearTimeout(next); window.clearTimeout(clear); };
  }, [idle]);
  const sweep = (ref: React.RefObject<SVGAnimateElement | null>) => (
    <animate ref={ref} attributeName="cx" from={GLYPH_FROM} to={GLYPH.cx} dur="0.35s" begin="indefinite" fill="freeze" calcMode="spline" keySplines=".4 0 .2 1" />
  );
  return (
    <button onClick={onClick} aria-label="Bean detail" style={{ padding: 4 }}>
      <svg className={"eye" + (twitch && twitch !== "invert" ? " eye-" + twitch : "")} width="44" height="30" viewBox="0 0 64 44" fill="none" stroke="#c2905e" strokeWidth="2" strokeLinejoin="round">
        <defs>
          <clipPath id="glyph-iris"><ellipse cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} /></clipPath>
          <clipPath id="glyph-a"><circle cy={GLYPH.cy} r={GLYPH.ry + 1} cx={GLYPH_FROM}>{sweep(sweepA)}</circle></clipPath>
          <clipPath id="glyph-b"><circle cy={GLYPH.cy} r={GLYPH.ry + 1} cx={GLYPH_FROM}>{sweep(sweepB)}</circle></clipPath>
        </defs>
        <path d="M2 22 Q32 -2 62 22 Q32 46 2 22 Z" />
        <g className="iris" stroke="none">
          <ellipse cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} fill="#3a2a24" />
          <path d={GLYPH_CREASE} stroke="#c2905e" strokeWidth="1.6" strokeLinecap="round" />
          <g clipPath="url(#glyph-iris)">
            <g clipPath="url(#glyph-a)"><ellipse cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} fill="#c2905e" /><path d={GLYPH_CREASE} stroke="#3a2a24" strokeWidth="1.6" strokeLinecap="round" /></g>
            <g clipPath="url(#glyph-b)"><ellipse cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} fill="#3a2a24" /><path d={GLYPH_CREASE} stroke="#c2905e" strokeWidth="1.6" strokeLinecap="round" /></g>
          </g>
          <ellipse cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} stroke="#c2905e" strokeWidth="1.8" />
        </g>
      </svg>
    </button>
  );
};

export const WheelIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d8a86f" strokeWidth="1.4">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3.2" />
    <line x1="12" y1="2" x2="12" y2="8.8" /><line x1="12" y1="15.2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="8.8" y2="12" /><line x1="15.2" y1="12" x2="22" y2="12" />
    <line x1="5" y1="5" x2="9.6" y2="9.6" /><line x1="14.4" y1="14.4" x2="19" y2="19" />
    <line x1="19" y1="5" x2="14.4" y2="9.6" /><line x1="9.6" y1="14.4" x2="5" y2="19" />
  </svg>
);

export const MicIcon = ({ stroke = "#d8a86f", size = 14, stand = true }: { stroke?: string; size?: number; stand?: boolean }) => (
  <svg width={size} height={Math.round(size * 19 / 14)} viewBox="0 0 18 24" fill="none" stroke={stroke} strokeWidth={stand ? 1.8 : 2}>
    <rect x="5.5" y="1" width="7" height="13" rx="3.5" /><path d="M2 11 a7 7 0 0 0 14 0" /><line x1="9" y1="18" x2="9" y2="22" />
    {stand && <line x1="5" y1="22" x2="13" y2="22" />}
  </svg>
);

export const CameraIcon = () => (
  <svg width="20" height="16" viewBox="0 0 24 20" fill="none" stroke="#d8a86f" strokeWidth="1.6">
    <rect x="1" y="4" width="22" height="15" rx="2" /><circle cx="12" cy="11.5" r="4.5" /><path d="M8 4 L9.5 1 h5 L16 4" />
  </svg>
);

/** The Penrose mark: line construction on a 200 grid, bar 17, corner cut 17/sin60. */
const SEAL_HEX = "M109.82 35 L176.79 151 L166.97 168 L33.03 168 L23.22 151 L90.19 35 Z";
const SEAL_HOLE = "M100 52 L157.16 151 L42.84 151 Z";
const SEAL_TWISTS = "M157.16 151 L166.97 168 M42.84 151 L23.22 151 M100 52 L109.82 35";
const SEAL_LID = "M60 118 Q100 86 140 118 Q100 150 60 118 Z";
const SEAL_CREASE = "M100 104.2 q7.9 13.8 0 27.6";
const IRIS = { cx: 100, cy: 118, rx: 12.64, ry: 15.8 };
const SWEEP_R = IRIS.ry + 1;
const SWEEP_FROM = IRIS.cx - (2 * SWEEP_R + 4);

/**
 * The seal rests dark. Every five to ten seconds a circle sweeps across the iris and inverts what it
 * covers (fill to gold, crease to dark), holds a moment, and a second sweep brings the dark back.
 * The artwork never moves; only the clip does. Drawn once per mount, so the ids stay unique.
 */
export const Seal = () => {
  // One random rest per mount: 5–10 s dark, then 0.6 s in, 0.3 s hold, 0.6 s back.
  const t = useMemo(() => {
    const hold = 5 + Math.random() * 5, total = hold + 1.5;
    const k = (s: number) => (s / total).toFixed(4);
    return { dur: `${total.toFixed(2)}s`, a: `0;${k(hold)};${k(hold + 0.6)};1`, b: `0;${k(hold + 0.9)};1;1` };
  }, []);
  const sweep = (keyTimes: string) => (
    <animate attributeName="cx" values={`${SWEEP_FROM};${SWEEP_FROM};${IRIS.cx};${IRIS.cx}`} keyTimes={keyTimes} dur={t.dur}
      repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;.4 0 .2 1;0 0 1 1" />
  );
  const iris = (fill: string, crease: string) => (
    <>
      <ellipse cx={IRIS.cx} cy={IRIS.cy} rx={IRIS.rx} ry={IRIS.ry} fill={fill} />
      <path d={SEAL_CREASE} fill="none" stroke={crease} strokeWidth="1.35" strokeLinecap="round" />
    </>
  );
  return (
    <svg className="seal" width="230" height="230" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <defs>
        <clipPath id="seal-hole"><path d={SEAL_HOLE} /></clipPath>
        <clipPath id="seal-iris"><ellipse cx={IRIS.cx} cy={IRIS.cy} rx={IRIS.rx} ry={IRIS.ry} /></clipPath>
        <clipPath id="seal-a"><circle cy={IRIS.cy} r={SWEEP_R} cx={SWEEP_FROM}>{sweep(t.a)}</circle></clipPath>
        <clipPath id="seal-b"><circle cy={IRIS.cy} r={SWEEP_R} cx={SWEEP_FROM}>{sweep(t.b)}</circle></clipPath>
      </defs>
      <g stroke="#d8a86f" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d={SEAL_HEX} /><path d={SEAL_HOLE} /><path d={SEAL_TWISTS} />
      </g>
      <g style={{ animation: "bb-spin 26s linear infinite", transformOrigin: "100px 118px" }}>
        <circle cx="100" cy="118" r="26.6" stroke="#d8a86f" strokeOpacity=".9" strokeWidth="1.4" strokeDasharray="5 5" />
      </g>
      <g clipPath="url(#seal-hole)">
        <path d={SEAL_LID} stroke="#d8a86f" strokeWidth="1.8" strokeLinejoin="round" />
        {iris("#3a2a24", "#d8a86f")}
        <g clipPath="url(#seal-iris)">
          <g clipPath="url(#seal-a)">{iris("#d8a86f", "#3a2a24")}</g>
          <g clipPath="url(#seal-b)">{iris("#3a2a24", "#d8a86f")}</g>
        </g>
        <ellipse cx={IRIS.cx} cy={IRIS.cy} rx={IRIS.rx} ry={IRIS.ry} stroke="#d8a86f" strokeWidth="1.45" />
      </g>
    </svg>
  );
};

export const ScanEye = () => (
  <svg width="70" height="50" viewBox="0 0 72 52" fill="none" stroke="#d8a86f" strokeWidth="2" strokeLinejoin="round">
    <path d="M4 26 Q36 0 68 26 Q36 52 4 26 Z" />
    <g style={{ animation: "bb-spin 1.4s linear infinite", transformOrigin: "36px 26px" }}><circle cx="36" cy="26" r="17" strokeWidth="1.4" strokeDasharray="4 5" /></g>
    <ellipse cx="36" cy="26" rx="10" ry="12.5" fill="#3a2a24" />
    <path d="M36 16 q6 10 0 20" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const TicketIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 6h20v4a2 2 0 0 0 0 4v4H2v-4a2 2 0 0 0 0-4V6Z" />
    <line x1="12" y1="8" x2="12" y2="10" /><line x1="12" y1="14" x2="12" y2="16" />
  </svg>
);

export const LibraryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="5" height="18" /><rect x="10" y="3" width="5" height="18" />
    <path d="M17.5 4.2 21.5 5.3 18.8 21.3 15 20.2Z" />
  </svg>
);

export const MapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" /><circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </svg>
);

export const FriendsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="9" cy="8" r="3.4" /><path d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8" />
    <path d="M16 5.2a3.4 3.4 0 0 1 0 6.4M17.5 14.6c2.4.5 4 2.5 4 5.4" />
  </svg>
);
