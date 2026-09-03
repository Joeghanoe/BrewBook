import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import { useSpinTransform } from "./Anim";

const AG = Animated.createAnimatedComponent(G);

const IDLE_MIN_MS = 55_000, IDLE_SPREAD_MS = 70_000;
const TWITCHES = ["blink", "slowblink", "aside", "invert", "double"] as const;
type Twitch = (typeof TWITCHES)[number];
// The home eye: the seal's eye on a 64×44 grid, iris as tall as the opening. Mirror of web.
const GLYPH = { cx: 32, cy: 22, rx: 9.6, ry: 12 };
const GLYPH_CREASE = "M32 12.5 q6 9.5 0 19";
const GLYPH_FROM = GLYPH.cx - (2 * (GLYPH.ry + 1) + 3);

/**
 * The eye is decoration with a job (§10): it is also the way into the current bag. It twitches
 * only when nothing else is happening — never during a brew, a sheet or a rating — a minute or
 * two apart, under a second, and not at all when the system asks for reduced motion.
 */
export const EyeGlyph = ({ onPress, idle = false }: { onPress?: () => void; idle?: boolean }) => {
  const squeeze = useRef(new Animated.Value(1)).current;
  const aside = useRef(new Animated.Value(0)).current;
  const [mask, setMask] = useState({ a: GLYPH_FROM, b: GLYPH_FROM });
  useEffect(() => {
    if (!idle) return;
    let cancelled = false;
    let next: ReturnType<typeof setTimeout> | null = null;
    let frame = 0;
    const blink = (ms: number, times = 1) => Animated.loop(Animated.sequence([
      Animated.timing(squeeze, { toValue: 0.06, duration: ms * 0.45, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(squeeze, { toValue: 1, duration: ms * 0.55, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]), { iterations: times }).start();
    // The invert is the seal's sweep at glyph size: a circle crosses the iris and back.
    const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const sweep = (key: "a" | "b", done: () => void) => {
      const started = Date.now();
      const step = () => {
        if (cancelled) return;
        const x = Math.min(1, (Date.now() - started) / 350);
        setMask((m) => ({ ...m, [key]: GLYPH_FROM + (GLYPH.cx - GLYPH_FROM) * ease(x) }));
        if (x < 1) frame = requestAnimationFrame(step); else done();
      };
      frame = requestAnimationFrame(step);
    };
    const play = (t: Twitch) => {
      if (t === "blink") blink(340);
      else if (t === "slowblink") blink(850);
      else if (t === "double") blink(280, 2);
      else if (t === "aside") Animated.sequence([
        Animated.timing(aside, { toValue: 9, duration: 315, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.delay(270),
        Animated.timing(aside, { toValue: 0, duration: 315, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]).start();
      else sweep("a", () => { next = setTimeout(() => sweep("b", () => setMask({ a: GLYPH_FROM, b: GLYPH_FROM })), 100); });
    };
    const schedule = () => {
      next = setTimeout(() => {
        if (cancelled) return;
        play(TWITCHES[Math.floor(Math.random() * TWITCHES.length)]);
        schedule();
      }, IDLE_MIN_MS + Math.random() * IDLE_SPREAD_MS);
    };
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => { if (!reduce && !cancelled) schedule(); }).catch(() => schedule());
    return () => { cancelled = true; if (next) clearTimeout(next); cancelAnimationFrame(frame); squeeze.setValue(1); aside.setValue(0); setMask({ a: GLYPH_FROM, b: GLYPH_FROM }); };
  }, [idle, squeeze, aside]);
  const iris = (fill: string, crease: string) => (
    <>
      <Ellipse cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} fill={fill} />
      <Path d={GLYPH_CREASE} fill="none" stroke={crease} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
  return (
    <Pressable onPress={onPress} accessibilityLabel="Bean detail" style={{ padding: 4 }}>
      <Animated.View style={{ transform: [{ scaleY: squeeze }] }}>
        <Svg width={44} height={30} viewBox="0 0 64 44" fill="none" stroke="#c2905e" strokeWidth={2} strokeLinejoin="round">
          <Defs>
            <ClipPath id="glyph-iris"><Ellipse cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} /></ClipPath>
            <ClipPath id="glyph-a"><Circle cy={GLYPH.cy} r={GLYPH.ry + 1} cx={mask.a} /></ClipPath>
            <ClipPath id="glyph-b"><Circle cy={GLYPH.cy} r={GLYPH.ry + 1} cx={mask.b} /></ClipPath>
          </Defs>
          <Path d="M2 22 Q32 -2 62 22 Q32 46 2 22 Z" />
          <AG translateX={aside} stroke="none">
            {iris("#3a2a24", "#c2905e")}
            <G clipPath="url(#glyph-iris)">
              <G clipPath="url(#glyph-a)">{iris("#c2905e", "#3a2a24")}</G>
              <G clipPath="url(#glyph-b)">{iris("#3a2a24", "#c2905e")}</G>
            </G>
            <Ellipse cx={GLYPH.cx} cy={GLYPH.cy} rx={GLYPH.rx} ry={GLYPH.ry} stroke="#c2905e" strokeWidth={1.8} />
          </AG>
        </Svg>
      </Animated.View>
    </Pressable>
  );
};

export const WheelIcon = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#d8a86f" strokeWidth={1.4}>
    <Circle cx={12} cy={12} r={10} /><Circle cx={12} cy={12} r={3.2} />
    <Line x1={12} y1={2} x2={12} y2={8.8} /><Line x1={12} y1={15.2} x2={12} y2={22} />
    <Line x1={2} y1={12} x2={8.8} y2={12} /><Line x1={15.2} y1={12} x2={22} y2={12} />
    <Line x1={5} y1={5} x2={9.6} y2={9.6} /><Line x1={14.4} y1={14.4} x2={19} y2={19} />
    <Line x1={19} y1={5} x2={14.4} y2={9.6} /><Line x1={9.6} y1={14.4} x2={5} y2={19} />
  </Svg>
);

export const MicIcon = ({ stroke = "#d8a86f", size = 14, stand = true }: { stroke?: string; size?: number; stand?: boolean }) => (
  <Svg width={size} height={Math.round(size * 19 / 14)} viewBox="0 0 18 24" fill="none" stroke={stroke} strokeWidth={stand ? 1.8 : 2}>
    <Rect x={5.5} y={1} width={7} height={13} rx={3.5} /><Path d="M2 11 a7 7 0 0 0 14 0" /><Line x1={9} y1={18} x2={9} y2={22} />
    {stand && <Line x1={5} y1={22} x2={13} y2={22} />}
  </Svg>
);

export const CameraIcon = () => (
  <Svg width={20} height={16} viewBox="0 0 24 20" fill="none" stroke="#d8a86f" strokeWidth={1.6}>
    <Rect x={1} y={4} width={22} height={15} rx={2} /><Circle cx={12} cy={11.5} r={4.5} /><Path d="M8 4 L9.5 1 h5 L16 4" />
  </Svg>
);

/** The Penrose mark: line construction on a 200 grid, bar 17, corner cut 17/sin60. Mirror of web. */
const SEAL_HEX = "M109.82 35 L176.79 151 L166.97 168 L33.03 168 L23.22 151 L90.19 35 Z";
const SEAL_HOLE = "M100 52 L157.16 151 L42.84 151 Z";
const SEAL_TWISTS = "M157.16 151 L166.97 168 M42.84 151 L23.22 151 M100 52 L109.82 35";
const SEAL_LID = "M60 118 Q100 86 140 118 Q100 150 60 118 Z";
const SEAL_CREASE = "M100 104.2 q7.9 13.8 0 27.6";
const IRIS = { cx: 100, cy: 118, rx: 12.64, ry: 15.8 };
const SWEEP_R = IRIS.ry + 1;
const SWEEP_FROM = IRIS.cx - (2 * SWEEP_R + 4);
const SWEEP_MS = 600, SWEEP_HOLD_MS = 300;

/**
 * The seal rests dark. Every five to ten seconds a circle sweeps across the iris and inverts what it
 * covers (fill to gold, crease to dark), holds a moment, and a second sweep brings the dark back.
 * The artwork never moves; only the clip does. The clip circles are driven from a frame loop
 * because animated props do not reach a ClipPath child reliably.
 */
const AP = Animated.createAnimatedComponent(Path);
// Path lengths of the seal's three line groups, for the draw-in.
const SEAL_LEN = { hex: 461, hole: 343, twists: 59 };

/** `draw` makes the Penrose lines draw themselves once on mount, for the splash. The eye is untouched. */
export const Seal = ({ scale = 1, draw = false }: { scale?: number; draw?: boolean }) => {
  const spin = useSpinTransform(26_000, 100, 118);
  const drawn = useRef({ hex: new Animated.Value(draw ? 0 : 1), hole: new Animated.Value(draw ? 0 : 1), twists: new Animated.Value(draw ? 0 : 1) }).current;
  useEffect(() => {
    if (!draw) return;
    let cancelled = false;
    const run = (v: Animated.Value, duration: number, delay: number) => Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) { drawn.hex.setValue(1); drawn.hole.setValue(1); drawn.twists.setValue(1); return; }
      Animated.parallel([run(drawn.hex, 1400, 0), run(drawn.hole, 1400, 450), run(drawn.twists, 600, 850)]).start();
    }).catch(() => Animated.parallel([run(drawn.hex, 1400, 0), run(drawn.hole, 1400, 450), run(drawn.twists, 600, 850)]).start());
    return () => { cancelled = true; };
  }, [draw, drawn]);
  const offset = (v: Animated.Value, len: number) => v.interpolate({ inputRange: [0, 1], outputRange: [len, 0] });
  const [mask, setMask] = useState({ a: SWEEP_FROM, b: SWEEP_FROM });
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frame = 0;
    const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const at = (x: number) => SWEEP_FROM + (IRIS.cx - SWEEP_FROM) * ease(Math.min(1, x));
    const sweep = (key: "a" | "b", done: () => void) => {
      const started = Date.now();
      const step = () => {
        if (cancelled) return;
        const x = (Date.now() - started) / SWEEP_MS;
        setMask((m) => ({ ...m, [key]: at(x) }));
        if (x < 1) frame = requestAnimationFrame(step); else done();
      };
      frame = requestAnimationFrame(step);
    };
    const rest = () => {
      timer = setTimeout(() => sweep("a", () => {
        timer = setTimeout(() => sweep("b", () => { setMask({ a: SWEEP_FROM, b: SWEEP_FROM }); rest(); }), SWEEP_HOLD_MS);
      }), 5000 + Math.random() * 5000);
    };
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => { if (!reduce && !cancelled) rest(); }).catch(() => rest());
    return () => { cancelled = true; if (timer) clearTimeout(timer); cancelAnimationFrame(frame); };
  }, []);
  const iris = (fill: string, crease: string) => (
    <>
      <Ellipse cx={IRIS.cx} cy={IRIS.cy} rx={IRIS.rx} ry={IRIS.ry} fill={fill} />
      <Path d={SEAL_CREASE} fill="none" stroke={crease} strokeWidth={1.35} strokeLinecap="round" />
    </>
  );
  return (
    <Svg width={230 * scale} height={230 * scale} viewBox="0 0 200 200" fill="none">
      <Defs>
        <ClipPath id="seal-hole"><Path d={SEAL_HOLE} /></ClipPath>
        <ClipPath id="seal-iris"><Ellipse cx={IRIS.cx} cy={IRIS.cy} rx={IRIS.rx} ry={IRIS.ry} /></ClipPath>
        <ClipPath id="seal-a"><Circle cy={IRIS.cy} r={SWEEP_R} cx={mask.a} /></ClipPath>
        <ClipPath id="seal-b"><Circle cy={IRIS.cy} r={SWEEP_R} cx={mask.b} /></ClipPath>
      </Defs>
      <G stroke="#d8a86f" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
        <AP d={SEAL_HEX} strokeDasharray={SEAL_LEN.hex} strokeDashoffset={offset(drawn.hex, SEAL_LEN.hex)} />
        <AP d={SEAL_HOLE} strokeDasharray={SEAL_LEN.hole} strokeDashoffset={offset(drawn.hole, SEAL_LEN.hole)} />
        <AP d={SEAL_TWISTS} strokeDasharray={SEAL_LEN.twists} strokeDashoffset={offset(drawn.twists, SEAL_LEN.twists)} />
      </G>
      <AG transform={spin}>
        <Circle cx={100} cy={118} r={26.6} stroke="#d8a86f" strokeOpacity={0.9} strokeWidth={1.4} strokeDasharray="5 5" />
      </AG>
      <G clipPath="url(#seal-hole)">
        <Path d={SEAL_LID} stroke="#d8a86f" strokeWidth={1.8} strokeLinejoin="round" />
        {iris("#3a2a24", "#d8a86f")}
        <G clipPath="url(#seal-iris)">
          <G clipPath="url(#seal-a)">{iris("#d8a86f", "#3a2a24")}</G>
          <G clipPath="url(#seal-b)">{iris("#3a2a24", "#d8a86f")}</G>
        </G>
        <Ellipse cx={IRIS.cx} cy={IRIS.cy} rx={IRIS.rx} ry={IRIS.ry} stroke="#d8a86f" strokeWidth={1.45} />
      </G>
    </Svg>
  );
};

