import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path, Text as SText } from "react-native-svg";
import { api, ApiError } from "../api/client";
import type { CategoryCoverage, Passport as PassportData } from "../api/types";
import { FadeUp, Pop } from "../components/Anim";
import { Act, Chips, Empty, Hint, Nav, Rule, Screen, SqBtn, Title } from "../components/Chrome";
import { whenLabel } from "../lib/format";
import { fraction, leavesByGroup, ledgerOrder, stampDate } from "../lib/passport";
import { annular, polar, wedgeAngles, WHEEL_GEOMETRY } from "../lib/wheelGeometry";
import { useStore } from "../state/store";
import { c, g, tabular } from "../theme/text";
import { C, courier, grotesk } from "../theme/tokens";

export const Passport = () => {
  const s = useStore();
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.passport()); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e.message : "The passport could not be reached."); }
  }, []);
  // Reload whenever the brews change under us: the wheel sheet may still be saving tags as this opens.
  useEffect(() => { void load(); }, [load, s.brews]);

  const tasted = data ? data.coverage.categories.reduce((n, x) => n + x.tasted, 0) : 0;
  const of = data ? data.coverage.categories.reduce((n, x) => n + x.of, 0) : 0;
  const stamps = data ? data.achievements.filter((a) => a.unlocked).length : 0;
  const selCat = sel ? data?.coverage.categories.find((x) => x.name === sel) : undefined;

  return (
    <Screen>
      <Nav>
        <SqBtn onPress={() => s.setScreen("profile")} label="Back to the profile">←</SqBtn>
        <Title>PASSPORT</Title>
      </Nav>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {!data && !error && <Empty center>Opening the passport…</Empty>}
        {!data && error && (
          <View style={{ alignItems: "center", paddingVertical: 26 }}>
            <Empty center style={{ paddingVertical: 0 }}>{error}</Empty>
            <Act style={{ marginTop: 14 }} onPress={() => void load()}>TRY AGAIN →</Act>
          </View>
        )}
        {data && (
          <>
            <Rule label="FLAVOUR WHEEL" right={`${tasted} / ${of} TASTED`} style={{ marginTop: 16, marginHorizontal: 22 }} />
            <CoverageWheel categories={data.coverage.categories} tasted={tasted} of={of} selected={sel} onSelect={(x) => setSel(sel === x ? null : x)} />
            {sel === null && <Hint style={{ marginTop: 4 }}>tap a wedge to see what is left to taste</Hint>}
            {sel !== null && (
              <FadeUp duration={250} style={st.panel}>
                <View style={[st.panelRule, { minHeight: 44 }]}>
                  <Text style={st.ruleText}>{sel}</Text><View style={st.line} />
                  <Text style={[st.ruleText, { color: C.text60 }]}>{selCat?.tasted ?? 0} / {selCat?.of ?? 0}</Text>
                  <Pressable onPress={() => setSel(null)} accessibilityLabel="Close" style={st.close}><Text style={{ color: C.text50, fontSize: 14 }}>✕</Text></Pressable>
                </View>
                {leavesByGroup(data.coverage.leaves, sel).map((grp) => (
                  <View key={grp.name}>
                    <Text style={st.group}>{grp.name}</Text>
                    <Chips compact>
                      {grp.leaves.map((l) => (
                        <View key={l.flavour} style={[st.leaf, !l.tasted && st.leafOff]}>
                          <Text style={[g(500, 13), !l.tasted && { color: C.text40 }]}>{l.flavour}</Text>
                          {l.tasted && l.lastTaggedAt && <Text style={c(700, 9, 1, C.copperLight)}>{whenLabel(l.lastTaggedAt)}</Text>}
                        </View>
                      ))}
                    </Chips>
                  </View>
                ))}
              </FadeUp>
            )}
            <Rule label="STAMPS" right={`${stamps} / ${data.achievements.length}`} style={{ marginTop: 22, marginHorizontal: 22, marginBottom: 6 }} />
            <View style={{ paddingHorizontal: 22 }}>
              {ledgerOrder(data.achievements).map((a) => (
                <View key={a.key} style={st.row}>
                  <View style={{ minWidth: 0, flexShrink: 1 }}>
                    <Text style={[st.t, !a.unlocked && { color: C.text45 }]}>{a.title}</Text>
                    <Text style={[st.s, !a.unlocked && { color: C.text35 }]}>{a.subtitle}</Text>
                  </View>
                  {a.unlocked && a.unlockedAt
                    ? <View style={st.stamp}><Text style={st.stampText}>✦ {stampDate(a.unlockedAt)}</Text></View>
                    : <><View style={st.leader} /><Text style={st.count}>{a.progress.have} / {a.progress.of}</Text></>}
                </View>
              ))}
            </View>
            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const CoverageWheel = ({ categories, tasted, of, selected, onSelect }: {
  categories: CategoryCoverage[]; tasted: number; of: number; selected: string | null; onSelect: (name: string) => void;
}) => {
  const { cx, cy, ro, ri, size, viewBox } = WHEEL_GEOMETRY;
  const n = categories.length;
  return (
    <View style={{ alignItems: "center", paddingTop: 8 }}>
      <Pop>
        <Svg width={size} height={size} viewBox={viewBox} fill="none">
          <G strokeWidth={1.2}>
            {categories.map((x, i) => {
              const { a0, a1 } = wedgeAngles(i, n);
              const f = fraction(x.tasted, x.of);
              const on = x.name === selected;
              return (
                <G key={x.name} onPress={() => onSelect(x.name)}>
                  <Path d={annular(cx, cy, ro, ri, a0, a1)} fill="rgba(194,144,94,.06)" stroke={on ? "#d8a86f" : "rgba(194,144,94,.55)"} strokeWidth={on ? 1.8 : 1.2} />
                  {f > 0 && <Path d={annular(cx, cy, ri + (ro - ri) * f, ri, a0, a1)} fill="#c2905e" fillOpacity={0.22 + 0.5 * f} stroke="none" />}
                </G>
              );
            })}
          </G>
          {categories.map((x, i) => {
            const [px, py] = polar(cx, cy, (ro + ri) / 2 + 4, wedgeAngles(i, n).mid);
            return (
              <G key={x.name} pointerEvents="none">
                <SText x={px.toFixed(1)} y={(py - 1).toFixed(1)} fontFamily={grotesk(600)} fontSize={11} letterSpacing={1.5} fill="#e9d6ae" textAnchor="middle">{x.name}</SText>
                <SText x={px.toFixed(1)} y={(py + 13).toFixed(1)} fontFamily={courier(700)} fontSize={10} letterSpacing={1} fill={x.tasted ? "#d8a86f" : "rgba(233,214,174,.45)"} textAnchor="middle">{x.tasted} / {x.of}</SText>
              </G>
            );
          })}
          <G pointerEvents="none">
            <SText x={cx} y={cy + 6} fontFamily={courier(700)} fontSize={30} fill="#e9d6ae" textAnchor="middle">{tasted}</SText>
            <SText x={cx} y={cy + 24} fontFamily={courier(700)} fontSize={9} letterSpacing={2} fill="rgba(233,214,174,.55)" textAnchor="middle">OF {of}</SText>
            <SText x={cx} y={cy - 22} fontFamily={courier(700)} fontSize={9} letterSpacing={2} fill="rgba(194,144,94,.9)" textAnchor="middle">TASTED</SText>
          </G>
        </Svg>
      </Pop>
    </View>
  );
};

const st = StyleSheet.create({
  panel: { marginTop: 10, marginHorizontal: 22, borderWidth: 1, borderColor: C.copper30, backgroundColor: C.copper05, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14 },
  panelRule: { flexDirection: "row", alignItems: "center", gap: 10 },
  ruleText: c(700, 10, 3, C.copper90),
  line: { flex: 1, height: 1, backgroundColor: C.copper30 },
  close: { width: 44, height: 44, marginRight: -12, alignItems: "center", justifyContent: "center" },
  group: { ...c(700, 9, 3, C.text50), marginTop: 10, marginBottom: 8 },
  leaf: { height: 38, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderWidth: 1, borderColor: C.copper, backgroundColor: C.copper16 },
  leafOff: { borderStyle: "dashed", borderColor: C.copper35, backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.copper20, minHeight: 56 },
  t: { ...g(700, 13, 2), textTransform: "uppercase" },
  s: { ...g(400, 12, 0, C.text55), marginTop: 3 },
  leader: { flex: 1, height: 0, borderTopWidth: 1, borderStyle: "dotted", borderTopColor: C.copper30, minWidth: 16 },
  count: { ...c(700, 12, 1, C.text55), ...tabular },
  stamp: { marginLeft: "auto", borderWidth: 1.5, borderColor: C.copperLight, paddingVertical: 5, paddingHorizontal: 8, transform: [{ rotate: "-4deg" }] },
  stampText: c(700, 10, 2, C.copperLight),
});
