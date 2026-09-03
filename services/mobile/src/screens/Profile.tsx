import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import type { Profile as ProfileData, ProfileBean, ProfileRoaster } from "../api/types";
import { Act, Chip, Chips, Defect, Empty, Hint, Link, Nav, Rule, Screen, Spacer, TagSolid, Title } from "../components/Chrome";
import { describePreference, fmtTime, METHOD_LABEL, num, paramsFor, stars, val } from "../lib/format";
import { useStore } from "../state/store";
import { c, g, tabular } from "../theme/text";
import { C } from "../theme/tokens";
import { Plaque } from "./BeanDetail";

type State = { kind: "loading" } | { kind: "error"; msg: string } | { kind: "ready"; data: ProfileData };

export const Profile = () => {
  const s = useStore();
  const [state, setState] = useState<State>({ kind: "loading" });
  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", data: await api.profile() });
    } catch (e) {
      setState({ kind: "error", msg: e instanceof ApiError ? e.message : "The brew log could not be reached." });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <Screen>
      <Nav>
        <Title>PROFILE</Title>
        <Spacer />
        <Link onPress={s.openGuide}>GUIDE</Link>
      </Nav>
      {state.kind === "loading" && <Empty center style={{ paddingVertical: 40, paddingHorizontal: 22 }}>Reading the log…</Empty>}
      {state.kind === "error" && (
        <View style={{ paddingVertical: 40, paddingHorizontal: 22, alignItems: "center" }}>
          <Empty center style={{ paddingVertical: 0 }}>{state.msg}</Empty>
          <Act style={{ marginTop: 14 }} onPress={() => void load()}>TRY AGAIN →</Act>
        </View>
      )}
      {state.kind === "ready" && <Body p={state.data} />}
    </Screen>
  );
};

const Body = ({ p }: { p: ProfileData }) => {
  const s = useStore();
  const who = p.displayName ?? p.email.split("@")[0];
  const cnt = p.counts;
  const tagged = p.flavours.leaves.reduce((n, l) => n + l.likes + l.dislikes, 0);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
      <Plaque style={{ marginHorizontal: 0 }}>
        <Text style={st.name}>{who}</Text>
        <Text style={st.sub}>{p.email}</Text>
        <Chips style={{ gap: 8, marginTop: 12 }}>
          <TagSolid>{cnt.brews} {cnt.brews === 1 ? "BREW" : "BREWS"}</TagSolid>
          <TagSolid>{cnt.bags} {cnt.bags === 1 ? "BAG" : "BAGS"}</TagSolid>
          <TagSolid>{cnt.flavours} {cnt.flavours === 1 ? "FLAVOUR" : "FLAVOURS"}</TagSolid>
          <TagSolid>{cnt.daysLogging} {cnt.daysLogging === 1 ? "DAY" : "DAYS"} LOGGED</TagSolid>
        </Chips>
      </Plaque>

      {cnt.brews === 0 ? (
        <Empty center style={{ paddingTop: 30, paddingBottom: 10 }}>No brews yet. Brew, rate and tag — the profile writes itself.</Empty>
      ) : (
        <>
          <Rule label="YOUR PALATE" right={`${tagged} TAGGED`} style={st.rule} />
          <Palate p={p} />

          <Rule label="HOW YOU BREW" right={p.preferences.likedBrews ? `${p.preferences.likedBrews} ${p.preferences.likedBrews === 1 ? "BREW" : "BREWS"} ★4+` : `${cnt.brews} ${cnt.brews === 1 ? "BREW" : "BREWS"}`} style={st.rule} />
          <Preferences p={p} />

          <Rule label="TOP BAGS" right={`${cnt.bags} ${cnt.bags === 1 ? "BAG" : "BAGS"}`} style={st.rule} />
          {p.topBeans.length === 0 && <Empty style={{ paddingVertical: 14 }}>Rate a brew and the bag ranks itself here.</Empty>}
          {p.topBeans.map((b) => <BeanRow key={b.beanId} b={b} onOpen={() => { s.selectBean(b.beanId); s.setScreen("bean"); }} />)}

          <Rule label="ROASTERS" right={`${p.roasters.length}`} style={st.rule} />
          {p.roasters.length === 0 && <Empty style={{ paddingVertical: 14 }}>No roaster on any bag yet.</Empty>}
          {p.roasters.map((r) => <RoasterRow key={r.roaster} r={r} />)}
        </>
      )}

      <Rule label="FLAVOUR PASSPORT" right="STAMPS →" onPress={() => s.setScreen("passport")} style={{ marginTop: 22 }} />

      {s.hasFriends && (
        <>
          <Rule label="SHARING" style={{ marginTop: 22 }} />
          <Pressable style={st.setting} onPress={() => void s.setSharing(!s.me?.shareRatedByDefault)} accessibilityRole="switch" accessibilityState={{ checked: s.me?.shareRatedByDefault ?? true }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={g(600, 14)}>Share brews I rate</Text>
              <Text style={st.settingSub}>Rating one publishes it to your friends. Any brew can still be made private on its own.</Text>
            </View>
            <View style={[st.switch, s.me?.shareRatedByDefault && st.switchOn]}><View style={[st.knob, s.me?.shareRatedByDefault && { backgroundColor: C.copper }]} /></View>
          </Pressable>
        </>
      )}

      <View style={{ marginTop: 28, marginBottom: 10, alignItems: "center" }}>
        <Act onPress={() => void s.signOut()}>SIGN OUT →</Act>
      </View>
    </ScrollView>
  );
};

