import { useRef, useState, type ReactNode } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import { FadeUp } from "../components/Anim";
import { Cta, Defect, Leaf, Link, Nav, Outline, Screen, Spacer, SqBtn, Title } from "../components/Chrome";
import { CameraIcon, MicIcon, WheelIcon } from "../components/Icons";
import { Cell, Ticket, TicketFoot, TicketHead, TicketMethod } from "../components/Ticket";
import { useStore } from "../state/store";
import { c, g, tabular } from "../theme/text";
import { C } from "../theme/tokens";

const SWIPE_PX = 40;

interface Card { kicker: string; title: string; text: string; art: ReactNode }

const CARDS: Card[] = [
  {
    kicker: "01 · THE TICKET",
    title: "One ticket per bag",
    text: "The five values the next brew will use. Tap a value to adjust it. Every cell shows what it was last time, so the change is always in view.",
    art: <TicketArt />,
  },
  {
    kicker: "02 · BREWING",
    title: "Tap. Hold. Tap.",
    text: "Stopping logs the brew at once; undo is in the toast. While it runs, say a change out loud and it lands on the ticket live.",
    art: <TimerArt />,
  },
  {
    kicker: "03 · AFTER THE BREW",
    title: "Rate, then tag",
    text: "A rate card follows each brew: stars and defects, both skippable. On the wheel, tap a flavour to tag it, hold to mark one you disliked.",
    art: <RateArt />,
  },
  {
    kicker: "04 · BAGS",
    title: "Scan the label",
    text: "Add a bag by pointing the camera at its label. Anything unread is handed to you to type. Switch bags from the name at the top of the ticket; each keeps its own ticket and log.",
    art: <BagsArt />,
  },
];

/** Covers the screen underneath; first sign-in, or GUIDE from the profile. */
export const Guide = () => {
  const s = useStore();
  const [i, setI] = useState(0);
  const iRef = useRef(0);
  iRef.current = i;
  const last = i === CARDS.length - 1;
  const card = CARDS[i];

  const next = () => setI((n) => Math.min(n + 1, CARDS.length - 1));
  const prev = () => setI((n) => Math.max(n - 1, 0));
  const start = () => { s.closeGuide(); s.setScreen("home"); };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6,
    onPanResponderRelease: (_e, g) => {
      if (g.dx < -SWIPE_PX) next();
      else if (g.dx > SWIPE_PX) prev();
      else if (iRef.current !== CARDS.length - 1) next();
    },
  })).current;

  return (
    <Screen style={{ zIndex: 65 }}>
      <Nav>
        {i > 0 ? <SqBtn onPress={prev} label="Previous card">←</SqBtn> : <View style={{ width: 44 }} />}
        <Title>GUIDE</Title>
        <Spacer />
        <Link onPress={s.closeGuide}>SKIP</Link>
      </Nav>
      <FadeUp key={i} style={st.card}>
        <View style={st.card} {...pan.panHandlers}>
          <View style={st.art}>{card.art}</View>
          <Text style={st.kicker}>{card.kicker}</Text>
          <Text style={st.title}>{card.title}</Text>
          <Text style={st.text}>{card.text}</Text>
        </View>
      </FadeUp>
      <View style={st.dots} accessibilityLabel={`Card ${i + 1} of ${CARDS.length}`}>
        {CARDS.map((_, n) => <View key={n} style={[st.dot, n === i && { backgroundColor: C.copper }]} />)}
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
        {last ? <Cta label="START BREWING" onPress={start} /> : <Outline onPress={next}>NEXT →</Outline>}
      </View>
    </Screen>
  );
};

function TicketArt() {
  return (
    <Ticket style={{ marginTop: 0, marginHorizontal: 0, paddingTop: 14, paddingHorizontal: 18, width: 300 }}>
      <TicketHead number="012" />
      <TicketMethod label="FILTER" />
      <View style={{ backgroundColor: C.ink, borderWidth: 1.5, borderColor: C.ink, marginTop: 9, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 1.5 }}>
          <Cell label="GRIND" value="4.0" was="was 4.5" changed />
          <Cell label="WATER" value="93" unit="°C" was="was 94" changed />
          <Cell label="DOSE" value="15.0" unit="g" />
        </View>
      </View>
      <TicketFoot text="2 changes from last brew" stamp="UNBREWED" />
    </Ticket>
  );
}

