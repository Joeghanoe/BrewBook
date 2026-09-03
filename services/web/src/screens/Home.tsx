import { useState } from "react";
import { Grabber, Rule, Star } from "../components/Chrome";
import { EyeGlyph, WheelIcon } from "../components/Icons";
import { changedKeys, daysOffRoast, durationDelta, fmtTime, lastLabel, METHOD_LABEL, METHODS, paramsFor, round1, sameAsLabel, val, whenLabel } from "../lib/format";
import { useStore } from "../state/store";

const DEFECTS = ["Sour", "Bitter", "Thin", "Harsh"];

export const Home = () => {
  const s = useStore();
  const bean = s.currentBean;
  const changes = changedKeys(s.params, s.base);
  const days = daysOffRoast(bean?.roastDate ?? null);

  const idle = !s.sheet && !s.ratePrompt && !s.wheelOpen;

  return (
    <div className="screen">
      {s.ratePrompt && <RateCard />}
      <div className="home-head">
        <button onClick={() => (bean ? s.setSheet("switcher") : s.setScreen("scan"))}>
          <div className="bean-name">{bean ? bean.name : "NO BAG OPEN"} <span>{bean ? "⌄" : ""}</span></div>
          <div className="bean-meta">
            {bean ? `${bean.roaster ?? "unknown roaster"} · ${days === null ? "roast date unset" : `${days} d off roast`}` : "the log starts with a bag"}
          </div>
        </button>
        <div className="home-acts">
          <EyeGlyph idle={idle} onClick={() => (bean ? s.setScreen("bean") : s.setScreen("scan"))} />
        </div>
      </div>

      {!bean ? <FirstBag /> : (
        <>
          <div className="ticket">
            <div className="punch l" /><div className="punch r" />
            <div className="ticket-head"><span>BREW TICKET</span><span>N° {String(s.nextNumber).padStart(3, "0")}</span></div>
            <button className="ticket-method" onClick={() => s.setSheet("method")} aria-label="Change brew method">
              <Star /> {METHOD_LABEL[s.params.method]} · HAND GRINDER <Star />
            </button>
            <div className="ticket-grid">
              {paramsFor(s.params.method).map((c) => {
                const v = val(s.params, c.key);
                const b = val(s.base, c.key);
                const changed = s.params.method !== s.base.method || v !== b;
                return (
                  <button key={c.key} className="cell" onClick={() => s.setSheet("adjust")}>
                    <div className="label">{c.label}</div>
                    <div className="value">{c.fmt(v)}<span>{c.cellUnit}</span></div>
                    <div className="was">{changed && s.params.method === s.base.method ? `was ${c.fmt(b)}` : ""}</div>
                    <div className="mark" style={{ opacity: changed ? 1 : 0 }} />
                  </button>
                );
              })}
            </div>
            <div className="ticket-foot">
              <span>
                {s.ticketSource
                  ? `from ${s.ticketSource.name}'s N° ${String(s.ticketSource.number).padStart(3, "0")}`
                  : s.params.method !== s.base.method
                    ? `${METHOD_LABEL[s.params.method].toLowerCase()} — was ${METHOD_LABEL[s.base.method].toLowerCase()}`
                    : changes.length
                    ? `${changes.length} ${changes.length === 1 ? "change" : "changes"} from last brew`
                    : sameAsLabel(bean.lastBrewedAt)}
              </span>
              <span className="stamp">UNBREWED</span>
            </div>
            <div className="perforation" />
            <button className="brew-btn" onClick={() => { s.dismissRatePrompt(); s.setSheet(null); s.setScreen("timer"); }}>▶ &nbsp;BREW</button>
          </div>
          <button className="hint link-hint" onClick={() => { s.dismissRatePrompt(); s.setSheet(null); void s.commitBrew(null, []); }}>
            timed on the scale? <u>LOG WITHOUT TIMER</u>
          </button>
          <div className="hint" style={{ marginTop: 6 }}>tap any value to adjust · speak changes while you brew</div>
          <div style={{ flex: 1 }} />
          <div className="home-bar">
            <button className="outline" onClick={() => s.setSheet("adjust")}>ADJUST</button>
            <button className="wheel-btn" onClick={() => s.openWheel()} aria-label="Tag flavours"><WheelIcon /></button>
          </div>
        </>
      )}
      {s.sheet === "adjust" && <AdjustSheet />}
      {s.sheet === "switcher" && <SwitcherSheet />}
      {s.sheet === "method" && <MethodSheet />}
    </div>
  );
};

/**
 * The hard wall (§7): there is no brewing without a bag, so the empty state is the first task
 * rather than a disabled button with an explanation next to it.
 */
const FirstBag = () => {
  const s = useStore();
  return (
    <div className="firstbag">
      <div className="ticket ghost">
        <div className="punch l" /><div className="punch r" />
        <div className="ticket-head"><span>BREW TICKET</span><span>N° 001</span></div>
        <div className="ticket-grid">
          {paramsFor("filter").map((c) => c.label).map((label) => (
            <div key={label} className="cell"><div className="label">{label}</div><div className="value">—</div><div className="was" /><div className="mark" style={{ opacity: 0 }} /></div>
          ))}
        </div>
        <div className="ticket-foot"><span>nothing to dial in yet</span><span className="stamp">EMPTY</span></div>
      </div>
      <div className="firstbag-text">
        A brew is one bag of coffee, dialled in. Add the bag and the ticket writes itself.
      </div>
      <div style={{ flex: 1 }} />
      <button className="cta" onClick={() => s.setScreen("scan")}><span>ADD YOUR FIRST BAG</span></button>
    </div>
  );
};

