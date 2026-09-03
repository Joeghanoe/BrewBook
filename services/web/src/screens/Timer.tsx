import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { BrewStep, VoiceParse } from "../api/types";
import { MicIcon } from "../components/Icons";
import { useLiveSpeech } from "../hooks/useLiveSpeech";
import { LONG_PRESS_MS } from "../hooks/useLongPress";
import { useRecorder } from "../hooks/useRecorder";
import { fmtTime, paramsFor, stepName, val } from "../lib/format";
import { parseTimerCommand } from "../lib/voiceTimer";
import { useStore } from "../state/store";

/** What the voice strip can do to the timer: the same three moves as tapping and holding. */
export interface TimerControls { running: boolean; start: () => void; stop: () => void; mark: (label: string) => void }

export const Timer = () => {
  const s = useStore();
  const [running, setRunning] = useState(false);
  const [startTs, setStartTs] = useState(0);
  const [now, setNow] = useState(0);
  const [steps, setSteps] = useState<BrewStep[]>([]);
  const downTs = useRef(0);
  const committing = useRef(false);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const start = () => {
    const t = Date.now();
    setStartTs(t); setNow(t); setSteps([]); setRunning(true);
  };
  const mark = (label: string) => setSteps((m) => [...m, { atMs: Date.now() - startTs, label }]);
  const stop = () => {
    if (committing.current) return;
    committing.current = true;
    const duration = Date.now() - startTs;
    setRunning(false);
    // Commit-on-stop: the brew is written immediately, undo lives in the toast.
    s.setScreen("home");
    void s.commitBrew(duration, stepsRef.current);
  };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [running]);

  const elapsed = running ? now - startTs : 0;

  const onDown = (e: React.PointerEvent) => { e.preventDefault(); downTs.current = Date.now(); };
  const onUp = () => {
    if (!downTs.current) return;
    const held = Date.now() - downTs.current;
    downTs.current = 0;
    if (!running) { start(); return; }
    if (held >= LONG_PRESS_MS) { mark("pour"); return; }
    stop();
  };

  return (
    <div className="screen timer" onPointerDown={onDown} onPointerUp={onUp} onContextMenu={(e) => e.preventDefault()}>
      {!running && <button className="sqbtn exit" onClick={() => s.setScreen("home")} onPointerUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} aria-label="Exit timer">✕</button>}
      <div className="timer-head">{running ? "✦ BREWING ✦" : "READY"}</div>
      <div className="timer-body">
        <div className="dial-wrap">
          {running && <div className="dial-ring" />}
          <div className="dial">
            <div className="time">{fmtTime(elapsed)}</div>
            <div className="target-line">target {fmtTime(s.params.targetMs)} · {s.currentBean?.name ?? "—"}</div>
          </div>
        </div>
        <div className="markers">
          {steps.map((st, i) => <div key={i} className="marker"><span>✦</span> {stepName(steps, i)} {fmtTime(st.atMs)}</div>)}
        </div>
      </div>
      <VoiceStrip timer={{ running, start, stop, mark }} />
      <div className="timer-hint">{running ? "tap to stop & log · hold or say \"first bloom\" to mark a step" : "tap anywhere or say \"start\""}</div>
    </div>
  );
};

type Note = { kind: "heard" | "applied" | "ignored" | "failed"; text: string };

/**
 * Speak changes while the brew runs. Live text comes from the browser's recogniser; each finished
 * phrase is parsed by the API and applied to the ticket, which is shown as a strip so the change is
 * visible at once. Without a recogniser the clip is transcribed by the server when the mic stops.
 */
