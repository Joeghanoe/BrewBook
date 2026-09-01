import { useCallback, useEffect, useRef, useState } from "react";

type Alt = { transcript: string };
type ResultList = ArrayLike<ArrayLike<Alt> & { isFinal: boolean }>;
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type Ctor = new () => Recognition;

const ctor = (): Ctor | null => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const liveSpeechSupported = () => ctor() !== null;

/**
 * Continuous recognition with live interim text. Each finished phrase is handed to `onPhrase`;
 * `interim` holds what is being said right now. Restarts itself while `listening`, since
 * browsers end a session after a pause.
 */
export function useLiveSpeech(onPhrase: (text: string) => void) {
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const cb = useRef(onPhrase);
  cb.current = onPhrase;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const spawn = useCallback(() => {
    const C = ctor();
    if (!C) return false;
    const r = new C();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (res.isFinal) { if (text) cb.current(text); }
        else live += text + " ";
      }
      setInterim(live.trim());
    };
    r.onerror = () => { /* onend follows; restart decides */ };
    r.onend = () => {
      setInterim("");
      if (wanted.current) { try { spawn(); } catch { /* give up quietly */ } }
    };
    rec.current = r;
    r.start();
    return true;
  }, []);

  const start = useCallback(() => {
    wanted.current = true;
    try {
      if (!spawn()) { wanted.current = false; return false; }
      setListening(true);
      return true;
    } catch {
      wanted.current = false;
      return false;
    }
  }, [spawn]);

  const stop = useCallback(() => {
    wanted.current = false;
    setListening(false);
    setInterim("");
    const r = rec.current;
    rec.current = null;
    try { r?.stop(); } catch { /* already stopped */ }
  }, []);

  useEffect(() => () => { wanted.current = false; try { rec.current?.abort(); } catch { /* unmounting */ } }, []);

  return { start, stop, listening, interim, supported: liveSpeechSupported() };
}
