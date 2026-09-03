import { useCallback, useState } from "react";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import type { LocalFile } from "../api/client";

export const recorderSupported = () => true;

/**
 * Tap-to-talk microphone capture for deployments where on-device recognition is missing.
 * `start()` opens the mic, `stop()` resolves with the clip (null when nothing was captured or the
 * mic was refused).
 */
export function useRecorder() {
  const rec = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return false;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync();
      rec.record();
      setRecording(true);
      return true;
    } catch {
      return false;
    }
  }, [rec]);

  const stop = useCallback(async (): Promise<LocalFile | null> => {
    setRecording(false);
    try {
      await rec.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = rec.uri;
      if (!uri) return null;
      return { uri, name: "clip.m4a", type: "audio/mp4" };
    } catch {
      return null;
    }
  }, [rec]);

  return { start, stop, recording, supported: recorderSupported() };
}
