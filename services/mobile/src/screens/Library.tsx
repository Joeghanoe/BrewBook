import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Bean } from "../api/types";
import { FadeUp } from "../components/Anim";
import { Act, Empty, Link, Nav, Rule, Screen, Spacer, Title } from "../components/Chrome";
import { CameraIcon } from "../components/Icons";
import { brewsLeftLabel, daysOffRoast } from "../lib/format";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C } from "../theme/tokens";

/**
 * Asked once, then never again for that bag. Archiving is always the user's word: never automatic,
 * never nagged (§7).
 */
const ArchivePrompt = ({ bean }: { bean: Bean }) => {
  const s = useStore();
  const empty = bean.brewsLeft === 0;
  return (
    <FadeUp duration={350} style={st.ask}>
      <Text style={st.askT}>{bean.name}</Text>
      <Text style={st.askS}>{empty ? "That is the last of this bag by the numbers." : "This bag is a year past its roast date."} Finished with it?</Text>
      <View style={st.askActs}>
        <Act onPress={() => { void s.archiveBean(bean.id, true); s.showToast(`${bean.name} archived — its brews stay in the log`); }}>ARCHIVE IT</Act>
        <Act quiet onPress={() => void s.keepBean(bean.id)}>LEAVE IT OPEN</Act>
      </View>
    </FadeUp>
  );
};

export const Library = () => {
  const s = useStore();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const openBean = (id: string) => { s.selectBean(id); s.setScreen("bean"); };
  return (
    <Screen>
      <Nav>
        <Title>BEAN LIBRARY</Title>
        <Spacer />
        <Link color={C.text50}>{s.beansOpen.length} OPEN</Link>
      </Nav>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {s.beansOpen.filter((b) => b.askToArchive).map((b) => <ArchivePrompt key={b.id} bean={b} />)}
        <Rule label="OPEN BAGS" style={{ marginTop: 18, marginHorizontal: 22 }} />
        <View style={{ paddingTop: 12, paddingHorizontal: 22, gap: 12 }}>
          {s.beansOpen.length === 0 && <Empty style={{ paddingVertical: 14 }}>No open bags — scan a label to add the first one.</Empty>}
          {s.beansOpen.map((b) => {
            const d = daysOffRoast(b.roastDate);
            return (
              <Pressable key={b.id} style={({ pressed }) => [st.bag, pressed && { backgroundColor: C.copper12 }]} onPress={() => openBean(b.id)}>
                <View style={st.bagTop}><Text style={st.bagName} numberOfLines={1}>{b.name}</Text><Text style={st.bagDays}>{d === null ? "— D" : `${d} D`}</Text></View>
                <Text style={st.bagSub}>{[b.roaster, [b.origin, b.process].filter(Boolean).join(" · ")].filter(Boolean).join(" · ") || "no details on record"}</Text>
                {b.declaredNotes.length > 0 && <Text style={st.bagNotes}>{b.declaredNotes.join(" · ")}</Text>}
                {brewsLeftLabel(b.brewsLeft) && <Text style={st.bagLeft}>{brewsLeftLabel(b.brewsLeft)}</Text>}
              </Pressable>
            );
          })}
        </View>
        <Rule label="ARCHIVE" right={archiveOpen ? "⌃" : "⌄"} color={C.text55} lineColor={C.copper20} onPress={() => setArchiveOpen((o) => !o)} style={{ marginTop: 22, marginHorizontal: 22 }} />
        {archiveOpen && (
          <View style={{ paddingTop: 10, paddingHorizontal: 22, gap: 1 }}>
            {s.beansArchived.length === 0 && <Empty style={{ paddingVertical: 12, paddingHorizontal: 4 }}>Nothing archived.</Empty>}
            {s.beansArchived.map((b) => (
              <Pressable key={b.id} style={st.archiveRow} onPress={() => openBean(b.id)}>
                <Text style={[st.archiveText, { flex: 1 }]} numberOfLines={1}>{b.name}{b.roaster ? ` — ${b.roaster}` : ""}</Text>
                <Text style={c(700, 10, 0, C.text55)}>{b.brewCount} BREWS</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flex: 1, minHeight: 20 }} />
      </ScrollView>
      <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
        <Pressable style={({ pressed }) => [st.scanCta, pressed && { backgroundColor: C.copper10 }]} onPress={() => s.setScreen("scan")}>
          <CameraIcon /><Text style={st.scanCtaText}>ADD A BAG — SCAN LABEL</Text>
        </Pressable>
      </View>
    </Screen>
  );
};

const st = StyleSheet.create({
  ask: { marginTop: 14, marginHorizontal: 22, borderWidth: 1, borderColor: C.copper55, backgroundColor: C.copper08, paddingVertical: 14, paddingHorizontal: 16 },
  askT: { ...g(700, 13, 2), textTransform: "uppercase" },
  askS: { ...g(400, 12, 0, C.text75), lineHeight: 18, marginTop: 6 },
  askActs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  bag: { borderWidth: 1, borderColor: C.copper50, paddingVertical: 15, paddingHorizontal: 17, backgroundColor: C.copper05 },
  bagTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  bagName: { ...g(700, 17, 2), textTransform: "uppercase", flexShrink: 1 },
  bagDays: c(700, 10, 2, C.copperLight),
  bagSub: { ...g(400, 12, 0, C.text60), marginTop: 4 },
  bagNotes: { ...g(500, 12, 0, C.copperLight80), marginTop: 6 },
  bagLeft: { ...c(700, 10, 1.5, C.copperLight), marginTop: 8 },
  archiveRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.copper15 },
  archiveText: g(400, 13, 0, C.text55),
  scanCta: { height: 60, borderWidth: 1, borderStyle: "dashed", borderColor: C.copper70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  scanCtaText: g(600, 13, 4, C.copperLight),
});