const VoiceStrip = ({ timer }: { timer: TimerControls }) => {
  const s = useStore();
  const running = timer.running;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const paramsRef = useRef(s.params);
  paramsRef.current = s.params;
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const queue = useRef(Promise.resolve());

  const apply = (r: VoiceParse) => {
    if (r.applied) { s.setParams(r.params); setNote({ kind: "applied", text: `"${r.transcript}" — ${r.summary}` }); }
    else setNote({ kind: "ignored", text: r.transcript ? `"${r.transcript}" — not a ticket change` : r.summary });
  };

  // A timer command is a UI event and is handled here, at once; only ticket changes go to the API.
  const runTimerCommand = (text: string): boolean => {
    const cmd = parseTimerCommand(text);
    if (!cmd) return false;
    const t = timerRef.current;
    if (cmd.kind === "start") {
      if (t.running) setNote({ kind: "ignored", text: `"${text}" — already brewing` });
      else { t.start(); setNote({ kind: "applied", text: `"${text}" — timer started` }); }
    } else if (cmd.kind === "stop") {
      if (!t.running) setNote({ kind: "ignored", text: `"${text}" — nothing is running` });
      else { setNote({ kind: "applied", text: `"${text}" — stopped & logged` }); t.stop(); }
    } else {
      if (!t.running) setNote({ kind: "ignored", text: `"${text}" — start the timer first` });
      else { t.mark(cmd.label); setNote({ kind: "applied", text: `"${text}" — ${cmd.label} marked` }); }
    }
    return true;
  };

  // Phrases are parsed one after another so two quick sentences do not race on the same baseline.
  const onPhrase = (text: string) => {
    setNote({ kind: "heard", text });
    if (runTimerCommand(text)) return;
    queue.current = queue.current.then(async () => {
      try { apply(await api.parseVoice(text, paramsRef.current)); }
      catch { setNote({ kind: "failed", text: "the parser could not be reached" }); }
    });
  };

  const live = useLiveSpeech(onPhrase);
  const recorder = useRecorder();
  const serverOnly = !live.supported && recorder.supported && !!s.me?.features?.speechTranscription;
  const available = live.supported || serverOnly;
  const on = live.listening || recorder.recording;

  const toggle = async () => {
    if (busy) return;
    if (on) {
      if (live.listening) { live.stop(); return; }
      setBusy(true);
      const clip = await recorder.stop();
      if (!clip) { setNote({ kind: "ignored", text: "nothing was recorded" }); setBusy(false); return; }
      try {
        const r = await api.transcribeVoice(clip, paramsRef.current);
        if (!(r.transcript && runTimerCommand(r.transcript))) apply(r);
      }
      catch { setNote({ kind: "failed", text: "the parser could not be reached" }); }
      setBusy(false);
      return;
    }
    setNote(null);
    const ok = live.supported ? live.start() : await recorder.start();
    if (!ok) setNote({ kind: "failed", text: "the microphone could not be opened" });
  };

  // Listening survives "start": the mic that heard the start goes on hearing the pours. It ends only when the brew is committed.
  const committed = useRef(false);
  useEffect(() => { if (running) committed.current = true; }, [running]);
  useEffect(() => { if (!running && committed.current && live.listening) live.stop(); }, [running, live]);

  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();
  const line = live.interim ? { kind: "heard" as const, text: live.interim + "…" } : note;

  return (
    <div className="voice-strip" onPointerDown={stopBubble} onPointerUp={stopBubble} onClick={stopBubble}>
      <div className="ticket-strip">
        {paramsFor(s.params.method).map((c) => {
          const v = val(s.params, c.key), b = val(s.base, c.key), changed = s.params.method !== s.base.method || v !== b;
          return (
            <div key={c.key} className={"ts-cell" + (changed ? " changed" : "")}>
              <div className="ts-label">{c.label}</div>
              <div className="ts-value">{c.fmt(v)}{c.cellUnit && <span>{c.cellUnit}</span>}</div>
              <div className="ts-mark" />
            </div>
          );
        })}
      </div>
      <div className="voice-row">
        <button className={"mic-btn" + (on ? " live" : "")} onClick={toggle} disabled={!available || busy} aria-pressed={on} aria-label={on ? "Stop listening" : "Speak a change"}>
          {on && <div className="voice-ring" />}
          <MicIcon stroke={on ? "#1c1a21" : "#d8a86f"} size={14} stand={false} />
        </button>
        <div className="voice-text">
          {!available && <div className="voice-sub">voice input isn't available in this browser</div>}
          {available && !on && !line && <div className="voice-sub">{busy ? "sending audio for parsing" : "tap the mic and say a change while you pour"}</div>}
          {available && on && !line && <div className="voice-sub">{live.supported ? "listening…" : "recording — tap again to send"}</div>}
          {line && <div className={"voice-line " + line.kind}>{line.text}</div>}
        </div>
      </div>
    </div>
  );
};
