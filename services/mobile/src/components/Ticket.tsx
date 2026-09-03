import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { c, g } from "../theme/text";
import { C, shadowCard } from "../theme/tokens";
import { DashedRule, Star } from "./Chrome";

/** The cream card with punched sides. `ghost` is the empty ticket behind the first-bag wall. */
export const Ticket = ({ children, ghost, style }: { children: ReactNode; ghost?: boolean; style?: StyleProp<ViewStyle> }) => (
  <View style={[st.ticket, ghost && st.ghost, style]}>
    <View style={[st.punch, { left: -8 }]} /><View style={[st.punch, { right: -8 }]} />
    {children}
  </View>
);

export const TicketHead = ({ number }: { number: string }) => (
  <View style={st.head}><Text style={st.headTitle}>BREW TICKET</Text><Text style={st.headNo}>N° {number}</Text></View>
);

export const TicketMethod = ({ label, onPress }: { label: string; onPress?: () => void }) => (
  <Pressable onPress={onPress} disabled={!onPress} accessibilityLabel="Change brew method" style={({ pressed }) => [st.method, pressed && { opacity: 0.6 }]}>
    <Star /><Text style={st.methodText}>{label} · HAND GRINDER</Text><Star />
  </Pressable>
);

/** Six cells in two rows of three, ink rules between. */
export const TicketGrid = ({ cells }: { cells: ReactNode[] }) => (
  <View style={st.grid}>
    <View style={st.row}>{cells.slice(0, 3)}</View>
    <View style={[st.row, { marginTop: 1.5 }]}>{cells.slice(3, 6)}</View>
  </View>
);

export const Cell = ({ label, value, unit, was, changed, onPress, ghost }: { label: string; value: string; unit?: string; was?: string; changed?: boolean; onPress?: () => void; ghost?: boolean }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.cell, pressed && { backgroundColor: "#efdcb4" }]}>
    <Text style={st.cellLabel}>{label}</Text>
    <Text style={[st.cellValue, ghost && { color: C.ink45 }]}>{value}{unit ? <Text style={{ fontSize: 12 }}>{unit}</Text> : null}</Text>
    <Text style={st.cellWas}>{was ?? ""}</Text>
    <View style={[st.cellMark, { opacity: changed ? 1 : 0 }]} />
  </Pressable>
);

export const TicketFoot = ({ text, stamp }: { text: string; stamp: string }) => (
  <View style={st.foot}>
    <View style={{ flex: 1 }}><Text style={st.footText}>{text}</Text></View>
    <View style={st.stamp}><Text style={st.stampText}>{stamp}</Text></View>
  </View>
);

export const Perforation = () => <DashedRule color={C.ink40} width={2} style={{ marginHorizontal: -24 }} />;

const st = StyleSheet.create({
  ticket: { marginTop: 18, marginHorizontal: 20, backgroundColor: C.cream, paddingTop: 20, paddingHorizontal: 24, ...shadowCard },
  ghost: { opacity: 0.42, paddingBottom: 16 },
  punch: { position: "absolute", top: "50%", marginTop: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: C.bg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 2, borderBottomColor: C.ink, paddingBottom: 10 },
  headTitle: g(700, 13, 4, C.ink),
  headNo: c(700, 12, 1, C.ink),
  method: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 44, paddingTop: 11, paddingBottom: 2 },
  methodText: g(600, 11, 3, C.ink75),
  grid: { backgroundColor: C.ink, borderWidth: 1.5, borderColor: C.ink, marginTop: 9, marginBottom: 14 },
  row: { flexDirection: "row", gap: 1.5 },
  cell: { flex: 1, paddingTop: 10, paddingBottom: 7, paddingHorizontal: 6, alignItems: "center", backgroundColor: C.cream },
  cellLabel: c(700, 9, 2, C.ink60),
  cellValue: { ...g(600, 22, 0, C.ink), marginTop: 2 },
  cellWas: { ...c(700, 9, 0, C.rust), height: 14, lineHeight: 14 },
  cellMark: { height: 3, marginTop: 2, width: 34, backgroundColor: C.copper },
  foot: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 12 },
  footText: g(400, 12, 0, C.ink65),
  stamp: { flexShrink: 0, alignSelf: "center", marginLeft: 10, borderWidth: 1.5, borderColor: C.rust, paddingVertical: 4, paddingHorizontal: 8, transform: [{ rotate: "-4deg" }] },
  stampText: c(700, 10, 2, C.rust),
});
