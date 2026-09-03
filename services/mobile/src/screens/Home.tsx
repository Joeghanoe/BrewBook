import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FadeUp } from "../components/Anim";
import { Backdrop, Cta, Defect, Empty, Hint, Outline, Sheet, SheetHead, Spacer } from "../components/Chrome";
import { EyeGlyph, WheelIcon } from "../components/Icons";
import { Screen } from "../components/Chrome";
import { Cell, Perforation, Ticket, TicketFoot, TicketGrid, TicketHead, TicketMethod } from "../components/Ticket";
import { changedKeys, daysOffRoast, fmtTime, lastLabel, PARAMS, round1, sameAsLabel } from "../lib/format";
import { useStore } from "../state/store";
import { c, g, tabular } from "../theme/text";
import { C } from "../theme/tokens";

const DEFECTS = ["Sour", "Bitter", "Thin", "Harsh"];
const TARGET_MS = 150_000;

export const Home = () => {
  const s = useStore();
  const bean = s.currentBean;
  const changes = changedKeys(s.params, s.base);
  const days = daysOffRoast(bean?.roastDate ?? null);

  const idle = !s.sheet && !s.ratePrompt && !s.wheelOpen;

  return (
    <Screen>
      {s.ratePrompt && <RateCard />}
      <View style={st.head}>
        <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => (bean ? s.setSheet("switcher") : s.setScreen("scan"))}>
          <Text style={st.beanName} numberOfLines={1}>{bean ? bean.name : "NO BAG OPEN"} <Text style={st.chev}>{bean ? "⌄" : ""}</Text></Text>
          <Text style={st.beanMeta} numberOfLines={1}>
            {bean ? `${bean.roaster ?? "unknown roaster"} · ${days === null ? "roast date unset" : `${days} d off roast`}` : "the log starts with a bag"}
          </Text>
        </Pressable>
        <View style={st.acts}>
          <EyeGlyph idle={idle} onPress={() => (bean ? s.setScreen("bean") : s.setScreen("scan"))} />
        </View>
      </View>

      {!bean ? <FirstBag /> : (
        <>
          <Ticket>
            <TicketHead number={String(s.nextNumber).padStart(3, "0")} />
            <TicketMethod />
            <TicketGrid cells={[
              ...PARAMS.map((cfg) => {
                const v = s.params[cfg.key];
                const b = s.base[cfg.key];
                const changed = v !== b;
                return <Cell key={cfg.key} label={cfg.label} value={cfg.fmt(v)} unit={cfg.cellUnit} was={changed ? `was ${cfg.fmt(b)}` : ""} changed={changed} onPress={() => s.setSheet("adjust")} />;
              }),
              <Cell key="time" label="TIME" value={fmtTime(TARGET_MS)} onPress={() => s.setSheet("adjust")} />,
            ]} />
            <TicketFoot
              text={s.ticketSource
                ? `from ${s.ticketSource.name}'s N° ${String(s.ticketSource.number).padStart(3, "0")}`
                : changes.length
                  ? `${changes.length} ${changes.length === 1 ? "change" : "changes"} from last brew`
                  : sameAsLabel(bean.lastBrewedAt)}
              stamp="UNBREWED" />
            <Perforation />
            <Pressable style={({ pressed }) => [st.brewBtn, pressed && { backgroundColor: "rgba(38, 36, 46, 0.05)" }]}
              onPress={() => { s.dismissRatePrompt(); s.setSheet(null); s.setScreen("timer"); }}>
              <Text style={st.brewText}>▶  BREW</Text>
            </Pressable>
          </Ticket>
          <Hint style={{ marginTop: 11 }}>tap any value to adjust · speak changes while you brew</Hint>
          <Spacer />
          <View style={st.bar}>
            <Outline style={{ flex: 1 }} onPress={() => s.setSheet("adjust")}>ADJUST</Outline>
            <Pressable style={({ pressed }) => [st.wheelBtn, pressed && { backgroundColor: C.copper12 }]} onPress={() => s.openWheel()} accessibilityLabel="Tag flavours"><WheelIcon /></Pressable>
          </View>
        </>
      )}
      {s.sheet === "adjust" && <AdjustSheet />}
      {s.sheet === "switcher" && <SwitcherSheet />}
    </Screen>
  );
};

