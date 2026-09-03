import * as Location from "expo-location";
import { useEffect, useState } from "react";

export interface DevicePosition { lat: number; lng: number }

/** Asked once per mount. Null when the user said no or it took too long — the search then leans on the region bias instead. */
export type LocationState = { kind: "asking" } | { kind: "known"; at: DevicePosition } | { kind: "none" };

const TIMEOUT_MS = 5000;

export const useDeviceLocation = (enabled = true): LocationState => {
  const [state, setState] = useState<LocationState>(() => (enabled ? { kind: "asking" } : { kind: "none" }));
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const give = (s: LocationState) => { if (alive) setState(s); };
    const timer = setTimeout(() => give({ kind: "none" }), TIMEOUT_MS);
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) { give({ kind: "none" }); return; }
        const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
        const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        give({ kind: "known", at: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      } catch {
        give({ kind: "none" });
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { alive = false; clearTimeout(timer); };
  }, [enabled]);
  return state;
};