const Palate = ({ p }: { p: ProfileData }) => {
  const cats = p.flavours.categories;
  const max = Math.max(1, ...cats.map((x) => x.likes + x.dislikes));
  const pct = (n: number) => `${(n / max) * 100}%` as const;
  if (p.flavours.leaves.length === 0) return <Empty style={{ paddingVertical: 14 }}>No flavours tagged yet — open the wheel after a brew.</Empty>;
  return (
    <>
      <View style={{ marginTop: 12, gap: 7 }}>
        {cats.map((x) => {
          const quiet = x.likes + x.dislikes === 0;
          return (
            <View key={x.category} style={st.palateRow}>
              <Text style={[st.palateK, quiet && { color: C.text30 }]}>{x.category}</Text>
              <View style={st.bar}>
                {x.likes > 0 && <View style={{ width: pct(x.likes), height: "100%", backgroundColor: C.copper }} />}
                {x.dislikes > 0 && <View style={{ width: pct(x.dislikes), height: "100%", backgroundColor: C.rust }} />}
              </View>
              <Text style={[st.palateN, quiet && { color: C.text30 }]}>
                {quiet ? "—" : <>{x.likes > 0 && <Text>+{x.likes}</Text>}{x.dislikes > 0 && <Text style={{ color: C.rustLight }}>{x.likes > 0 ? "  " : ""}−{x.dislikes}</Text>}</>}
              </Text>
            </View>
          );
        })}
      </View>
      <Chips style={{ marginTop: 14 }}>
        {p.flavours.topLiked.map((f) => <Chip key={f.flavour} right={`×${f.likes}`}>{f.flavour}</Chip>)}
        {p.flavours.topDisliked.map((f) => <Chip key={"n" + f.flavour} neg right={`×${f.dislikes}`}>− {f.flavour}</Chip>)}
      </Chips>
    </>
  );
};

const Preferences = ({ p }: { p: ProfileData }) => {
  const { preferred, overall, typicalDurationMs, defects } = p.preferences;
  if (!overall) return null;
  const shown = preferred ?? overall;
  return (
    <View style={{ marginTop: 4 }}>
      {!preferred && <Hint left style={{ paddingTop: 10, paddingBottom: 2 }}>Rate a brew ★4 or better and your preferred ticket appears here. Until then, your medians.</Hint>}
      <View style={st.prefRow}><Text style={st.prefK}>METHOD</Text><Text style={st.prefD}>{METHOD_LABEL[overall.method]}</Text><Text style={st.prefV}>brewed most</Text></View>
      {paramsFor(overall.method).map((cfg) => {
        const v = val(shown, cfg.key);
        const b = val(overall, cfg.key);
        const delta = preferred ? describePreference(cfg.key, v, b) : "";
        return (
          <View key={cfg.key} style={st.prefRow}>
            <Text style={st.prefK}>{cfg.label}</Text>
            <Text style={[st.prefD, delta === "SAME" && { color: C.text45 }]}>{delta || cfg.fmt(v)}</Text>
            <Text style={st.prefV}>{preferred ? `${cfg.fmt(v)}${cfg.cellUnit} · usually ${cfg.fmt(b)}${cfg.cellUnit}` : cfg.unit}</Text>
          </View>
        );
      })}
      <View style={st.prefRow}>
        <Text style={st.prefK}>TIME</Text>
        <Text style={st.prefD}>{typicalDurationMs === null ? "—" : fmtTime(typicalDurationMs)}</Text>
        <Text style={st.prefV}>typical brew</Text>
      </View>
      <View style={[st.prefRow, { alignItems: "center" }]}>
        <Text style={st.prefK}>DEFECTS</Text>
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {defects.length === 0 && <Text style={st.prefV}>none marked</Text>}
          {defects.map((d) => <Defect key={d.defect} on>{d.defect} ×{d.count}</Defect>)}
        </View>
      </View>
    </View>
  );
};

