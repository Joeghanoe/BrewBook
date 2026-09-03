import { useEffect, useState } from "react";

export interface DevicePosition { lat: number; lng: number }

/** Asked once per mount. Null when the browser has no geolocation, the user said no, or it took too long — the search then leans on the region bias instead. */
export type LocationState = { kind: "asking" } | { kind: "known"; at: DevicePosition } | { kind: "none" };

const TIMEOUT_MS = 5000;

export const useDeviceLocation = (enabled = true): LocationState => {
  const [state, setState] = useState<LocationState>(() => (enabled && typeof navigator !== "undefined" && "geolocation" in navigator ? { kind: "asking" } : { kind: "none" }));
  useEffect(() => {
    if (!enabled || state.kind !== "asking") return;
    let alive = true;
    navigator.geolocation.getCurrentPosition(
      (p) => { if (alive) setState({ kind: "known", at: { lat: p.coords.latitude, lng: p.coords.longitude } }); },
      () => { if (alive) setState({ kind: "none" }); },
      { timeout: TIMEOUT_MS, maximumAge: 10 * 60_000 },
    );
    return () => { alive = false; };
    // Runs once: the state starts as "asking" and only leaves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return state;
};
