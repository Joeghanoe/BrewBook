import { createContext, useContext, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C, shadowCard, shadowSheet, TABBAR_H } from "../theme/tokens";
import { FadeUp, SheetRise } from "./Anim";

/** Whether the bottom bar is on screen, so screens and sheets can leave room for it. */
export const BarCtx = createContext(false);
export const useHasBar = () => useContext(BarCtx);

/**
 * The phone draws its own status bar and home indicator (§9); screens take their insets here and
 * nowhere else.
 */
export const Screen = ({ children, style, animate = true }: { children?: ReactNode; style?: StyleProp<ViewStyle>; animate?: boolean }) => {
  const insets = useSafeAreaInsets();
  const bar = useHasBar();
  const pad = { paddingTop: 14 + insets.top, paddingBottom: bar ? TABBAR_H + insets.bottom : 10 + insets.bottom };
  if (!animate) return <View style={[st.screen, pad, style]}>{children}</View>;
  return <FadeUp style={[st.screen, pad, style]}>{children}</FadeUp>;
};

export const Nav = ({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[st.nav, style]}>{children}</View>;
export const Title = ({ children }: { children: ReactNode }) => <Text style={st.title}>{children}</Text>;
export const Spacer = () => <View style={{ flex: 1 }} />;

export const SqBtn = ({ onPress, label, children, style }: { onPress?: () => void; label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [st.sqbtn, pressed && st.hover, style]}>
    <Text style={st.sqbtnText}>{children}</Text>
  </Pressable>
);

export const Link = ({ children, onPress, color, style }: { children: ReactNode; onPress?: () => void; color?: string; style?: StyleProp<ViewStyle> }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={[st.link, style]}>
    <Text style={[st.linkText, color ? { color } : null]}>{children}</Text>
  </Pressable>
);

/**
 * A dashed or dotted horizontal rule. React Native only draws dashed borders when all four sides
 * have them, so the line is a clipped box rather than a one-sided border.
 */
export const DashedRule = ({ color, width = 1, dotted, style }: { color: string; width?: number; dotted?: boolean; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ height: width, overflow: "hidden" }, style]}>
    <View style={{ height: width * 2 + 2, borderWidth: width, borderStyle: dotted ? "dotted" : "dashed", borderColor: color }} />
  </View>
);

export const Grabber = () => <View style={st.grabber}><View style={st.grabberBar} /></View>;

export const Rule = ({ label, right, onPress, color, lineColor, style }: { label: string; right?: string; onPress?: () => void; color?: string; lineColor?: string; style?: StyleProp<ViewStyle> }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={[st.rule, onPress && { minHeight: 44 }, style]}>
    <Text style={[st.ruleText, color ? { color } : null]}>{label}</Text>
    <View style={[st.ruleLine, lineColor ? { backgroundColor: lineColor } : null]} />
    {right !== undefined && <Text style={[st.ruleText, { color: color ?? C.text60 }]}>{right}</Text>}
  </Pressable>
);

export const Star = () => <Text style={{ fontSize: 8, color: C.ink75 }}>✦</Text>;

export const Hint = ({ children, style, left }: { children: ReactNode; style?: StyleProp<TextStyle>; left?: boolean }) => (
  <Text style={[st.hint, left && { textAlign: "left" }, style]}>{children}</Text>
);

export const Empty = ({ children, style, center }: { children: ReactNode; style?: StyleProp<TextStyle>; center?: boolean }) => (
  <Text style={[st.empty, center && { textAlign: "center" }, style]}>{children}</Text>
);

export const Cta = ({ label, onPress, panel, disabled, style }: { label: string; onPress?: () => void; panel?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) => (
  <Pressable onPress={onPress} disabled={disabled} style={[st.cta, panel && st.ctaPanel, disabled && { opacity: 0.6 }, style]}>
    <View style={[st.ctaInner, panel && st.ctaInnerPanel]}>
      <Text style={[st.ctaText, panel && { fontSize: 14, letterSpacing: 6 }]}>{label}</Text>
    </View>
  </Pressable>
);

export const Outline = ({ children, onPress, live, disabled, style, textStyle }: { children: ReactNode; onPress?: () => void; live?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [st.outline, pressed && st.hover, live && st.outlineLive, style]}>
    <Text style={[st.outlineText, textStyle]}>{children}</Text>
  </Pressable>
);

export const Act = ({ children, onPress, on, quiet, disabled, style, textStyle, label }: { children: ReactNode; onPress?: () => void; on?: boolean; quiet?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; label?: string }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} style={[st.act, on && st.actOn, quiet && st.actQuiet, disabled && { opacity: 0.5 }, style]}>
    <Text style={[st.actText, quiet && { color: C.text55 }, textStyle]}>{children}</Text>
  </Pressable>
);

