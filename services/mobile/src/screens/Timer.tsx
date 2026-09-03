import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import type { BrewStep, VoiceParse } from "../api/types";
import { Pulse } from "../components/Anim";
import { Screen, SqBtn } from "../components/Chrome";
import { MicIcon } from "../components/Icons";
import { useLiveSpeech } from "../hooks/useLiveSpeech";
import { LONG_PRESS_MS } from "../hooks/useLongPress";
import { useRecorder } from "../hooks/useRecorder";
import { fmtTime, paramsFor, stepName, val } from "../lib/format";
import { parseTimerCommand } from "../lib/voiceTimer";
import { useStore } from "../state/store";
import { c, g, tabular } from "../theme/text";
import { C } from "../theme/tokens";

/** What the voice strip can do to the timer: the same three moves as tapping and holding. */
export interface TimerControls { running: boolean; start: () => void; stop: () => void; mark: (label: string) => void }

export const Timer = () => {
  const s = useStore();
  const insets = useSafeAreaInsets();
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
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = running ? now - startTs : 0;

  const onDown = () => { downTs.current = Date.now(); };
  const onUp = () => {
    if (!downTs.current) return;
    const held = Date.now() - downTs.current;
    downTs.current = 0;
    if (!running) { start(); return; }
    if (held >= LONG_PRESS_MS) { mark("pour"); return; }
    stop();
  };

  return (
    <Screen style={{ alignItems: "center" }}>
      <Pressable onPressIn={onDown} onPressOut={onUp} delayLongPress={LONG_PRESS_MS} onLongPress={() => {}} style={[StyleSheet.absoluteFill, { alignItems: "center", paddingTop: 14 + insets.top }]}>
        <Text style={st.head}>{running ? "✦ BREWING ✦" : "READY"}</Text>
        <View style={st.body}>
          <View style={st.dialWrap}>
            {running && <Pulse periodMs={2200} style={st.dialRing} />}
            <View style={st.dial}>
              <Text style={st.time}>{fmtTime(elapsed)}</Text>
              <Text style={st.target}>target {fmtTime(s.params.targetMs)} · {s.currentBean?.name ?? "—"}</Text>
            </View>
          </View>
          <View style={st.markers}>
            {steps.map((step, i) => (
              <View key={i} style={st.marker}><Text style={{ fontSize: 7, color: C.copperLight }}>✦</Text><Text style={st.markerText}>{stepName(steps, i)} {fmtTime(step.atMs)}</Text></View>
            ))}
          </View>
        </View>
      </Pressable>
      {!running && <SqBtn onPress={() => s.setScreen("home")} label="Exit timer" style={[st.exit, { top: 52 + insets.top }]}>✕</SqBtn>}
      <View style={{ flex: 1 }} pointerEvents="none" />
      <VoiceStrip timer={{ running, start, stop, mark }} />
      <View pointerEvents="none"><Text style={[st.hint, { paddingBottom: 28 + insets.bottom }]}>{running ? "tap to stop & log · hold or say \"first bloom\" to mark a step" : "tap anywhere or say \"start\""}</Text></View>
    </Screen>
  );
};

type Note = { kind: "heard" | "applied" | "ignored" | "failed"; text: string };

