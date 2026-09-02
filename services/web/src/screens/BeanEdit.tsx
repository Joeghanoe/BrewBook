import { useState } from "react";
import { api, ApiError } from "../api/client";
import type { Bean } from "../api/types";
import { Rule } from "../components/Chrome";
import { categoryOf, groupOf } from "../lib/flavours";
import { useStore } from "../state/store";

type Key = "name" | "roaster" | "origin" | "process" | "roastDate" | "producer" | "varietal" | "altitude" | "roastLevel" | "weight";

const FIELDS: { key: Key; label: string; required?: boolean; type?: string; hint?: string }[] = [
  { key: "name", label: "BEAN", required: true, hint: "the bag needs a name" },
  { key: "roaster", label: "ROASTER" },
  { key: "origin", label: "ORIGIN" },
  { key: "process", label: "PROCESS" },
  { key: "roastDate", label: "ROAST DATE", type: "date" },
  { key: "producer", label: "PRODUCER" },
  { key: "varietal", label: "VARIETAL" },
  { key: "altitude", label: "ALTITUDE" },
  { key: "roastLevel", label: "ROAST LEVEL" },
  { key: "weight", label: "BAG WEIGHT" },
];

/** "250g", "1 kg", "250" → grams. Empty stays empty: no weight, no countdown (§7). */
const grams = (raw: string): number | null => {
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
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!bean) { s.setScreen("library"); return null; }

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
      back();
      s.showToast(`${updated.name} updated`);
    } catch (e) {
      setSaving(false);
      s.showToast(e instanceof ApiError ? `Not saved — ${e.message}` : "Not saved — the brew log could not be reached");
    }
  };

  const addNote = () => { const n = newNote.trim(); if (n && !notes.includes(n)) setNotes([...notes, n]); setNewNote(""); };

  return (
    <div className="screen">
      <div className="nav">
        <button className="sqbtn" onClick={back} aria-label="Back">←</button>
        <div className="title">EDIT BAG</div>
      </div>
      <div className="ledger">
        {FIELDS.map((f) => {
          const v = values[f.key];
          const isEditing = editing === f.key;
          const empty = v.trim() === "";
          return (
            <div key={f.key} className="field" onClick={() => !isEditing && setEditing(f.key)} role="button">
              <span className="k">{f.label}</span>
              {isEditing ? (
                <input autoFocus type={f.type ?? "text"} value={v} placeholder={f.label.toLowerCase()}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  onBlur={() => setEditing(null)} onKeyDown={(e) => { if (e.key === "Enter") setEditing(null); }} />
              ) : (
                <span className={"v" + (empty ? (f.required ? " need" : " none") : "")}>{v || (f.required ? f.hint : "—")}</span>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 18 }}><Rule label="DECLARED NOTES" /></div>
        <div className="chips" style={{ marginTop: 11, paddingBottom: 16 }}>
          {notes.map((n) => {
            const cat = groupOf(n) ? categoryOf(n) : null;
            return (
              <button key={n} className={"note-chip" + (cat ? "" : " quote")} onClick={() => setNotes(notes.filter((x) => x !== n))} title="Remove">
                {cat ? n : `"${n}"`}{cat && <span>→ {cat}</span>}
              </button>
            );
          })}
          <div className="note-add">
            <input value={newNote} placeholder="+ add a note" onChange={(e) => setNewNote(e.target.value)} onBlur={addNote} onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
          </div>
        </div>
        <div className="hint" style={{ textAlign: "left", paddingBottom: 10 }}>
          Clearing a field takes the value off the bag. Its brews are untouched either way.
        </div>
      </div>
      <div style={{ padding: "0 22px 14px" }}>
        <button className="cta" onClick={save} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}><span>{saving ? "SAVING…" : "SAVE BAG"}</span></button>
      </div>
    </div>
  );
};
