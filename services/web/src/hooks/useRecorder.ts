import { useCallback, useRef, useState } from "react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export const recorderSupported = () =>
  typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/**
 * Hold-to-talk microphone capture. `start()` on pointerdown, `stop()` on release resolves with the
 * clip (null when nothing was captured or the mic was refused).
 */
export function useRecorder() {
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    if (!recorderSupported()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.start();
      rec.current = r;
      setRecording(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => new Promise<Blob | null>((resolve) => {
    const r = rec.current;
    setRecording(false);
    if (!r) { resolve(null); return; }
    rec.current = null;
    const done = () => {
      r.stream.getTracks().forEach((t) => t.stop());
      const type = r.mimeType || "audio/webm";
      resolve(chunks.current.length ? new Blob(chunks.current, { type }) : null);
    };
    if (r.state === "inactive") { done(); return; }
    r.onstop = done;
    r.stop();
  }), []);

  return { start, stop, recording, supported: recorderSupported() };
}
