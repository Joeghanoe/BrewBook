import { useCallback, useRef, useState } from "react";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechSupported = () => ctor() !== null;

/**
 * Hold-to-talk on the browser's speech recogniser. `start()` on pointerdown, `stop()` on release;
 * the promise from `stop()` resolves with whatever was heard (empty when nothing was).
 */
export function useSpeech() {
  const rec = useRef<Recognition | null>(null);
  const heard = useRef("");
  const [listening, setListening] = useState(false);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) return false;
    const r = new C();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    heard.current = "";
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " ";
      heard.current = t.trim();
    };
    r.onerror = () => { /* surfaced as an empty transcript on stop */ };
    rec.current = r;
    try { r.start(); setListening(true); return true; } catch { return false; }
  }, []);

  const stop = useCallback(() => new Promise<string>((resolve) => {
    const r = rec.current;
    setListening(false);
    if (!r) { resolve(""); return; }
    let done = false;
    const finish = () => { if (done) return; done = true; rec.current = null; resolve(heard.current); };
    r.onend = finish;
    try { r.stop(); } catch { finish(); }
    // Recognisers can take a moment to flush the final result; do not wait forever.
    window.setTimeout(finish, 1500);
  }), []);

  return { start, stop, listening, supported: speechSupported() };
}
