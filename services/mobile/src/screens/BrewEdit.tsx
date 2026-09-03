import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { BrewMethod, BrewParams, BrewStep } from "../api/types";
import { Act, Cta, Nav, Rule, Screen, SqBtn, Title } from "../components/Chrome";
import { Field } from "../components/Ledger";
import { RateRow } from "../components/RateRow";
import { fmtLocalDateTime, fmtTime, METHOD_DEFAULTS, METHOD_LABEL, METHODS, paramsFor, parseClock, parseLocalDateTime, round1, stepName, val } from "../lib/format";
import { useStore } from "../state/store";
import { c, g, tabular } from "../theme/text";
import { C } from "../theme/tokens";

/** Switching method keeps what carries across (grind, dose, water) and takes the rest from the method's defaults. */
const switchMethod = (p: BrewParams, m: BrewMethod): BrewParams =>
  p.method === m ? p : { ...METHOD_DEFAULTS[m], grind: p.grind, doseG: p.doseG, tempC: p.tempC };

/**
 * A brew after the fact: the numbers as they really were, the time off the scale, when it was,
 * the rating once the cup has cooled. Deltas read against the brew before it in the same bag.
 */
export const BrewEdit = () => {
  const s = useStore();
  const brew = s.editTarget;
  const [params, setParams] = useState<BrewParams>(() => brew?.params ?? METHOD_DEFAULTS.filter);
  const [time, setTime] = useState(() => (brew?.durationMs ? fmtTime(brew.durationMs) : ""));
  const [at, setAt] = useState(() => (brew ? fmtLocalDateTime(brew.brewedAt) : ""));
  const [steps, setSteps] = useState<BrewStep[]>(() => brew?.steps ?? []);
  const [editing, setEditing] = useState<"time" | "at" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!brew) s.setScreen("bean"); });
  if (!brew) return null;

  const hist = s.brewsFor(brew.beanId);
  const prev = hist[hist.findIndex((h) => h.id === brew.id) + 1] ?? null;
  const base = prev && prev.params.method === params.method ? prev.params : null;
  const n = String(brew.number).padStart(3, "0");
  const back = () => s.setScreen("bean");
  const typed = parseClock(time);
  const timeBad = time.trim() !== "" && typed === null;
  const atIso = parseLocalDateTime(at);

  const save = async () => {
    if (timeBad) { s.showToast("Time reads m:ss, like 2:41"); return; }
    if (!atIso) { s.showToast("Brewed-at reads yyyy-mm-dd hh:mm"); return; }
    setSaving(true);
    const ok = await s.updateBrew(brew.id, { params, durationMs: typed ?? 0, brewedAt: atIso, steps });
    setSaving(false);
    if (ok) { back(); s.showToast(`N° ${n} updated`); }
  };
  const remove = async () => {
    if (await s.deleteBrew(brew.id)) back();
  };

  return (
    <Screen>
      <Nav>
        <SqBtn onPress={back} label="Back to the bean">←</SqBtn>
        <Title>EDIT N° {n}</Title>
      </Nav>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 26 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={st.field}>
            <Text style={st.k}>METHOD</Text>
            <View style={st.seg}>
              {METHODS.map((m) => {
                const on = m === params.method;
                return (
                  <Pressable key={m} onPress={() => setParams(switchMethod(params, m))} accessibilityState={{ selected: on }} style={[st.segBtn, on && st.segOn]}>
                    <Text style={[st.segText, on && { color: C.copperLight }]}>{METHOD_LABEL[m]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {paramsFor(params.method).map((p) => {
            const v = val(params, p.key);
            const b = base ? val(base, p.key) : null;
            return (
              <View key={p.key} style={st.adjRow}>
                <View style={{ width: 64 }}><Text style={st.adjLbl}>{p.label}</Text><Text style={st.adjUnit}>{p.unit}</Text></View>
                <Pressable style={st.stepper} onPress={() => setParams({ ...params, [p.key]: Math.max(0, round1(v - p.step)) })} accessibilityLabel={`${p.label} down`}><Text style={st.stepperText}>−</Text></Pressable>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={st.adjVal}>{p.fmt(v)}</Text>
                  <Text style={st.adjDelta}>{b !== null && v !== b ? p.delta(v, b) : b !== null ? "" : "no earlier brew"}</Text>
                </View>
                <Pressable style={st.stepper} onPress={() => setParams({ ...params, [p.key]: round1(v + p.step) })} accessibilityLabel={`${p.label} up`}><Text style={st.stepperText}>+</Text></Pressable>
              </View>
            );
          })}
          <Field label="TIME" value={time} editing={editing === "time"} placeholder="m:ss · empty for untimed" keyboard="numbers-and-punctuation"
            onEdit={() => setEditing("time")} onDone={() => setEditing(null)} onChange={setTime} required={timeBad} provenance={timeBad ? "missing" : undefined} />
          <Field label="BREWED AT" value={at} editing={editing === "at"} placeholder="yyyy-mm-dd hh:mm" keyboard="numbers-and-punctuation"
            onEdit={() => setEditing("at")} onDone={() => setEditing(null)} onChange={setAt} />
          {steps.length > 0 && (
            <>
              <Rule label="STEPS" right={`${steps.length}`} style={{ marginTop: 18 }} />
              {steps.map((step, i) => (
                <View key={`${step.atMs}-${i}`} style={st.stepRow}>
                  <Text style={st.stepName}>{stepName(steps, i)}</Text>
                  <Text style={st.stepAt}>{fmtTime(step.atMs)}</Text>
                  <SqBtn onPress={() => setSteps(steps.filter((_, j) => j !== i))} label={`Remove ${stepName(steps, i)} at ${fmtTime(step.atMs)}`}>✕</SqBtn>
                </View>
              ))}
            </>
          )}
          <Rule label="RATING" style={{ marginTop: 18 }} />
          <RateRow brew={brew}>
            <Pressable onPress={() => s.openWheel(brew)} style={st.tagcta}><Text style={st.tagctaText}>TAG FLAVOURS →</Text></Pressable>
          </RateRow>
          <Rule label="REMOVE" style={{ marginTop: 22 }} />
          {confirm ? (
            <View style={st.confirm}>
              <Text style={st.confirmText}>Delete N° {n}? The number is not reused.</Text>
              <View style={st.acts}>
                <Act style={{ borderColor: C.rust }} textStyle={{ color: C.rustLight }} onPress={() => void remove()}>DELETE</Act>
                <Act quiet onPress={() => setConfirm(false)}>KEEP</Act>
              </View>
            </View>
          ) : (
            <View style={[st.acts, { paddingBottom: 14 }]}>
              <Act quiet onPress={() => setConfirm(true)}>DELETE BREW</Act>
            </View>
          )}
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
          <Cta label={saving ? "SAVING…" : "SAVE BREW"} onPress={() => void save()} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const st = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(194, 144, 94, 0.18)", width: "100%" },
  k: { ...c(700, 10, 2, C.text55), width: 86 },
  seg: { flexDirection: "row", gap: 8, flex: 1 },
  segBtn: { flex: 1, height: 38, borderWidth: 1, borderStyle: "dashed", borderColor: C.copper45, alignItems: "center", justifyContent: "center" },
  segOn: { borderStyle: "solid", borderColor: C.copperLight, backgroundColor: "rgba(194, 144, 94, 0.18)" },
  segText: c(700, 11, 2, C.text75),
  adjRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  adjLbl: c(700, 10, 2, C.text60),
  adjUnit: { ...g(400, 10, 0, C.text40), marginTop: 2 },
  stepper: { width: 52, height: 48, borderWidth: 1, borderColor: C.copper55, alignItems: "center", justifyContent: "center" },
  stepperText: { fontSize: 22, color: C.copperLight },
  adjVal: { ...g(600, 24), ...tabular },
  adjDelta: { ...c(700, 10, 1, C.copperLight), height: 14, lineHeight: 14 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: "rgba(194, 144, 94, 0.18)" },
  stepName: { ...c(700, 11, 2, C.copperLight), flex: 1 },
  stepAt: { ...g(600, 15), ...tabular, color: C.text85 },
  tagcta: { height: 34, justifyContent: "center", paddingHorizontal: 13 },
  tagctaText: g(600, 12, 1, C.copperLight),
  acts: { flexDirection: "row", gap: 8, marginTop: 11, flexWrap: "wrap" },
  confirm: { marginTop: 11, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.rust, backgroundColor: "rgba(161, 85, 63, 0.12)" },
  confirmText: g(400, 13, 0, C.text75),
});