function TimerArt() {
  return (
    <>
      <View style={st.dial}>
        <Text style={st.dialTime}>1:42</Text>
        <Text style={st.dialSub}>target 2:30</Text>
      </View>
      <View style={st.markers}>
        <Marker>POUR 0:30</Marker><Marker>POUR 1:15</Marker>
      </View>
      <View style={st.keys}>
        <View style={st.keyRow}><Text style={st.key}>TAP</Text><Text style={st.keyText}>start · stop & log</Text></View>
        <View style={st.keyRow}><Text style={st.key}>HOLD</Text><Text style={st.keyText}>mark a pour</Text></View>
        <View style={st.keyRow}><View style={{ width: 44 }}><MicIcon size={11} /></View><Text style={st.keyText}>“half a click finer” → −0.5 FINER</Text></View>
      </View>
    </>
  );
}

const Marker = ({ children }: { children: ReactNode }) => (
  <View style={st.marker}><Text style={{ fontSize: 7, color: C.copperLight }}>✦</Text><Text style={st.markerText}>{children}</Text></View>
);

function RateArt() {
  return (
    <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n} style={[st.gstar, n <= 4 && { backgroundColor: C.copper16 }]}><Text style={{ fontSize: 19, color: n <= 4 ? C.copperLight : "rgba(194,144,94,.4)" }}>★</Text></View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Defect on>Sour</Defect><Defect>Bitter</Defect><Defect>Thin</Defect><Defect>Harsh</Defect>
      </View>
      <View style={st.leaves}>
        <View style={{ marginTop: 10 }}><WheelIcon /></View>
        <View><Leaf state="pos">Blackberry</Leaf><Text style={st.leafKey}>TAP · TAGGED</Text></View>
        <View><Leaf state="neg">Smoky</Leaf><Text style={st.leafKey}>HOLD · DISLIKED</Text></View>
      </View>
    </>
  );
}

function BagsArt() {
  return (
    <>
      <View style={st.finder}>
        <View style={[st.bracket, { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3 }]} />
        <View style={[st.bracket, { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3 }]} />
        <View style={[st.bracket, { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
        <View style={[st.bracket, { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3 }]} />
        <View style={st.target}><CameraIcon /></View>
      </View>
      <View style={{ alignItems: "center" }}>
        <Text style={st.beanName}>EL CARMEN <Text style={{ color: C.text45, fontFamily: undefined, fontWeight: "400" }}>⌄</Text></Text>
        <Text style={st.beanMeta}>SYMPLE · 9 D OFF ROAST</Text>
      </View>
    </>
  );
}

const st = StyleSheet.create({
  card: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 18, paddingHorizontal: 26, minHeight: 0 },
  art: { flexShrink: 1, flexBasis: 360, width: "100%", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 0 },
  kicker: { ...c(700, 10, 3, C.copper90), marginTop: 22 },
  title: { ...g(700, 22, 2), marginTop: 8, textAlign: "center" },
  text: { ...g(400, 14, 0, C.text75), lineHeight: 21, marginTop: 10, textAlign: "center", maxWidth: 320 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 10, paddingTop: 18, paddingBottom: 14 },
  dot: { width: 8, height: 8, backgroundColor: C.copper30 },
  dial: { width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: C.copper55, alignItems: "center", justifyContent: "center" },
  dialTime: { ...g(600, 40), ...tabular },
  dialSub: { ...g(400, 12, 0, C.text55), marginTop: 2 },
  markers: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  marker: { height: 32, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: C.copper50 },
  markerText: c(700, 11, 1, C.copperLight),
  keys: { gap: 6 },
  keyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  key: { ...c(700, 10, 2, C.copperLight), width: 44 },
  keyText: g(400, 12, 0, C.text75),
  gstar: { width: 44, height: 44, borderWidth: 1, borderColor: C.copper50, alignItems: "center", justifyContent: "center" },
  leaves: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 6 },
  leafKey: { ...c(700, 9, 2, C.text55), marginTop: 6, textAlign: "center" },
  finder: { width: 190, height: 150, borderWidth: 1, borderColor: C.copper30, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  bracket: { position: "absolute", width: 26, height: 26, borderColor: C.copper },
  target: { width: 96, height: 116, borderWidth: 2, borderStyle: "dashed", borderColor: C.text35, alignItems: "center", justifyContent: "center" },
  beanName: { ...g(700, 17, 3), textTransform: "uppercase" },
  beanMeta: { ...g(400, 12, 1.5, C.text55), marginTop: 3 },
});
