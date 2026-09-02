import { useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type { ExtractedField, LabelScan } from "../api/types";
import { Rule } from "../components/Chrome";
import { categoryOf, groupOf } from "../lib/flavours";
import { useStore } from "../state/store";
import { takeScanResult, type ScanResult } from "./Scan";

type Key = "roaster" | "bean" | "origin" | "process" | "roastDate" | "producer" | "varietal" | "altitude" | "roastLevel" | "weight";
const FIELDS: { key: Key; label: string; required?: boolean; needHint?: string; type?: string }[] = [
  { key: "roaster", label: "ROASTER" },
  { key: "bean", label: "BEAN", required: true, needHint: "set — the bag needs a name" },
  { key: "origin", label: "ORIGIN" },
  { key: "process", label: "PROCESS" },
  { key: "roastDate", label: "ROAST DATE", required: true, needHint: "set — needed for days off roast", type: "date" },
  { key: "producer", label: "PRODUCER" },
  { key: "varietal", label: "VARIETAL" },
  { key: "altitude", label: "ALTITUDE" },
  { key: "roastLevel", label: "ROAST LEVEL" },
  { key: "weight", label: "BAG WEIGHT" },
];

/** "250g", "1 kg", "250" → grams. Skippable like any other field: no weight, no countdown (§7). */
const grams = (raw: string): number | null => {
  const m = raw.trim().toLowerCase().match(/^([\d.,]+)\s*(kg|g)?$/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2] === "kg" ? n * 1000 : n;
};

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
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const categories = useMemo(() => new Map(scan.declaredNotes.map((n) => [n.text, n.category])), [scan]);

  const provenance = (k: Key): "extracted" | "partial" | "missing" | "edited" => {
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

  const addNote = () => { const n = newNote.trim(); if (n && !notes.includes(n)) setNotes([...notes, n]); setNewNote(""); };

  return (
    <div className="screen">
      <div className="nav">
        <button className="sqbtn" onClick={() => s.setScreen("scan")} aria-label="Back">←</button>
        <div>
          <div className="title">CONFIRM BAG</div>
          <div className="s" style={{ font: "400 12px var(--grotesk)", color: "var(--text-55)", marginTop: 2 }}>● extracted · ◐ partial · ○ needs you</div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="thumb">{result.preview ? <img src={result.preview} alt="" /> : <>LABEL<br />KEPT</>}</div>
      </div>
      {scan.reason && <div className="hint" style={{ margin: "12px 26px 0", textAlign: "left", color: "var(--rust-light)" }}>{scan.reason}</div>}
      <div className="ledger">
        {FIELDS.map((f) => {
          const p = provenance(f.key);
          const v = values[f.key];
          const isEditing = editing === f.key;
          const dot = p === "missing" ? "○" : p === "partial" ? "◐" : "●";
          const dotCol = p === "missing" ? (f.required ? "#a1553f" : "rgba(233,214,174,.35)") : "#c2905e";
          return (
            <div key={f.key} className="field" onClick={() => !isEditing && setEditing(f.key)} role="button">
              <span className="k">{f.label}</span>
              {isEditing ? (
                <input autoFocus type={f.type ?? "text"} value={v} placeholder={f.label.toLowerCase()}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  onBlur={() => setEditing(null)} onKeyDown={(e) => { if (e.key === "Enter") setEditing(null); }} />
              ) : (
                <span className={"v" + (p === "missing" ? (f.required ? " need" : " none") : "")}>{v || (f.required ? f.needHint : "—")}</span>
              )}
              <span className="dot" style={{ color: dotCol }}>{dot}</span>
            </div>
          );
        })}
        <div style={{ marginTop: 18 }}><Rule label="DECLARED NOTES" /></div>
        <div className="chips" style={{ marginTop: 11, paddingBottom: 16 }}>
          {notes.map((n) => {
            const cat = categories.get(n) ?? (groupOf(n) ? categoryOf(n) : null);
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
      </div>
      <div style={{ padding: "0 22px 14px" }}>
        <button className="cta" onClick={save} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}><span>{saving ? "SAVING…" : "SAVE BAG"}</span></button>
      </div>
    </div>
  );
};
