import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { VoiceParse } from "../api/types";
import { Grabber, HomeBar, Rule, StatusBar, Star } from "../components/Chrome";
import { EyeGlyph, MicIcon, WheelIcon } from "../components/Icons";
import { useRecorder } from "../hooks/useRecorder";
import { useSpeech } from "../hooks/useSpeech";
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
        <EyeGlyph onClick={() => (bean ? s.setScreen("bean") : s.setScreen("library"))} />
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
      <div className="hint" style={{ marginTop: 11 }}>{bean ? "tap any value to adjust · hold the mic and speak a change" : "add a bag from the library before the first brew"}</div>
      <div style={{ flex: 1 }} />
      <VoiceCard />
      <div className="home-bar">
        <button className="outline" onClick={() => s.setSheet("adjust")}>ADJUST</button>
        <button className="wheel-btn" onClick={() => s.openWheel()} aria-label="Tag flavours"><WheelIcon /></button>
        <SpeakButton />
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

type VoiceState = { phase: "idle" } | { phase: "recording" } | { phase: "processing" } | { phase: "done"; sub: string } | { phase: "failed"; sub: string };
const voiceCtx = { state: { phase: "idle" } as VoiceState, listeners: new Set<() => void>() };
const setVoice = (v: VoiceState) => { voiceCtx.state = v; voiceCtx.listeners.forEach((l) => l()); };
const useVoice = () => {
  const [, tick] = useState(0);
  useEffect(() => { const l = () => tick((n) => n + 1); voiceCtx.listeners.add(l); return () => { voiceCtx.listeners.delete(l); }; }, []);
  return voiceCtx.state;
};

const VoiceCard = () => {
  const v = useVoice();
  if (v.phase === "idle") return null;
  const label = v.phase === "recording" ? "LISTENING" : v.phase === "processing" ? "TRANSCRIBING…" : v.phase === "done" ? "APPLIED" : "NOT APPLIED";
  const sub = v.phase === "recording" ? "release to submit" : v.phase === "processing" ? "sending audio for parsing" : v.sub;
  return (
    <div className="voice">
      <div className="voice-dot-wrap">
        {v.phase === "recording" && <div className="voice-ring" />}
        <div className={"voice-dot" + (v.phase === "done" ? " done" : v.phase === "failed" ? " fail" : "")}><MicIcon stroke="#1c1a21" size={13} stand={false} /></div>
      </div>
      <div>
        <div className="voice-label">{label}</div>
        <div className="voice-sub">{sub}</div>
      </div>
    </div>
  );
};

const SpeakButton = () => {
  const s = useStore();
  const speech = useSpeech();
  const recorder = useRecorder();
  const hide = useRef(0);
  const paramsRef = useRef(s.params);
  paramsRef.current = s.params;
  // Server-side transcription (Gemini) when the deployment has it; the browser's own recogniser otherwise.
  const serverSide = !!s.me?.features.speechTranscription && recorder.supported;
  const mode = useRef<"server" | "browser" | null>(null);

  const finish = (v: VoiceState) => {
    setVoice(v);
    window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setVoice({ phase: "idle" }), 3000);
  };

  const down = async (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    window.clearTimeout(hide.current);
    if (serverSide) {
      mode.current = "server";
      setVoice({ phase: "recording" });
      if (!(await recorder.start())) { mode.current = null; finish({ phase: "failed", sub: "the microphone could not be opened" }); }
      return;
    }
    if (!speech.supported) { finish({ phase: "failed", sub: "voice input isn't available in this browser" }); return; }
    if (!speech.start()) { finish({ phase: "failed", sub: "the microphone could not be opened" }); return; }
    mode.current = "browser";
    setVoice({ phase: "recording" });
  };

  const apply = (r: VoiceParse) => {
    if (r.applied) { s.setParams(r.params); finish({ phase: "done", sub: `"${r.transcript}" — ${r.summary}` }); }
    else finish({ phase: "failed", sub: r.transcript ? `"${r.transcript}" — ${r.summary}` : r.summary });
  };

  const up = async () => {
    if (voiceCtx.state.phase !== "recording" || !mode.current) return;
    const m = mode.current;
    mode.current = null;
    setVoice({ phase: "processing" });
    try {
      if (m === "server") {
        const clip = await recorder.stop();
        if (!clip) { finish({ phase: "failed", sub: "nothing was heard" }); return; }
        apply(await api.transcribeVoice(clip, paramsRef.current));
      } else {
        const transcript = await speech.stop();
        if (!transcript) { finish({ phase: "failed", sub: "nothing was heard" }); return; }
        apply(await api.parseVoice(transcript, paramsRef.current));
      }
    } catch {
      finish({ phase: "failed", sub: "the parser could not be reached" });
    }
  };

  return (
    <button className="outline" style={{ touchAction: "none" }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
      <MicIcon /> SPEAK
    </button>
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