export const Backdrop = ({ onPress, layer }: { onPress: () => void; layer?: boolean }) => (
  <Pressable onPress={onPress} style={[StyleSheet.absoluteFill, { backgroundColor: layer ? C.layerBackdrop : C.backdrop, zIndex: layer ? 60 : 70 }]} />
);

/** A sheet rises above the screen, not above the bar: the bar is always reachable. */
export const Sheet = ({ children }: { children: ReactNode }) => {
  const insets = useSafeAreaInsets();
  const bar = useHasBar();
  return (
    <SheetRise style={[st.sheet, { paddingBottom: bar ? TABBAR_H + 12 + insets.bottom : 26 + insets.bottom }]}>
      <Grabber />
      {children}
    </SheetRise>
  );
};

export const SheetHead = ({ title, count, left, children }: { title?: string; count?: string; left?: ReactNode; children?: ReactNode }) => (
  <View style={st.sheetHead}>
    {left}
    {title !== undefined && <Text style={[st.sheetTitle, left ? { marginLeft: 10 } : null]}>{title}</Text>}
    {children}
    <View style={st.ruleLine} />
    {count !== undefined && <Text style={st.sheetCount}>{count}</Text>}
  </View>
);

export const Toast = () => {
  const { toast } = useStore();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <FadeUp duration={250} style={[st.toast, { bottom: 96 + insets.bottom }]}>
      <Text style={st.toastText}>{toast.msg}</Text>
      {toast.undo && <Pressable onPress={toast.undo} style={{ paddingVertical: 6, paddingHorizontal: 4 }}><Text style={st.toastBtn}>{toast.label ?? "UNDO"}</Text></Pressable>}
    </FadeUp>
  );
};

/** A tagged flavour on the wheel's tray: solid when liked, dashed rust when disliked. */
export const Chip = ({ children, neg, onPress, right }: { children: ReactNode; neg?: boolean; onPress?: () => void; right?: string }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={[st.chip, neg && st.chipNeg]}>
    <Text style={[st.chipText, neg && { color: C.rustLight }]}>{children}</Text>
    {right !== undefined && <Text style={[st.chipText, { opacity: 0.55 }, neg && { color: C.rustLight }]}>{right}</Text>}
  </Pressable>
);

/** A wheel leaf: plain, copper when tagged, struck through in rust when disliked. */
export const Leaf = ({ children, state, compact, dashed, onPress, onLongPress, delayLongPress, style }: { children: ReactNode; state?: "pos" | "neg" | null; compact?: boolean; dashed?: boolean; onPress?: () => void; onLongPress?: () => void; delayLongPress?: number; style?: StyleProp<ViewStyle> }) => (
  <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={delayLongPress} disabled={!onPress && !onLongPress}
    style={[st.leaf, compact && st.leafCompact, state === "pos" && st.leafPos, state === "neg" && st.leafNeg, dashed && { borderStyle: "dashed" }, style]}>
    <Text style={[st.leafText, compact && { fontSize: 13 }, state === "pos" && { color: C.bg }, state === "neg" && { color: C.rustLight, textDecorationLine: "line-through" }, dashed && { color: C.text55 }]}>{children}</Text>
  </Pressable>
);

export const Defect = ({ children, on, onPress }: { children: ReactNode; on?: boolean; onPress?: () => void }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={[st.defect, on && st.defectOn]}>
    <Text style={[st.defectText, on && { color: C.rustLight }]}>{children}</Text>
  </Pressable>
);

export const TagSolid = ({ children }: { children: ReactNode }) => <View style={st.tagSolid}><Text style={st.tagSolidText}>{children}</Text></View>;
export const TagDash = ({ children }: { children: ReactNode }) => <View style={st.tagDash}><Text style={st.tagDashText}>{children}</Text></View>;