const RateCard = () => {
  const s = useStore();
  const brew = s.ratePrompt!;
  const [defects, setDefects] = useState<string[]>(brew.defects);
  const [time, setTime] = useState("");
  const typed = parseClock(time);
  const saveTime = () => { if (typed !== null && typed > 0) void s.setBrewDuration(brew.id, typed); };
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
    <div className="rate">
      <div className="rate-head">
        <span>RATE N° {String(brew.number).padStart(3, "0")}</span>
        <button onClick={s.dismissRatePrompt} aria-label="Skip rating">✕</button>
      </div>
      {brew.durationMs === 0 && (
        <div className="rate-time">
          <span className="k">TIME</span>
          <input inputMode="numeric" placeholder="m:ss" value={time} onChange={(e) => setTime(e.target.value)} onBlur={saveTime}
            onKeyDown={(e) => { if (e.key === "Enter") saveTime(); }} aria-label="Brew time" />
          <span className="v">{typed !== null && typed > 0 ? durationDelta(typed, brew.params.targetMs) || "on target" : `target ${fmtTime(brew.params.targetMs)}`}</span>
        </div>
      )}
      {brew.durationMs > 0 && durationDelta(brew.durationMs, brew.params.targetMs) && (
        <div className="rate-time"><span className="k">TIME</span><span className="v">{fmtTime(brew.durationMs)} · {durationDelta(brew.durationMs, brew.params.targetMs)} vs target</span></div>
      )}
      <div className="stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => pick(n)}>★</button>)}</div>
      <div className="defects">
        {DEFECTS.map((d) => <button key={d} className={"defect" + (defects.includes(d) ? " on" : "")} onClick={() => toggle(d)}>{d}</button>)}
        <button className="tagcta" onClick={() => s.openWheel(brew)}>TAG FLAVOURS →</button>
      </div>
    </div>
  );
};

const AdjustSheet = () => {
  const s = useStore();
  const n = changedKeys(s.params, s.base).length;
  return (
    <>
      <div className="backdrop" onClick={() => s.setSheet(null)} />
      <div className="sheet">
        <Grabber />
        <div className="sheet-head"><span>ADJUST</span><div className="line" /><span className="count">{n ? `${n} changed` : "nothing changed yet"}</span></div>
        {paramsFor(s.params.method).map((c) => {
          const v = val(s.params, c.key);
          const b = val(s.base, c.key);
          return (
            <div key={c.key} className="adj-row">
              <div className="lbl"><div>{c.label}</div><div>{c.unit}</div></div>
              <button className="stepper" onClick={() => s.setParam(c.key, Math.max(0, round1(v - c.step)))} aria-label={`${c.label} down`}>−</button>
              <div className="adj-val"><div>{c.fmt(v)}</div><div>{v !== b && s.params.method === s.base.method ? c.delta(v, b) : ""}</div></div>
              <button className="stepper" onClick={() => s.setParam(c.key, round1(v + c.step))} aria-label={`${c.label} up`}>+</button>
            </div>
          );
        })}
        <button className="cta panel" style={{ marginTop: 16 }} onClick={() => s.setSheet(null)}><span>DONE</span></button>
      </div>
    </>
  );
};

/** "2:41" · "241" (seconds) · "2 41" → ms; null while it is not a time yet. */
export const parseClock = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  const m = /^(\d{1,2})[:\s.](\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) * 60_000 + Number(m[2]) * 1000;
  if (/^\d+$/.test(t)) return Number(t) * 1000;
  return null;
};

/** One row per method: what switching would put on the ticket, so the choice is not blind. */
const MethodSheet = () => {
  const s = useStore();
  return (
    <>
      <div className="backdrop" onClick={() => s.setSheet(null)} />
      <div className="sheet">
        <Grabber />
        <div className="sheet-head"><span>METHOD</span><div className="line" /></div>
        {METHODS.map((m) => {
          const last = s.lastOfMethod(m);
          return (
            <button key={m} className="switch-row" onClick={() => { s.setMethod(m); s.setSheet(null); }}>
              <span className="mark">{m === s.params.method ? "✦" : ""}</span>
              <div style={{ flex: 1 }}>
                <div className="name">{METHOD_LABEL[m]}</div>
                <div className="sub">{last ? `last brewed ${whenLabel(last.brewedAt).toLowerCase()} · ${fmtTime(last.params.targetMs)} target` : "method defaults"}</div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
};

const SwitcherSheet = () => {
  const s = useStore();
  return (
    <>
      <div className="backdrop" onClick={() => s.setSheet(null)} />
      <div className="sheet">
        <Grabber />
        <div className="sheet-head"><span>OPEN BAGS</span><div className="line" /></div>
        {s.beansOpen.length === 0 && <div className="empty">No open bags yet.</div>}
        {s.beansOpen.map((b) => {
          const d = daysOffRoast(b.roastDate);
          return (
            <button key={b.id} className="switch-row" onClick={() => { s.selectBean(b.id); s.setSheet(null); }}>
              <span className="mark">{b.id === s.currentBean?.id ? "✦" : ""}</span>
              <div style={{ flex: 1 }}>
                <div className="name">{b.name}</div>
                <div className="sub">{b.roaster ?? "unknown roaster"} · {d === null ? "roast date unset" : `${d} d off roast`}</div>
              </div>
              <span className="last">LAST {lastLabel(b.lastBrewedAt)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export { Rule };
