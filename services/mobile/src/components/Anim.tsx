import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

/** bb-fadeup: rise 14px and fade in. */
export const FadeUp = ({ children, style, duration = 300, delay = 0 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; duration?: number; delay?: number }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration, delay, useNativeDriver: true }).start(); }, [v, duration, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

/** bb-sheet: rise 60px and fade in. */
export const SheetRise = ({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

/** bb-pop: 0.5 → 1.07 → 1. */
export const Pop = ({ children, style, duration = 500 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; duration?: number }) => {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(v, { toValue: 1.07, duration: duration * 0.7, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: duration * 0.3, useNativeDriver: true }),
    ]).start();
  }, [v, duration]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
};

/** bb-pulse: a ring that grows to 2.1× while fading out, forever. */
export const Pulse = ({ style, periodMs = 1100 }: { style?: StyleProp<ViewStyle>; periodMs?: number }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: periodMs, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, periodMs]);
  return (
    <Animated.View pointerEvents="none" style={[style, {
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
    }]} />
  );
};

/** bb-glow: opacity breathing between 0.45 and 1. */
export const Glow = ({ children, style, periodMs = 2400 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; periodMs?: number }) => {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: periodMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.45, duration: periodMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, periodMs]);
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
};

/** bb-spin: a full turn every `periodMs`. Returns a value in degrees for an SVG group. */
export const useSpin = (periodMs: number, on = true) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: periodMs, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [v, periodMs, on]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, 360] });
};

/** bb-blink: a quick vertical squeeze once per `periodMs`. Returns a scaleY value. */
export const useBlink = (periodMs: number, squeezeMs = 400, on = true) => {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(periodMs - squeezeMs),
      Animated.timing(v, { toValue: 0.06, duration: squeezeMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(v, { toValue: 1, duration: squeezeMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, periodMs, squeezeMs, on]);
  return v;
};