export const Chips = ({ children, compact, style }: { children: ReactNode; compact?: boolean; style?: StyleProp<ViewStyle> }) => (
  <View style={[st.chips, compact && { gap: 7 }, style]}>{children}</View>
);

const st = StyleSheet.create({
  screen: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "column", backgroundColor: C.bg },
  nav: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 4, paddingHorizontal: 22, minHeight: 44 },
  title: g(700, 15, 4),
  sqbtn: { width: 44, height: 44, borderWidth: 1, borderColor: C.copper50, alignItems: "center", justifyContent: "center" },
  sqbtnText: { color: C.copperLight, fontSize: 16 },
  hover: { backgroundColor: C.copper12 },
  link: { paddingVertical: 10, minHeight: 44, justifyContent: "center" },
  linkText: c(700, 10, 3, C.copperLight),
  grabber: { alignItems: "center", marginBottom: 6 },
  grabberBar: { width: 44, height: 4, borderRadius: 2, backgroundColor: C.text25 },
  rule: { flexDirection: "row", alignItems: "center", gap: 10 },
  ruleText: c(700, 10, 3, C.copper90),
  ruleLine: { flex: 1, height: 1, backgroundColor: C.copper30 },
  hint: { ...g(400, 12, 0, C.text50), textAlign: "center" },
  empty: { ...g(400, 13, 0, C.text50), paddingVertical: 26 },
  cta: { height: 60, backgroundColor: C.copper, width: "100%", borderWidth: 1, borderColor: C.bg },
  ctaPanel: { height: 56, borderColor: C.panel },
  ctaInner: { flex: 1, margin: 0, borderWidth: 2, borderColor: "rgba(28, 26, 33, 0.45)", alignItems: "center", justifyContent: "center" },
  ctaInnerPanel: { borderColor: "rgba(38, 36, 46, 0.45)" },
  ctaText: g(700, 16, 7, C.bg),
  outline: { height: 56, borderWidth: 1, borderColor: C.copper55, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  outlineLive: { backgroundColor: C.copper18, borderColor: C.copper },
  outlineText: g(600, 13, 4, C.copperLight),
  act: { height: 38, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: C.copper60 },
  actOn: { borderColor: C.copper, backgroundColor: C.copper14 },
  actQuiet: { borderColor: C.copper35 },
  actText: g(600, 11, 3, C.copperLight),
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 71, backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.copper60, paddingTop: 18, paddingHorizontal: 22, ...shadowSheet },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  sheetTitle: g(700, 12, 4, C.copperLight),
  sheetCount: g(400, 12, 0, C.text50),
  toast: { position: "absolute", left: 22, right: 22, zIndex: 80, backgroundColor: C.cream, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, ...shadowCard },
  toastText: { ...g(500, 13, 0, C.ink), flex: 1 },
  toastBtn: g(700, 12, 2, C.rust),
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: { height: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, backgroundColor: C.copper16, borderWidth: 1, borderColor: C.copper60 },
  chipNeg: { backgroundColor: "transparent", borderStyle: "dashed", borderColor: C.rust90 },
  chipText: g(500, 13),
  leaf: { height: 46, justifyContent: "center", paddingHorizontal: 17, borderWidth: 1, borderColor: C.copper45 },
  leafCompact: { height: 38, paddingHorizontal: 13 },
  leafPos: { backgroundColor: C.copper, borderColor: C.copper },
  leafNeg: { borderStyle: "dashed", borderColor: C.rust95 },
  leafText: g(500, 14),
  defect: { height: 34, justifyContent: "center", paddingHorizontal: 13, borderWidth: 1, borderStyle: "dashed", borderColor: C.copper45 },
  defectOn: { borderColor: C.rust, backgroundColor: C.rust18, borderStyle: "solid" },
  defectText: g(500, 12, 0, C.text75),
  tagSolid: { paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: C.copper50 },
  tagSolidText: c(700, 10, 2, C.copperLight),
  tagDash: { paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderStyle: "dashed", borderColor: C.copper45 },
  tagDashText: g(500, 11, 0, C.text75),
});
