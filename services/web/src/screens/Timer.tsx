import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { VoiceParse } from "../api/types";
import { MicIcon } from "../components/Icons";
import { useLiveSpeech } from "../hooks/useLiveSpeech";
import { LONG_PRESS_MS } from "../hooks/useLongPress";
import { useRecorder } from "../hooks/useRecorder";
import { fmtTime, paramsFor, val } from "../lib/format";
import { useStore } from "../state/store";

export const Timer = () => {
  const s = useStore();
  const [running, setRunning] = useState(false);
  const [startTs, setStartTs] = useState(0);
  const [now, setNow] = useState(0);
  const [markers, setMarkers] = useState<number[]>([]);
  const downTs = useRef(0);
  const committing = useRef(false);

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
    if (!running) {
      const t = Date.now();
      setStartTs(t); setNow(t); setMarkers([]); setRunning(true);
      return;
    }
    if (held >= LONG_PRESS_MS) { setMarkers((m) => [...m, Date.now() - startTs]); return; }
    if (committing.current) return;
    committing.current = true;
    const duration = Date.now() - startTs;
    setRunning(false);
    // Commit-on-stop: the brew is written immediately, undo lives in the toast.
    s.setScreen("home");
    void s.commitBrew(duration, markers);
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
          {markers.map((m, i) => <div key={i} className="marker"><span>✦</span> POUR {fmtTime(m)}</div>)}
        </div>
      </div>
      <VoiceStrip running={running} />
      <div className="timer-hint">{running ? "tap to stop & log · hold to mark a pour" : "tap anywhere to start"}</div>
    </div>
  );
};

type Note = { kind: "heard" | "applied" | "ignored" | "failed"; text: string };

/**
 * Speak changes while the brew runs. Live text comes from the browser's recogniser; each finished
 * phrase is parsed by the API and applied to the ticket, which is shown as a strip so the change is
 * visible at once. Without a recogniser the clip is transcribed by the server when the mic stops.
 */
const VoiceStrip = ({ running }: { running: boolean }) => {
  const s = useStore();
  const paramsRef = useRef(s.params);
  paramsRef.current = s.params;
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const queue = useRef(Promise.resolve());

  const apply = (r: VoiceParse) => {
    if (r.applied) { s.setParams(r.params); setNote({ kind: "applied", text: `"${r.transcript}" — ${r.summary}` }); }
    else setNote({ kind: "ignored", text: r.transcript ? `"${r.transcript}" — not a ticket change` : r.summary });
  };

  // Phrases are parsed one after another so two quick sentences do not race on the same baseline.
  const onPhrase = (text: string) => {
    setNote({ kind: "heard", text });
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
      try { apply(await api.transcribeVoice(clip, paramsRef.current)); }
      catch { setNote({ kind: "failed", text: "the parser could not be reached" }); }
      setBusy(false);
      return;
    }
    setNote(null);
    const ok = live.supported ? live.start() : await recorder.start();
    if (!ok) setNote({ kind: "failed", text: "the microphone could not be opened" });
  };

  // Stopping the brew ends listening; the ticket already carries what was said.
  useEffect(() => { if (!running && live.listening) live.stop(); }, [running, live]);

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