/**
 * The hard wall (§7): there is no brewing without a bag, so the empty state is the first task
 * rather than a disabled button with an explanation next to it.
 */
const FirstBag = () => {
  const s = useStore();
  return (
    <View style={st.firstbag}>
      <Ticket ghost style={{ marginHorizontal: 0 }}>
        <TicketHead number="001" />
        <TicketGrid cells={[...PARAMS.map((cfg) => cfg.label), "TIME"].map((label) => <Cell key={label} label={label} value="—" ghost />)} />
        <TicketFoot text="nothing to dial in yet" stamp="EMPTY" />
      </Ticket>
      <Text style={st.firstbagText}>A brew is one bag of coffee, dialled in. Add the bag and the ticket writes itself.</Text>
      <Spacer />
      <Cta label="ADD YOUR FIRST BAG" onPress={() => s.setScreen("scan")} />
    </View>
  );
};

const RateCard = () => {
  const s = useStore();
  const brew = s.ratePrompt!;
  const [defects, setDefects] = useState<string[]>(brew.defects);
  const toggle = (d: string) => {
    const next = defects.includes(d) ? defects.filter((x) => x !== d) : [...defects, d];
    setDefects(next);
    void s.rateBrew(brew.id, null, next);
  };
  const pick = (n: number) => {
    void s.rateBrew(brew.id, n, null);
    s.dismissRatePrompt();
    s.showToast("Rated " + "★".repeat(n));
  };
  return (
    <FadeUp duration={400} style={st.rate}>
      <View style={st.rateHead}>
        <Text style={st.rateTitle}>RATE N° {String(brew.number).padStart(3, "0")}</Text>
        <Pressable onPress={s.dismissRatePrompt} accessibilityLabel="Skip rating" style={{ paddingVertical: 4, paddingHorizontal: 6 }}><Text style={{ color: C.text50, fontSize: 15 }}>✕</Text></Pressable>
      </View>
      <View style={st.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => pick(n)} style={({ pressed }) => [st.star, pressed && { backgroundColor: C.copper20 }]}><Text style={{ fontSize: 19, color: C.copperLight }}>★</Text></Pressable>
        ))}
      </View>
      <View style={st.defects}>
        {DEFECTS.map((d) => <Defect key={d} on={defects.includes(d)} onPress={() => toggle(d)}>{d}</Defect>)}
        <Pressable onPress={() => s.openWheel(brew)} style={st.tagcta}><Text style={st.tagctaText}>TAG FLAVOURS →</Text></Pressable>
      </View>
    </FadeUp>
  );
};

const AdjustSheet = () => {
  const s = useStore();
  const n = changedKeys(s.params, s.base).length;
  return (
    <>
      <Backdrop onPress={() => s.setSheet(null)} />
      <Sheet>
        <SheetHead title="ADJUST" count={n ? `${n} changed` : "nothing changed yet"} />
        {PARAMS.map((cfg) => {
          const v = s.params[cfg.key];
          const b = s.base[cfg.key];
          return (
            <View key={cfg.key} style={st.adjRow}>
              <View style={{ width: 64 }}><Text style={st.adjLbl}>{cfg.label}</Text><Text style={st.adjUnit}>{cfg.unit}</Text></View>
              <Stepper label={`${cfg.label} down`} onPress={() => s.setParam(cfg.key, Math.max(0, round1(v - cfg.step)))}>−</Stepper>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={st.adjVal}>{cfg.fmt(v)}</Text>
                <Text style={st.adjDelta}>{v !== b ? cfg.delta(v, b) : ""}</Text>
              </View>
              <Stepper label={`${cfg.label} up`} onPress={() => s.setParam(cfg.key, round1(v + cfg.step))}>+</Stepper>
            </View>
          );
        })}
        <Cta panel label="DONE" style={{ marginTop: 16 }} onPress={() => s.setSheet(null)} />
      </Sheet>
    </>
  );
};

