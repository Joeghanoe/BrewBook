import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { api, ApiError } from "../api/client";
import type { Bean } from "../api/types";
import { Cta, Hint, Nav, Screen, SqBtn, Title } from "../components/Chrome";
import { Field, Notes } from "../components/Ledger";
import { RoasterPicker } from "../components/RoasterPicker";
import { useStore } from "../state/store";

type Key = "name" | "roaster" | "origin" | "process" | "roastDate" | "producer" | "varietal" | "altitude" | "roastLevel" | "weight";

const FIELDS: { key: Key; label: string; required?: boolean; date?: boolean; hint?: string }[] = [
  { key: "name", label: "BEAN", required: true, hint: "the bag needs a name" },
  { key: "roaster", label: "ROASTER" },
  { key: "origin", label: "ORIGIN" },
  { key: "process", label: "PROCESS" },
  { key: "roastDate", label: "ROAST DATE", date: true },
  { key: "producer", label: "PRODUCER" },
  { key: "varietal", label: "VARIETAL" },
  { key: "altitude", label: "ALTITUDE" },
  { key: "roastLevel", label: "ROAST LEVEL" },
  { key: "weight", label: "BAG WEIGHT" },
];

/** "250g", "1 kg", "250" → grams. Empty stays empty: no weight, no countdown (§7). */
export const grams = (raw: string): number | null => {
  const m = raw.trim().toLowerCase().match(/^([\d.,]+)\s*(kg|g)?$/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2] === "kg" ? n * 1000 : n;
};

const initial = (bean: Bean): Record<Key, string> => ({
  name: bean.name,
  roaster: bean.roaster ?? "",
  origin: bean.origin ?? "",
  process: bean.process ?? "",
  roastDate: bean.roastDate ?? "",
  producer: bean.producer ?? "",
  varietal: bean.varietal ?? "",
  altitude: bean.altitude ?? "",
  roastLevel: bean.roastLevel ?? "",
  weight: bean.weightG === null ? "" : String(bean.weightG),
});

/**
 * The label is not always right, and a bag outlives the scan that made it: a roast date the label
 * never carried, a roaster spelled wrong. Same ledger as the confirm-bag screen, without the
 * provenance dots — every value here is the user's own.
 */
export const BeanEdit = () => {
  const s = useStore();
  const bean = s.currentBean;
  const [values, setValues] = useState<Record<Key, string>>(() => (bean ? initial(bean) : initial({} as Bean)));
  const [notes, setNotes] = useState<string[]>(() => bean?.declaredNotes ?? []);
  const [editing, setEditing] = useState<Key | null>(null);
  const [saving, setSaving] = useState(false);
  // A corrected roaster name may point at a place the app has not seen: ask where it is before going back.
  const [placing, setPlacing] = useState<Bean | null>(null);

  useEffect(() => { if (!bean) s.setScreen("library"); });
  if (!bean) return null;

  const back = () => s.setScreen("bean");

  const save = async () => {
    if (!values.name.trim()) { s.showToast("The bag needs a name"); setEditing("name"); return; }
    setSaving(true);
    try {
      const updated = await api.updateBean(bean.id, {
        name: values.name.trim(),
        roaster: values.roaster,
        origin: values.origin,
        process: values.process,
        roastDate: values.roastDate || null,
        clearRoastDate: values.roastDate.trim() === "",
        producer: values.producer,
        varietal: values.varietal,
        altitude: values.altitude,
        roastLevel: values.roastLevel,
        declaredNotes: notes,
        weightG: grams(values.weight),
        clearWeight: values.weight.trim() === "",
      });
      s.patchBean(updated);
      s.showToast(`${updated.name} updated`);
      if (updated.roasterId && !updated.roasterResolved) setPlacing(updated);
      else back();
    } catch (e) {
      setSaving(false);
      s.showToast(e instanceof ApiError ? `Not saved — ${e.message}` : "Not saved — the brew log could not be reached");
    }
  };

  return (
    <Screen>
      <Nav>
        <SqBtn onPress={back} label="Back">←</SqBtn>
        <Title>EDIT BAG</Title>
      </Nav>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 26 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} value={values[f.key]} editing={editing === f.key} required={f.required} hint={f.hint}
              placeholder={f.date ? "yyyy-mm-dd" : f.label.toLowerCase()} keyboard={f.date ? "numbers-and-punctuation" : "default"}
              onEdit={() => setEditing(f.key)} onDone={() => setEditing(null)} onChange={(v) => setValues({ ...values, [f.key]: v })} />
          ))}
          <Notes notes={notes} setNotes={setNotes} />
          <Hint left style={{ paddingBottom: 10 }}>Clearing a field takes the value off the bag. Its brews are untouched either way.</Hint>
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
          <Cta label={saving ? "SAVING…" : "SAVE BAG"} onPress={save} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
      {placing && placing.roasterId && (
        <RoasterPicker roasterId={placing.roasterId} name={placing.roaster ?? values.roaster}
          onPlaced={(r) => { s.patchBean({ ...placing, roasterLocated: r.located, roasterResolved: true }); back(); }}
          onClose={back} />
      )}
    </Screen>
  );
};
