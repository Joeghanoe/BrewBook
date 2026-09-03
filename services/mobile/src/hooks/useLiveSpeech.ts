import { useCallback, useEffect, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

export const liveSpeechSupported = () => {
  try { return ExpoSpeechRecognitionModule.isRecognitionAvailable(); } catch { return false; }
};

/**
 * Continuous on-device recognition with live interim text. Each finished phrase is handed to
 * `onPhrase`; `interim` holds what is being said right now. Restarts itself while `listening`,
 * since the recogniser ends a session after a pause.
 */
export function useLiveSpeech(onPhrase: (text: string) => void) {
  const wanted = useRef(false);
  const cb = useRef(onPhrase);
  cb.current = onPhrase;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const spawn = useCallback(() => {
    ExpoSpeechRecognitionModule.start({ lang: "en-US", continuous: true, interimResults: true, addsPunctuation: false });
  }, []);

  useSpeechRecognitionEvent("result", (e) => {
    const text = e.results[0]?.transcript.trim() ?? "";
    if (e.isFinal) { setInterim(""); if (text) cb.current(text); }
    else setInterim(text);
  });
  useSpeechRecognitionEvent("error", () => { /* onend follows; restart decides */ });
  useSpeechRecognitionEvent("end", () => {
    setInterim("");
    if (wanted.current) { try { spawn(); } catch { /* give up quietly */ } }
  });

  const start = useCallback(async () => {
    if (!liveSpeechSupported()) return false;
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return false;
      wanted.current = true;
      spawn();
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
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* already stopped */ }
  }, []);

  useEffect(() => () => { wanted.current = false; try { ExpoSpeechRecognitionModule.abort(); } catch { /* unmounting */ } }, []);

  return { start, stop, listening, interim, supported: liveSpeechSupported() };
}