export const ScanEye = () => {
  const spin = useSpinTransform(1400, 36, 26);
  return (
    <Svg width={70} height={50} viewBox="0 0 72 52" fill="none" stroke="#d8a86f" strokeWidth={2} strokeLinejoin="round">
      <Path d="M4 26 Q36 0 68 26 Q36 52 4 26 Z" />
      <AG transform={spin}><Circle cx={36} cy={26} r={17} strokeWidth={1.4} strokeDasharray="4 5" /></AG>
      <Ellipse cx={36} cy={26} rx={10} ry={12.5} fill="#3a2a24" />
      <Path d="M36 16 q6 10 0 20" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
};

const tab = (color: string) => ({ width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.5 });

export const TicketIcon = ({ color }: { color: string }) => (
  <Svg {...tab(color)}>
    <Path d="M2 6h20v4a2 2 0 0 0 0 4v4H2v-4a2 2 0 0 0 0-4V6Z" />
    <Line x1={12} y1={8} x2={12} y2={10} /><Line x1={12} y1={14} x2={12} y2={16} />
  </Svg>
);

export const LibraryIcon = ({ color }: { color: string }) => (
  <Svg {...tab(color)}>
    <Rect x={3} y={3} width={5} height={18} /><Rect x={10} y={3} width={5} height={18} />
    <Path d="M17.5 4.2 21.5 5.3 18.8 21.3 15 20.2Z" />
  </Svg>
);

export const MapIcon = ({ color }: { color: string }) => (
  <Svg {...tab(color)}>
    <Path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" /><Circle cx={12} cy={10} r={2.6} />
  </Svg>
);

export const ProfileIcon = ({ color }: { color: string }) => (
  <Svg {...tab(color)}>
    <Circle cx={12} cy={8} r={4} /><Path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </Svg>
);

export const FriendsIcon = ({ color }: { color: string }) => (
  <Svg {...tab(color)}>
    <Circle cx={9} cy={8} r={3.4} /><Path d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8" />
    <Path d="M16 5.2a3.4 3.4 0 0 1 0 6.4M17.5 14.6c2.4.5 4 2.5 4 5.4" />
  </Svg>
);
