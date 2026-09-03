import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import type { ExtractedField, LabelScan } from "../api/types";
import { Cta, Hint, Nav, Screen, Spacer, SqBtn, Title } from "../components/Chrome";
import { Field, Notes, type Provenance } from "../components/Ledger";
import { useStore } from "../state/store";
import { g } from "../theme/text";
import { C } from "../theme/tokens";
import { grams } from "./BeanEdit";
import { takeScanResult, Thumb, type ScanResult } from "./Scan";

type Key = "roaster" | "bean" | "origin" | "process" | "roastDate" | "producer" | "varietal" | "altitude" | "roastLevel" | "weight";
const FIELDS: { key: Key; label: string; required?: boolean; needHint?: string; date?: boolean }[] = [
  { key: "roaster", label: "ROASTER" },
  { key: "bean", label: "BEAN", required: true, needHint: "set — the bag needs a name" },
  { key: "origin", label: "ORIGIN" },
  { key: "process", label: "PROCESS" },
  { key: "roastDate", label: "ROAST DATE", required: true, needHint: "set — needed for days off roast", date: true },
  { key: "producer", label: "PRODUCER" },
  { key: "varietal", label: "VARIETAL" },
  { key: "altitude", label: "ALTITUDE" },
  { key: "roastLevel", label: "ROAST LEVEL" },
  { key: "weight", label: "BAG WEIGHT" },
];

const empty = (): LabelScan => {
  const m: ExtractedField = { value: null, provenance: "missing" };
  return { scanId: "", extracted: false, reason: null, roaster: m, bean: m, origin: m, process: m, roastDate: m, producer: m, varietal: m, altitude: m, roastLevel: m, weight: m, declaredNotes: [] };
};

export const ScanForm = () => {
  const s = useStore();
  const [result] = useState<ScanResult>(() => takeScanResult() ?? { scan: empty(), preview: null });
  const scan = result.scan;
  const [values, setValues] = useState<Record<Key, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, scan[f.key].value ?? ""])) as Record<Key, string>);
  const [notes, setNotes] = useState<string[]>(() => scan.declaredNotes.map((n) => n.text));
  const [editing, setEditing] = useState<Key | null>(null);
  const [saving, setSaving] = useState(false);
  const categories = useMemo(() => new Map(scan.declaredNotes.map((n) => [n.text, n.category])), [scan]);

  const provenance = (k: Key): Provenance => {
    const v = values[k].trim();
    if (!v) return "missing";
    if (v !== (scan[k].value ?? "")) return "edited";
    return scan[k].provenance;
  };

  const save = async () => {
    if (!values.bean.trim()) { s.showToast("The bag needs a name"); setEditing("bean"); return; }
    setSaving(true);
    try {
      const bean = await api.createBean({
        name: values.bean.trim(), roaster: values.roaster || null, origin: values.origin || null, process: values.process || null,
        roastDate: values.roastDate || null, producer: values.producer || null, varietal: values.varietal || null,
        altitude: values.altitude || null, roastLevel: values.roastLevel || null, declaredNotes: notes,
        weightG: grams(values.weight),
        labelScanId: scan.scanId || null,
      });
      const first = s.beansOpen.length === 0;
      s.addBean(bean);
      // The first bag lands on a ticket that is ready to brew (§7); later ones go back to the shelf.
      s.setScreen(first ? "home" : "library");
      s.showToast(`${bean.name} added to the library`);
    } catch (e) {
      setSaving(false);
      s.showToast(e instanceof ApiError ? `Not saved — ${e.message}` : "Not saved — the brew log could not be reached");
    }
  };

  return (
    <Screen>
      <Nav>
        <SqBtn onPress={() => s.setScreen("scan")} label="Back">←</SqBtn>
        <View>
          <Title>CONFIRM BAG</Title>
          <Text style={{ ...g(400, 12, 0, C.text55), marginTop: 2 }}>● extracted · ◐ partial · ○ needs you</Text>
        </View>
        <Spacer />
        <Thumb uri={result.preview} />
      </Nav>
      {scan.reason && <Hint left style={{ marginTop: 12, marginHorizontal: 26, color: C.rustLight }}>{scan.reason}</Hint>}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 26 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} value={values[f.key]} editing={editing === f.key} required={f.required} hint={f.needHint} provenance={provenance(f.key)}
              placeholder={f.date ? "yyyy-mm-dd" : f.label.toLowerCase()} keyboard={f.date ? "numbers-and-punctuation" : "default"}
              onEdit={() => setEditing(f.key)} onDone={() => setEditing(null)} onChange={(v) => setValues({ ...values, [f.key]: v })} />
          ))}
          <Notes notes={notes} setNotes={setNotes} categories={categories} />
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
          <Cta label={saving ? "SAVING…" : "SAVE BAG"} onPress={save} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};
