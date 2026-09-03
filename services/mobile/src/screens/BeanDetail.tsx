import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Act, Chips, Empty, Link, Nav, Rule, Screen, Spacer, SqBtn, TagDash, TagSolid, Title } from "../components/Chrome";
import { RateRow } from "../components/RateRow";
import { RoasterPicker } from "../components/RoasterPicker";
import { daysOffRoast, describeDelta, describeFull, describeSteps, fmtTimeOrDash, stars, whenLabel } from "../lib/format";
import { useStore } from "../state/store";
import { c, g, tabular } from "../theme/text";
import { C } from "../theme/tokens";

export const BeanDetail = () => {
  const s = useStore();
  const bean = s.currentBean;
  const [open, setOpen] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  useEffect(() => { if (!bean) s.setScreen("library"); });
  if (!bean) return null;
  const hist = s.brewsFor(bean.id); // newest first
  const days = daysOffRoast(bean.roastDate);
  const originLine = [bean.origin, bean.process].filter(Boolean).join(" · ");
  const openMap = () => { s.setRoasterFocus(bean.roasterId); s.setScreen("roasters"); };

  return (
    <Screen>
      <Nav>
        <SqBtn onPress={() => s.setScreen("library")} label="Back to the library">←</SqBtn>
        <Title>BEAN</Title>
        <Spacer />
        <Link onPress={() => { s.selectBean(bean.id); s.setScreen("home"); }}>BREW THIS →</Link>
      </Nav>
      <Plaque>
        <Text style={st.name}>{bean.name}</Text>
        <Text style={st.sub}>
          {bean.roaster && bean.roasterId
            ? bean.roasterLocated
              ? <Text style={st.roasterLink} onPress={openMap}>{bean.roaster} ↗</Text>
              : <>{bean.roaster} <Text style={st.roasterLink} onPress={() => setFinding(true)}>FIND IT →</Text></>
            : bean.roaster}
          {bean.roaster && originLine ? " — " : ""}
          {originLine}
          {!bean.roaster && !originLine && "no roaster or origin on record"}
        </Text>
        <Chips style={{ gap: 8, marginTop: 12 }}>
          <TagSolid>{days === null ? "ROAST DATE UNSET" : `${days} DAYS OFF ROAST`}</TagSolid>
          {bean.declaredNotes.map((n) => <TagDash key={n}>{n}</TagDash>)}
        </Chips>
      </Plaque>
      <Rule label="DIAL-IN LOG" right={`${hist.length} BREWS`} style={{ marginTop: 20, marginHorizontal: 22, marginBottom: 4 }} />
      <ScrollView style={{ flex: 1, paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
        {hist.length === 0 && <Empty>No brews yet — the first brew starts from the method's defaults.</Empty>}
        {hist.map((h, i) => {
          const prev = hist[i + 1] ?? null;
          const isOpen = open === h.id;
          return (
            <View key={h.id} style={st.logRow}>
              <Pressable style={st.logLine} onPress={() => setOpen(isOpen ? null : h.id)}>
                <Text style={st.when}>{whenLabel(h.brewedAt)}</Text>
                <Text style={st.delta}>{describeDelta(h.params, prev?.params ?? null)}</Text>
                <Text style={st.dur}>{fmtTimeOrDash(h.durationMs)}</Text>
                <Text style={[st.stars, !h.rating && { color: C.text35 }]}>{stars(h.rating)}</Text>
              </Pressable>
              {isOpen && (
                <View style={st.logOpen}>
                  <Text style={st.full}>{describeFull(h.params, h.durationMs)}</Text>
                  {h.steps.length > 0 && <Text style={st.steps}>{describeSteps(h.steps)}</Text>}
                  {(h.flavourTags.length > 0 || h.defects.length > 0) && (
                    <Text style={[st.full, { marginTop: 6, color: C.copperLight85 }]}>
                      {h.flavourTags.map((t) => (t.polarity < 0 ? "− " : "") + t.flavour).concat(h.defects.map((d) => `defect: ${d.toLowerCase()}`)).join(" · ")}
                    </Text>
                  )}
                  <RateRow brew={h} compact />
                  <View style={st.acts}>
                    <Act onPress={() => { s.loadParams(h.params); s.setScreen("home"); s.showToast("Loaded onto the brew ticket"); }}>BREW THIS AGAIN →</Act>
                    <Act onPress={() => s.openWheel(h)}>TAG FLAVOURS →</Act>
                    <Act onPress={() => s.openBrewEdit(h)}>EDIT →</Act>
                    {s.hasFriends && h.rating > 0 && (
                      <Act on={!h.isPrivate} quiet={h.isPrivate} onPress={() => void s.setBrewPrivacy(h.id, !h.isPrivate)}>
                        {h.isPrivate ? "PRIVATE" : "SHARED WITH FRIENDS"}
                      </Act>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ paddingTop: 18, paddingBottom: 10 }}>
          <Act style={{ borderColor: C.copper35 }} textStyle={{ color: C.text55 }}
            onPress={() => { void s.archiveBean(bean.id, !bean.archived); s.showToast(bean.archived ? `${bean.name} back in open bags` : `${bean.name} archived`); if (!bean.archived) s.setScreen("library"); }}>
            {bean.archived ? "REOPEN BAG" : "ARCHIVE BAG"}
          </Act>
        </View>
      </ScrollView>
      {finding && bean.roasterId && (
        <RoasterPicker roasterId={bean.roasterId} name={bean.roaster ?? ""}
          onPlaced={(r) => { s.patchBean({ ...bean, roasterLocated: r.located, roasterResolved: true }); setFinding(false); }}
          onClose={() => setFinding(false)} />
      )}
    </Screen>
  );
};

/** The bordered name plate with its inner rule, shared with the profile. */
export const Plaque = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[st.plaque, style]}>
    <View pointerEvents="none" style={st.plaqueInner} />
    {children}
  </View>
);

const st = StyleSheet.create({
  plaque: { marginTop: 14, marginHorizontal: 22, borderWidth: 1, borderColor: C.copper55, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: C.copper05 },
  plaqueInner: { position: "absolute", top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderColor: "rgba(194, 144, 94, 0.28)" },
  name: { ...g(700, 24, 2), textTransform: "uppercase" },
  sub: { ...g(400, 13, 1, C.text65), marginTop: 4 },
  roasterLink: { color: C.copperLight, textDecorationLine: "underline", textDecorationStyle: "dotted" },
  logRow: { borderBottomWidth: 1, borderBottomColor: C.copper20, paddingVertical: 13, width: "100%" },
  logLine: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  when: { ...c(700, 10, 1, C.text55), width: 88 },
  delta: { ...g(600, 13, 0, C.copperLight), flex: 1 },
  dur: { ...g(500, 12, 0, C.text70), ...tabular },
  stars: { fontSize: 12, letterSpacing: 1, width: 66, textAlign: "right", color: C.copperLight },
  logOpen: { marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.copper07, borderWidth: 1, borderColor: C.copper30 },
  full: g(500, 13, 0, C.text85),
  steps: { ...c(700, 11, 1, C.copperLight), marginTop: 4 },
  acts: { flexDirection: "row", gap: 8, marginTop: 11, flexWrap: "wrap" },
});
