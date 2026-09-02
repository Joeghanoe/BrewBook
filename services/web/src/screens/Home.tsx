import { useState } from "react";
import { Grabber, HomeBar, Rule, StatusBar, Star } from "../components/Chrome";
import { EyeGlyph, WheelIcon } from "../components/Icons";
import { changedKeys, daysOffRoast, fmtTime, lastLabel, PARAMS, round1, sameAsLabel } from "../lib/format";
import { useStore } from "../state/store";

const DEFECTS = ["Sour", "Bitter", "Thin", "Harsh"];
const TARGET_MS = 150_000;

export const Home = () => {
  const s = useStore();
  const bean = s.currentBean;
  const changes = changedKeys(s.params, s.base);
  const days = daysOffRoast(bean?.roastDate ?? null);

  return (
    <div className="screen">
      <StatusBar />
      {s.ratePrompt && <RateCard />}
      <div className="home-head">
        <button onClick={() => s.setSheet("switcher")}>
          <div className="bean-name">{bean ? bean.name : "NO BAG OPEN"} <span>⌄</span></div>
          <div className="bean-meta">
            {bean ? `${bean.roaster ?? "unknown roaster"} · ${days === null ? "roast date unset" : `${days} d off roast`}` : "open the library to add one"}
          </div>
        </button>
        <div className="home-acts">
          <button className="link profile-link" onClick={() => s.setScreen("profile")}>PROFILE</button>
          <EyeGlyph onClick={() => (bean ? s.setScreen("bean") : s.setScreen("library"))} />
        </div>
      </div>

      <div className="ticket">
        <div className="punch l" /><div className="punch r" />
        <div className="ticket-head"><span>BREW TICKET</span><span>N° {String(s.nextNumber).padStart(3, "0")}</span></div>
        <div className="ticket-method"><Star /> FILTER · HAND GRINDER <Star /></div>
        <div className="ticket-grid">
          {PARAMS.map((c) => {
            const v = s.params[c.key];
            const b = s.base[c.key];
            const changed = v !== b;
            return (
              <button key={c.key} className="cell" onClick={() => s.setSheet("adjust")}>
                <div className="label">{c.label}</div>
                <div className="value">{c.fmt(v)}<span>{c.cellUnit}</span></div>
                <div className="was">{changed ? `was ${c.fmt(b)}` : ""}</div>
                <div className="mark" style={{ opacity: changed ? 1 : 0 }} />
              </button>
            );
          })}
          <button className="cell" onClick={() => s.setSheet("adjust")}>
            <div className="label">TIME</div>
            <div className="value">{fmtTime(TARGET_MS)}</div>
            <div className="was" />
            <div className="mark" style={{ opacity: 0 }} />
          </button>
        </div>
        <div className="ticket-foot">
          <span>{changes.length ? `${changes.length} ${changes.length === 1 ? "change" : "changes"} from last brew` : sameAsLabel(bean?.lastBrewedAt ?? null)}</span>
          <span className="stamp">UNBREWED</span>
        </div>
        <div className="perforation" />
        <button className="brew-btn" disabled={!bean} onClick={() => { s.dismissRatePrompt(); s.setSheet(null); s.setScreen("timer"); }}>▶ &nbsp;BREW</button>
      </div>
      <div className="hint" style={{ marginTop: 11 }}>{bean ? "tap any value to adjust · speak changes while you brew" : "add a bag from the library before the first brew"}</div>
      <div style={{ flex: 1 }} />
      <div className="home-bar">
        <button className="outline" onClick={() => s.setSheet("adjust")}>ADJUST</button>
        <button className="wheel-btn" onClick={() => s.openWheel()} aria-label="Tag flavours"><WheelIcon /></button>
      </div>
      <HomeBar />
      {s.sheet === "adjust" && <AdjustSheet />}
      {s.sheet === "switcher" && <SwitcherSheet />}
    </div>
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
    <div className="rate">
      <div className="rate-head">
        <span>RATE N° {String(brew.number).padStart(3, "0")}</span>
        <button onClick={s.dismissRatePrompt} aria-label="Skip rating">✕</button>
      </div>
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
        {PARAMS.map((c) => {
          const v = s.params[c.key];
          const b = s.base[c.key];
          return (
            <div key={c.key} className="adj-row">
              <div className="lbl"><div>{c.label}</div><div>{c.unit}</div></div>
              <button className="stepper" onClick={() => s.setParam(c.key, Math.max(0, round1(v - c.step)))} aria-label={`${c.label} down`}>−</button>
              <div className="adj-val"><div>{c.fmt(v)}</div><div>{v !== b ? c.delta(v, b) : ""}</div></div>
              <button className="stepper" onClick={() => s.setParam(c.key, round1(v + c.step))} aria-label={`${c.label} up`}>+</button>
            </div>
          );
        })}
        <button className="cta panel" style={{ marginTop: 16 }} onClick={() => s.setSheet(null)}><span>DONE</span></button>
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
        <button className="outline" style={{ height: 52, marginTop: 16, width: "100%", fontSize: 12 }} onClick={() => { s.setSheet(null); s.setScreen("library"); }}>OPEN LIBRARY →</button>
      </div>
    </>
  );
};

export { Rule };