const Stepper = ({ children, onPress, label }: { children: string; onPress: () => void; label: string }) => (
  <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [st.stepper, pressed && { backgroundColor: C.copper12 }]}>
    <Text style={{ fontSize: 20, color: C.copperLight }}>{children}</Text>
  </Pressable>
);

const SwitcherSheet = () => {
  const s = useStore();
  return (
    <>
      <Backdrop onPress={() => s.setSheet(null)} />
      <Sheet>
        <SheetHead title="OPEN BAGS" />
        <ScrollView style={{ maxHeight: 380 }}>
          {s.beansOpen.length === 0 && <Empty>No open bags yet.</Empty>}
          {s.beansOpen.map((b) => {
            const d = daysOffRoast(b.roastDate);
            return (
              <Pressable key={b.id} style={st.switchRow} onPress={() => { s.selectBean(b.id); s.setSheet(null); }}>
                <Text style={st.switchMark}>{b.id === s.currentBean?.id ? "✦" : ""}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.switchName}>{b.name}</Text>
                  <Text style={st.switchSub}>{b.roaster ?? "unknown roaster"} · {d === null ? "roast date unset" : `${d} d off roast`}</Text>
                </View>
                <Text style={st.switchLast}>LAST {lastLabel(b.lastBrewedAt)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
};

const st = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 14, paddingHorizontal: 26 },
  beanName: { ...g(700, 17, 3), textTransform: "uppercase" },
  chev: { color: C.text45, fontFamily: "SpaceGrotesk_400Regular" },
  beanMeta: { ...g(400, 12, 1.5, C.text55), marginTop: 3, textTransform: "uppercase" },
  acts: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 8 },
  brewBtn: { alignItems: "center", justifyContent: "center", paddingTop: 15, paddingBottom: 17, width: "100%" },
  brewText: g(700, 17, 7, C.ink),
  bar: { paddingHorizontal: 22, paddingBottom: 14, flexDirection: "row", gap: 12 },
  wheelBtn: { width: 56, height: 56, borderWidth: 1, borderColor: C.copper55, alignItems: "center", justifyContent: "center" },
  firstbag: { flex: 1, paddingHorizontal: 20, paddingBottom: 16, minHeight: 0 },
  firstbagText: { ...g(400, 13, 0, C.text55), lineHeight: 19.5, marginTop: 18, textAlign: "center" },
  rate: { marginTop: 10, marginHorizontal: 20, borderWidth: 1, borderColor: C.copper55, backgroundColor: C.copper08, paddingVertical: 14, paddingHorizontal: 16 },
  rateHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rateTitle: c(700, 11, 3, C.copperLight),
  stars: { flexDirection: "row", gap: 8, marginTop: 12 },
  star: { flex: 1, height: 46, borderWidth: 1, borderColor: C.copper50, alignItems: "center", justifyContent: "center" },
  defects: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" },
  tagcta: { height: 34, justifyContent: "center", paddingHorizontal: 13 },
  tagctaText: g(600, 12, 1, C.copperLight),
  adjRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderStyle: "dotted", borderBottomColor: C.copper30 },
  adjLbl: c(700, 10, 2, C.text60),
  adjUnit: { ...g(400, 10, 0, C.text40), marginTop: 2 },
  stepper: { width: 52, height: 48, borderWidth: 1, borderColor: C.copper55, alignItems: "center", justifyContent: "center" },
  adjVal: { ...g(600, 24), ...tabular },
  adjDelta: { ...c(700, 10, 1, C.copperLight), height: 14, lineHeight: 14 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderStyle: "dotted", borderBottomColor: C.copper30, width: "100%" },
  switchMark: { width: 16, color: C.copper, fontSize: 10 },
  switchName: { ...g(600, 16, 1), textTransform: "uppercase" },
  switchSub: { ...g(400, 12, 0, C.text55), marginTop: 2 },
  switchLast: c(700, 10, 1, C.text50),
});