/**
 * Speak changes while the brew runs. Live text comes from the device's recogniser; each finished
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
    const ok = live.supported ? await live.start() : await recorder.start();
    if (!ok) setNote({ kind: "failed", text: "the microphone could not be opened" });
  };

  // Listening survives "start": the mic that heard the start goes on hearing the pours. It ends only when the brew is committed.
  const committed = useRef(false);
  useEffect(() => { if (running) committed.current = true; }, [running]);
  useEffect(() => { if (!running && committed.current && live.listening) live.stop(); }, [running, live]);

  const line = live.interim ? { kind: "heard" as const, text: live.interim + "…" } : note;
  const lineColor = line?.kind === "applied" ? C.copperLight : line?.kind === "ignored" ? C.text55 : line?.kind === "failed" ? C.rustLight : C.text;

  return (
    <View style={st.strip}>
      <View style={st.ticketStrip}>
        {paramsFor(s.params.method).map((cfg) => {
          const v = val(s.params, cfg.key), b = val(s.base, cfg.key), changed = s.params.method !== s.base.method || v !== b;
          return (
            <View key={cfg.key} style={st.tsCell}>
              <Text style={st.tsLabel}>{cfg.label}</Text>
              <Text style={[st.tsValue, changed && { color: C.copperLight }]}>{cfg.fmt(v)}{cfg.cellUnit ? <Text style={{ fontSize: 9 }}> {cfg.cellUnit}</Text> : null}</Text>
              <View style={[st.tsMark, { opacity: changed ? 1 : 0 }]} />
            </View>
          );
        })}
      </View>
      <View style={st.voiceRow}>
        <Pressable onPress={toggle} disabled={!available || busy} accessibilityState={{ selected: on }} accessibilityLabel={on ? "Stop listening" : "Speak a change"}
          style={[st.mic, on && { backgroundColor: C.copper, borderColor: C.copper }, (!available || busy) && { opacity: 0.4 }]}>
          {on && <Pulse style={st.micRing} />}
          <MicIcon stroke={on ? C.bg : C.copperLight} size={14} stand={false} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          {!available && <Text style={st.voiceSub}>voice input isn't available on this device</Text>}
          {available && !on && !line && <Text style={st.voiceSub}>{busy ? "sending audio for parsing" : "tap the mic and say a change while you pour"}</Text>}
          {available && on && !line && <Text style={st.voiceSub}>{live.supported ? "listening…" : "recording — tap again to send"}</Text>}
          {line && <Text style={[st.voiceLine, { color: lineColor }]} numberOfLines={2}>{line.text}</Text>}
        </View>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  exit: { position: "absolute", left: 22, zIndex: 5 },
  head: { ...c(700, 11, 4, C.copper90), marginTop: 64 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: -20 },
  dialWrap: { alignItems: "center", justifyContent: "center" },
  dialRing: { position: "absolute", width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: C.copper50 },
  dial: { width: 250, height: 250, borderRadius: 125, borderWidth: 1.5, borderColor: C.copper55, alignItems: "center", justifyContent: "center" },
  time: { ...g(600, 60, 1), ...tabular },
  target: { ...g(400, 13, 0, C.text55), marginTop: 6 },
  markers: { flexDirection: "row", gap: 8, marginTop: 14, minHeight: 34, flexWrap: "wrap", justifyContent: "center", paddingHorizontal: 30 },
  marker: { height: 32, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: C.copper50 },
  markerText: c(700, 11, 1, C.copperLight),
  hint: { ...g(400, 13, 1, C.text50), textAlign: "center" },
  strip: { width: "100%", paddingHorizontal: 22, paddingBottom: 10 },
  ticketStrip: { flexDirection: "row", gap: 1, backgroundColor: C.copper30, borderWidth: 1, borderColor: C.copper30 },
  tsCell: { flex: 1, backgroundColor: C.bg, paddingTop: 7, paddingBottom: 5, paddingHorizontal: 4, alignItems: "center" },
  tsLabel: c(700, 8, 1.5, C.text50),
  tsValue: { ...g(600, 15), ...tabular, marginTop: 2 },
  tsMark: { height: 2, width: 22, marginTop: 4, backgroundColor: C.copper },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, minHeight: 44 },
  mic: { width: 44, height: 44, borderWidth: 1, borderColor: C.copper55, alignItems: "center", justifyContent: "center" },
  micRing: { position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderWidth: 1.5, borderColor: C.copper },
  voiceSub: { ...g(400, 13, 0, C.text75), marginTop: 3 },
  voiceLine: g(400, 13),
});