const Score = ({ avg }: { avg: number | null }) => (
  <View style={{ alignItems: "flex-end" }}>
    <Text style={[st.scoreStars, avg === null && { color: C.text35 }]}>{avg === null ? "●" : stars(Math.round(avg))}</Text>
    <Text style={st.scoreAvg}>{avg === null ? "UNRATED" : num(avg, 1)}</Text>
  </View>
);

const BeanRow = ({ b, onOpen }: { b: ProfileBean; onOpen: () => void }) => (
  <Pressable style={st.rank} onPress={onOpen}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={st.rankName} numberOfLines={1}>{b.name}</Text>
      <Text style={st.rankSub} numberOfLines={1}>{[b.roaster, `${b.brews} ${b.brews === 1 ? "brew" : "brews"}`, b.archived ? "archived" : null].filter(Boolean).join(" · ")}</Text>
    </View>
    <Score avg={b.avgRating} />
  </Pressable>
);

const RoasterRow = ({ r }: { r: ProfileRoaster }) => (
  <View style={st.rank}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={st.rankName} numberOfLines={1}>{r.roaster}</Text>
      <Text style={st.rankSub} numberOfLines={1}>{[`${r.bags} ${r.bags === 1 ? "bag" : "bags"}`, `${r.brews} ${r.brews === 1 ? "brew" : "brews"}`, ...r.topFlavours].join(" · ")}</Text>
    </View>
    <Score avg={r.avgRating} />
  </View>
);

const st = StyleSheet.create({
  name: { ...g(700, 24, 2), textTransform: "uppercase" },
  sub: { ...g(400, 13, 1, C.text65), marginTop: 4 },
  rule: { marginTop: 24 },
  palateRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 18 },
  palateK: { ...c(700, 9, 2, C.text55), width: 64 },
  bar: { flex: 1, height: 10, flexDirection: "row", gap: 1, backgroundColor: C.copper08 },
  palateN: { ...c(700, 10, 1, C.copperLight), width: 56, textAlign: "right" },
  prefRow: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.copper20 },
  prefK: { ...c(700, 10, 2, C.text55), width: 64 },
  prefD: { ...g(600, 15, 1, C.copperLight), ...tabular, flex: 1 },
  prefV: { ...g(500, 12, 0, C.text55), ...tabular, textAlign: "right" },
  rank: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.copper20, minHeight: 44 },
  rankName: { ...g(600, 14, 1), textTransform: "uppercase" },
  rankSub: { ...g(400, 12, 0, C.text55), marginTop: 2 },
  scoreStars: { fontSize: 12, letterSpacing: 1, color: C.copperLight },
  scoreAvg: { ...c(700, 10, 1, C.text55), marginTop: 2 },
  setting: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, minHeight: 44 },
  settingSub: { ...g(400, 11, 0, C.text50), lineHeight: 16, marginTop: 3 },
  switch: { width: 48, height: 28, borderWidth: 1, borderColor: C.copper55, padding: 3, justifyContent: "center", alignItems: "flex-start" },
  switchOn: { backgroundColor: C.copper18, borderColor: C.copper, alignItems: "flex-end" },
  knob: { width: 20, height: 20, backgroundColor: C.text45 },
});
