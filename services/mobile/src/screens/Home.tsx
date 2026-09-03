import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { FadeUp } from "../components/Anim";
import { Backdrop, Cta, DashedRule, Empty, Hint, Outline, Sheet, SheetHead, Spacer } from "../components/Chrome";
import { EyeGlyph, WheelIcon } from "../components/Icons";
import { RateRow } from "../components/RateRow";
import { Screen } from "../components/Chrome";
import { Cell, Perforation, Ticket, TicketFoot, TicketGrid, TicketHead, TicketMethod } from "../components/Ticket";
import { changedKeys, daysOffRoast, durationDelta, fmtTime, lastLabel, METHOD_LABEL, METHODS, paramsFor, parseClock, round1, sameAsLabel, val, whenLabel } from "../lib/format";
import { useStore } from "../state/store";
import { c, g, tabular } from "../theme/text";
import { C } from "../theme/tokens";

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
            <TicketMethod label={METHOD_LABEL[s.params.method]} onPress={() => s.setSheet("method")} />
            <TicketGrid cells={paramsFor(s.params.method).map((cfg) => {
              const v = val(s.params, cfg.key);
              const b = val(s.base, cfg.key);
              const sameMethod = s.params.method === s.base.method;
              const changed = !sameMethod || v !== b;
              return <Cell key={cfg.key} label={cfg.label} value={cfg.fmt(v)} unit={cfg.cellUnit} was={changed && sameMethod ? `was ${cfg.fmt(b)}` : ""} changed={changed} onPress={() => s.setSheet("adjust")} />;
            })} />
            <TicketFoot
              text={s.ticketSource
                ? `from ${s.ticketSource.name}'s N° ${String(s.ticketSource.number).padStart(3, "0")}`
                : s.params.method !== s.base.method
                  ? `${METHOD_LABEL[s.params.method].toLowerCase()} — was ${METHOD_LABEL[s.base.method].toLowerCase()}`
                  : changes.length
                  ? `${changes.length} ${changes.length === 1 ? "change" : "changes"} from last brew`
                  : sameAsLabel(bean.lastBrewedAt)}
              stamp="UNBREWED" />
            <Perforation />
            <Pressable style={({ pressed }) => [st.brewBtn, pressed && { backgroundColor: "rgba(38, 36, 46, 0.05)" }]}
              onPress={() => { s.dismissRatePrompt(); s.setSheet(null); s.setScreen("timer"); }}>
              <Text style={st.brewText}>{"\u25B6\uFE0E  BREW"}</Text>
            </Pressable>
          </Ticket>
          <Pressable style={st.linkHint} onPress={() => { s.dismissRatePrompt(); s.setSheet(null); void s.commitBrew(null, []); }}>
            <Text style={st.linkHintText}>timed on the scale? <Text style={st.linkHintLink}>LOG WITHOUT TIMER</Text></Text>
          </Pressable>
          <Hint style={{ marginTop: 6 }}>tap any value to adjust · speak changes while you brew</Hint>
          <Spacer />
          <View style={st.bar}>
            <Outline style={{ flex: 1 }} onPress={() => s.setSheet("adjust")}>ADJUST</Outline>
            <Pressable style={({ pressed }) => [st.wheelBtn, pressed && { backgroundColor: C.copper12 }]} onPress={() => s.openWheel()} accessibilityLabel="Tag flavours"><WheelIcon /></Pressable>
          </View>
        </>
      )}
      {s.sheet === "adjust" && <AdjustSheet />}
      {s.sheet === "switcher" && <SwitcherSheet />}
      {s.sheet === "method" && <MethodSheet />}
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
        <TicketGrid cells={paramsFor("filter").map((cfg) => <Cell key={cfg.key} label={cfg.label} value="—" ghost />)} />
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
  const [time, setTime] = useState("");
  const typed = parseClock(time);
  const saveTime = () => { if (typed !== null && typed > 0) void s.setBrewDuration(brew.id, typed); };
  return (
    <FadeUp duration={400} style={st.rate}>
      <View style={st.rateHead}>
        <Text style={st.rateTitle}>RATE N° {String(brew.number).padStart(3, "0")}</Text>
        <Pressable onPress={s.dismissRatePrompt} accessibilityLabel="Skip rating" style={{ paddingVertical: 4, paddingHorizontal: 6 }}><Text style={{ color: C.text50, fontSize: 15 }}>✕</Text></Pressable>
      </View>
      {brew.durationMs === 0 && (
        <View style={st.rateTime}>
          <Text style={st.rateTimeK}>TIME</Text>
          <TextInput style={st.rateTimeInput} keyboardType="numbers-and-punctuation" placeholder="m:ss" placeholderTextColor={C.text45}
            value={time} onChangeText={setTime} onBlur={saveTime} onSubmitEditing={saveTime} accessibilityLabel="Brew time" />
          <Text style={st.rateTimeV}>{typed !== null && typed > 0 ? durationDelta(typed, brew.params.targetMs) || "on target" : `target ${fmtTime(brew.params.targetMs)}`}</Text>
        </View>
      )}
      {brew.durationMs > 0 && !!durationDelta(brew.durationMs, brew.params.targetMs) && (
        <View style={st.rateTime}><Text style={st.rateTimeK}>TIME</Text><Text style={st.rateTimeV}>{fmtTime(brew.durationMs)} · {durationDelta(brew.durationMs, brew.params.targetMs)} vs target</Text></View>
      )}
      <RateRow brew={brew} onPick={(n) => { if (n) s.dismissRatePrompt(); }}>
        <Pressable onPress={() => s.openWheel(brew)} style={st.tagcta}><Text style={st.tagctaText}>TAG FLAVOURS →</Text></Pressable>
      </RateRow>
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
        {paramsFor(s.params.method).map((cfg) => {
          const v = val(s.params, cfg.key);
          const b = val(s.base, cfg.key);
          return (
            <View key={cfg.key}>
            <View style={st.adjRow}>
              <View style={{ width: 64 }}><Text style={st.adjLbl}>{cfg.label}</Text><Text style={st.adjUnit}>{cfg.unit}</Text></View>
              <Stepper label={`${cfg.label} down`} onPress={() => s.setParam(cfg.key, Math.max(0, round1(v - cfg.step)))}>−</Stepper>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={st.adjVal}>{cfg.fmt(v)}</Text>
                <Text style={st.adjDelta}>{v !== b && s.params.method === s.base.method ? cfg.delta(v, b) : ""}</Text>
              </View>
              <Stepper label={`${cfg.label} up`} onPress={() => s.setParam(cfg.key, round1(v + cfg.step))}>+</Stepper>
            </View>
            <DashedRule color={C.copper30} dotted />
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

/** One row per method: what switching would put on the ticket, so the choice is not blind. */
const MethodSheet = () => {
  const s = useStore();
  return (
    <>
      <Backdrop onPress={() => s.setSheet(null)} />
      <Sheet>
        <SheetHead title="METHOD" />
        {METHODS.map((m) => {
          const last = s.lastOfMethod(m);
          return (
            <View key={m}>
            <Pressable style={st.switchRow} onPress={() => { s.setMethod(m); s.setSheet(null); }}>
              <Text style={st.switchMark}>{m === s.params.method ? "✦" : ""}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.switchName}>{METHOD_LABEL[m]}</Text>
                <Text style={st.switchSub}>{last ? `last brewed ${whenLabel(last.brewedAt).toLowerCase()} · ${fmtTime(last.params.targetMs)} target` : "method defaults"}</Text>
              </View>
            </Pressable>
            <DashedRule color={C.copper30} dotted />
            </View>
          );
        })}
      </Sheet>
    </>
  );
};

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
              <View key={b.id}>
              <Pressable style={st.switchRow} onPress={() => { s.selectBean(b.id); s.setSheet(null); }}>
                <Text style={st.switchMark}>{b.id === s.currentBean?.id ? "✦" : ""}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.switchName}>{b.name}</Text>
                  <Text style={st.switchSub}>{b.roaster ?? "unknown roaster"} · {d === null ? "roast date unset" : `${d} d off roast`}</Text>
                </View>
                <Text style={st.switchLast}>LAST {lastLabel(b.lastBrewedAt)}</Text>
              </Pressable>
              <DashedRule color={C.copper30} dotted />
              </View>
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
  linkHint: { marginTop: 10, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  linkHintText: { ...g(400, 12, 0, C.text50), textAlign: "center" },
  linkHintLink: { ...g(700, 12, 1, C.copper), marginLeft: 4 },
  rateTime: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  rateTimeK: { ...c(700, 10, 2, C.text50), width: 44 },
  rateTimeInput: { width: 74, paddingVertical: 8, paddingHorizontal: 10, ...c(700, 15, 1, C.text), borderWidth: 1, borderColor: C.copper30 },
  rateTimeV: g(400, 12, 0, C.text55),
  rate: { marginTop: 10, marginHorizontal: 20, borderWidth: 1, borderColor: C.copper55, backgroundColor: C.copper08, paddingVertical: 14, paddingHorizontal: 16 },
  rateHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rateTitle: c(700, 11, 3, C.copperLight),
  tagcta: { height: 34, justifyContent: "center", paddingHorizontal: 13 },
  tagctaText: g(600, 12, 1, C.copperLight),
  adjRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  adjLbl: c(700, 10, 2, C.text60),
  adjUnit: { ...g(400, 10, 0, C.text40), marginTop: 2 },
  stepper: { width: 52, height: 48, borderWidth: 1, borderColor: C.copper55, alignItems: "center", justifyContent: "center" },
  adjVal: { ...g(600, 24), ...tabular },
  adjDelta: { ...c(700, 10, 1, C.copperLight), height: 14, lineHeight: 14 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, width: "100%" },
  switchMark: { width: 16, color: C.copper, fontSize: 10 },
  switchName: { ...g(600, 16, 1), textTransform: "uppercase" },
  switchSub: { ...g(400, 12, 0, C.text55), marginTop: 2 },
  switchLast: c(700, 10, 1, C.text50),
});
