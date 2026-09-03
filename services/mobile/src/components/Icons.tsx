import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import { useBlink, useSpin } from "./Anim";

const AG = Animated.createAnimatedComponent(G);

const IDLE_MIN_MS = 55_000, IDLE_SPREAD_MS = 70_000;
const TWITCHES = ["blink", "slowblink", "aside", "invert", "double"] as const;
type Twitch = (typeof TWITCHES)[number];

/**
 * The eye is decoration with a job (§10): it is also the way into the current bag. It twitches
 * only when nothing else is happening — never during a brew, a sheet or a rating — a minute or
 * two apart, under a second, and not at all when the system asks for reduced motion.
 */
export const EyeGlyph = ({ onPress, idle = false }: { onPress?: () => void; idle?: boolean }) => {
  const squeeze = useRef(new Animated.Value(1)).current;
  const aside = useRef(new Animated.Value(0)).current;
  const [inverted, setInverted] = useState(false);
  useEffect(() => {
    if (!idle) return;
    let cancelled = false;
    let next: ReturnType<typeof setTimeout> | null = null;
    let clear: ReturnType<typeof setTimeout> | null = null;
    const blink = (ms: number, times = 1) => Animated.loop(Animated.sequence([
      Animated.timing(squeeze, { toValue: 0.06, duration: ms * 0.45, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(squeeze, { toValue: 1, duration: ms * 0.55, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]), { iterations: times }).start();
    const play = (t: Twitch) => {
      if (t === "blink") blink(340);
      else if (t === "slowblink") blink(850);
      else if (t === "double") blink(280, 2);
      else if (t === "aside") Animated.sequence([
        Animated.timing(aside, { toValue: 9, duration: 315, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.delay(270),
        Animated.timing(aside, { toValue: 0, duration: 315, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]).start();
      else { setInverted(true); clear = setTimeout(() => setInverted(false), 350); }
    };
    const schedule = () => {
      next = setTimeout(() => {
        if (cancelled) return;
        play(TWITCHES[Math.floor(Math.random() * TWITCHES.length)]);
        schedule();
      }, IDLE_MIN_MS + Math.random() * IDLE_SPREAD_MS);
    };
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => { if (!reduce && !cancelled) schedule(); }).catch(() => schedule());
    return () => { cancelled = true; if (next) clearTimeout(next); if (clear) clearTimeout(clear); squeeze.setValue(1); aside.setValue(0); setInverted(false); };
  }, [idle, squeeze, aside]);
  return (
    <Pressable onPress={onPress} accessibilityLabel="Bean detail" style={{ padding: 4 }}>
      <Animated.View style={{ transform: [{ scaleY: squeeze }] }}>
        <Svg width={44} height={34} viewBox="0 0 64 44" fill="none" stroke="#c2905e" strokeWidth={2}>
          <Path d="M4 22 Q32 -4 60 22 Q32 48 4 22 Z" fill={inverted ? "#c2905e" : "none"} />
          <AG translateX={aside}>
            <Ellipse cx={32} cy={22} rx={9} ry={10} />
            <Path d="M32 13 q5 9 0 18" />
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

export const Seal = ({ scale = 1 }: { scale?: number }) => {
  const spin = useSpin(26_000);
  const blink = useBlink(4200, 400);
  return (
    <Svg width={230 * scale} height={220 * scale} viewBox="0 0 200 190" fill="none">
      <Path d="M100 12 L188 168 L12 168 Z" stroke="#c2905e" strokeWidth={2} />
      <Path d="M100 30 L173 160 L27 160 Z" stroke="rgba(194,144,94,.4)" strokeWidth={1} />
      <AG rotation={spin} origin="100, 122">
        <Circle cx={100} cy={122} r={36} stroke="rgba(216,168,111,.7)" strokeWidth={1.6} strokeDasharray="3 8" />
      </AG>
      <AG scaleY={blink} origin="100, 122">
        <Path d="M48 122 Q100 78 152 122 Q100 166 48 122 Z" stroke="#d8a86f" strokeWidth={2.4} fill="#1c1a21" />
        <Ellipse cx={100} cy={122} rx={19} ry={21} stroke="#d8a86f" strokeWidth={2.2} fill="rgba(194,144,94,.14)" />
        <Path d="M100 104 q7 18 0 36" stroke="#d8a86f" strokeWidth={2} />
      </AG>
    </Svg>
  );
};

export const ScanEye = () => {
  const spin = useSpin(1400);
  return (
    <Svg width={70} height={54} viewBox="0 0 72 52" fill="none" stroke="#d8a86f" strokeWidth={2}>
      <Path d="M8 26 Q36 -2 64 26 Q36 54 8 26 Z" />
      <AG rotation={spin} origin="36, 26"><Circle cx={36} cy={26} r={14} strokeDasharray="4 7" /></AG>
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
