import { useState } from "react";
import type { BrewParams, BrewMethod, BrewStep } from "../api/types";
import { Rule } from "../components/Chrome";
import { RateRow } from "../components/RateRow";
import { fmtLocalDateTime, fmtTime, METHOD_DEFAULTS, METHOD_LABEL, METHODS, paramsFor, parseClock, parseLocalDateTime, round1, stepName, val } from "../lib/format";
import { useStore } from "../state/store";

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
  const [at, setAt] = useState(() => (brew ? fmtLocalDateTime(brew.brewedAt, "T") : ""));
  const [steps, setSteps] = useState<BrewStep[]>(() => brew?.steps ?? []);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!brew) { s.setScreen("bean"); return null; }

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
    if (!atIso) { s.showToast("Brewed-at needs a date and a time"); return; }
    setSaving(true);
    const ok = await s.updateBrew(brew.id, { params, durationMs: typed ?? 0, brewedAt: atIso, steps });
    setSaving(false);
    if (ok) { back(); s.showToast(`N° ${n} updated`); }
  };
  const remove = async () => {
    if (await s.deleteBrew(brew.id)) back();
  };

  return (
    <div className="screen">
      <div className="nav">
        <button className="sqbtn" onClick={back} aria-label="Back to the bean">←</button>
        <div className="title">EDIT N° {n}</div>
      </div>
      <div className="ledger">
        <div className="field">
          <span className="k">METHOD</span>
          <div className="seg">
            {METHODS.map((m) => (
              <button key={m} className={"seg-btn" + (m === params.method ? " on" : "")} onClick={() => setParams(switchMethod(params, m))} aria-pressed={m === params.method}>{METHOD_LABEL[m]}</button>
            ))}
          </div>
        </div>
        {paramsFor(params.method).map((c) => {
          const v = val(params, c.key);
          const b = base ? val(base, c.key) : null;
          return (
            <div key={c.key} className="adj-row">
              <div className="lbl"><div>{c.label}</div><div>{c.unit}</div></div>
              <button className="stepper" onClick={() => setParams({ ...params, [c.key]: Math.max(0, round1(v - c.step)) })} aria-label={`${c.label} down`}>−</button>
              <div className="adj-val"><div>{c.fmt(v)}</div><div>{b !== null && v !== b ? c.delta(v, b) : b !== null ? "" : "no earlier brew"}</div></div>
              <button className="stepper" onClick={() => setParams({ ...params, [c.key]: round1(v + c.step) })} aria-label={`${c.label} up`}>+</button>
            </div>
          );
        })}
        <div className="field">
          <span className="k">TIME</span>
          <input inputMode="numeric" placeholder="m:ss · empty for untimed" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Brew time" />
          <span className={"dot" + (timeBad ? " bad" : "")}>{timeBad ? "?" : ""}</span>
        </div>
        <div className="field">
          <span className="k">BREWED AT</span>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Brewed at" />
        </div>
        {steps.length > 0 && (
          <>
            <div style={{ marginTop: 18 }}><Rule label="STEPS" right={`${steps.length}`} /></div>
            <div className="steps-edit">
              {steps.map((st, i) => (
                <div key={`${st.atMs}-${i}`} className="step-row">
                  <span className="step-name">{stepName(steps, i)}</span>
                  <span className="step-at">{fmtTime(st.atMs)}</span>
                  <button className="sqbtn" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label={`Remove ${stepName(steps, i)} at ${fmtTime(st.atMs)}`}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ marginTop: 18 }}><Rule label="RATING" /></div>
        <RateRow brew={brew}>
          <button className="tagcta" onClick={() => s.openWheel(brew)}>TAG FLAVOURS →</button>
        </RateRow>
        <div style={{ marginTop: 22 }}><Rule label="REMOVE" /></div>
        {confirm ? (
          <div className="confirm">
            <span>Delete N° {n}? The number is not reused.</span>
            <div className="acts">
              <button className="act danger" onClick={() => void remove()}>DELETE</button>
              <button className="act quiet" onClick={() => setConfirm(false)}>KEEP</button>
            </div>
          </div>
        ) : (
          <div className="acts" style={{ marginTop: 11, paddingBottom: 14 }}>
            <button className="act quiet" onClick={() => setConfirm(true)}>DELETE BREW</button>
          </div>
        )}
      </div>
      <div style={{ padding: "0 22px 14px" }}>
        <button className="cta" onClick={() => void save()} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}><span>{saving ? "SAVING…" : "SAVE BREW"}</span></button>
      </div>
    </div>
  );
};
