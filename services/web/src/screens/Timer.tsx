import { useEffect, useRef, useState } from "react";
import { StatusBar } from "../components/Chrome";
import { LONG_PRESS_MS } from "../hooks/useLongPress";
import { fmtTime } from "../lib/format";
import { useStore } from "../state/store";

const TARGET_MS = 150_000;

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
      <StatusBar />
      {!running && <button className="sqbtn exit" onClick={() => s.setScreen("home")} onPointerUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} aria-label="Exit timer">✕</button>}
      <div className="timer-head">{running ? "✦ BREWING ✦" : "READY"}</div>
      <div className="timer-body">
        <div className="dial-wrap">
          {running && <div className="dial-ring" />}
          <div className="dial">
            <div className="time">{fmtTime(elapsed)}</div>
            <div className="target-line">target {fmtTime(TARGET_MS)} · {s.currentBean?.name ?? "—"}</div>
          </div>
        </div>
        <div className="markers">
          {markers.map((m, i) => <div key={i} className="marker"><span>✦</span> POUR {fmtTime(m)}</div>)}
        </div>
      </div>
      <div className="timer-hint">{running ? "tap to stop & log · hold to mark a pour" : "tap anywhere to start"}</div>
    </div>
  );
};
