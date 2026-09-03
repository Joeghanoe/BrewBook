import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Roaster, RoasterCandidate } from "../api/types";
import { useDeviceLocation } from "../hooks/useDeviceLocation";
import { fmtDistance } from "../lib/roasters";
import { useStore } from "../state/store";
import { Grabber } from "./Chrome";

type Found = { kind: "loading" } | { kind: "unavailable" } | { kind: "list"; candidates: RoasterCandidate[]; query: string } | { kind: "error"; message: string };

/**
 * "Which place is this?" — a few candidates, nearest first, for a roaster name the app has not
 * placed yet. The lookup's own best guess put Dutch roasters in South America; the person who
 * bought the bag knows better. Picking writes the pin; NONE OF THESE leaves the roaster off the map
 * on purpose; closing the sheet leaves the question open for next time.
 */
export const RoasterPicker = ({ roasterId, name, onPlaced, onClose }: { roasterId: string; name: string; onPlaced: (r: Roaster) => void; onClose: () => void }) => {
  const s = useStore();
  const loc = useDeviceLocation();
  const [query, setQuery] = useState(name);
  const [found, setFound] = useState<Found>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (loc.kind === "asking") return;
    let alive = true;
    setFound({ kind: "loading" });
    const q = query.trim() || name;
    api.searchRoasters(q, loc.kind === "known" ? loc.at : null)
      .then((r) => { if (alive) setFound(r.available ? { kind: "list", candidates: r.candidates, query: q } : { kind: "unavailable" }); })
      .catch((e) => { if (alive) setFound({ kind: "error", message: e instanceof ApiError ? e.message : "The brew log could not be reached." }); });
    return () => { alive = false; };
    // Searches when the position settles and on each explicit retry, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.kind, retry]);

  const place = async (pick: RoasterCandidate | null) => {
    setBusy(true);
    try {
      const placed = await api.placeRoaster(roasterId, pick);
      s.showToast(pick ? `${placed.name} pinned — ${pick.address ?? "on the map"}` : `${placed.name} stays off the map`);
      onPlaced(placed);
    } catch (e) {
      s.showToast(e instanceof ApiError ? `Not pinned — ${e.message}` : "Not pinned — the brew log could not be reached");
      setBusy(false);
    }
  };

  const near = loc.kind === "known" ? "nearest to you first" : loc.kind === "asking" ? "finding where you are…" : "nearest to home first";

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet">
        <Grabber />
        <div className="sheet-head"><span>FIND {name.toUpperCase()}</span><div className="line" /><span className="count">{near}</span></div>
        <div className="relocate" style={{ marginTop: 6 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${name}, city or street`}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) setRetry((n) => n + 1); }} aria-label="Roaster search" />
          <button className="act" disabled={busy || loc.kind === "asking"} onClick={() => setRetry((n) => n + 1)}>SEARCH →</button>
        </div>

        {(loc.kind === "asking" || found.kind === "loading") && <div className="empty">Looking for {query.trim() || name}…</div>}
        {found.kind === "unavailable" && <div className="empty">Roaster lookup is not configured on this deployment — the bag is saved, the roaster has no pin.</div>}
        {found.kind === "error" && <div className="empty">{found.message} <button className="act" style={{ marginLeft: 8 }} onClick={() => setRetry((n) => n + 1)}>TRY AGAIN →</button></div>}
        {found.kind === "list" && found.candidates.length === 0 && <div className="empty">Nothing found for "{found.query}" — try the city or the street.</div>}
        {found.kind === "list" && found.candidates.map((c) => (
          <button key={c.placeId} className="switch-row" disabled={busy} onClick={() => void place(c)}>
            <span className="mark">◎</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name">{c.name}</div>
              <div className="sub">{c.address ?? "address unknown"}</div>
            </div>
            <span className="last">{fmtDistance(c.distanceKm)}</span>
          </button>
        ))}

        {found.kind !== "unavailable" && found.kind !== "loading" && loc.kind !== "asking" && (
          <div className="hint" style={{ marginTop: 12, textAlign: "left" }}>Not here? Close this and the question stays open for next time.</div>
        )}
        <div className="log-open" style={{ background: "transparent", border: 0, padding: 0, marginTop: 14 }}>
          <div className="acts">
            <button className="act quiet" disabled={busy} onClick={() => void place(null)}>NONE OF THESE</button>
            <button className="act" onClick={onClose}>LATER</button>
          </div>
        </div>
      </div>
    </>
  );
};
