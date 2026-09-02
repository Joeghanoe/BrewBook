import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Roaster } from "../api/types";
import { Grabber, HomeBar, Rule, StatusBar } from "../components/Chrome";
import { loadGoogleMaps, MAP_STYLE, type GMap, type GMarker, type GoogleMaps } from "../lib/googleMaps";
import { mapsUrl, pinRadius, ratingLabel, topLikedFlavours } from "../lib/roasters";
import { useStore } from "../state/store";

const PRESELECTED = 3;
type MapState = { kind: "loading" } | { kind: "ready"; key: string } | { kind: "off"; why: string };

export const Roasters = () => {
  const s = useStore();
  const palate = useMemo(() => topLikedFlavours(s.brews), [s.brews]);
  const [selected, setSelected] = useState<string[]>(() => palate.slice(0, PRESELECTED));
  const [roasters, setRoasters] = useState<Roaster[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapState, setMapState] = useState<MapState>({ kind: "loading" });
  const [open, setOpen] = useState<Roaster | null>(null);

  useEffect(() => {
    let alive = true;
    api.config()
      .then((c) => { if (alive) setMapState(c.mapsBrowserKey ? { kind: "ready", key: c.mapsBrowserKey } : { kind: "off", why: "map not configured on this deployment" }); })
      .catch(() => { if (alive) setMapState({ kind: "off", why: "map settings could not be read" }); });
    return () => { alive = false; };
  }, []);

  const load = useCallback(async (flavours: string[]) => {
    setError(null);
    try {
      setRoasters(await api.roasters(flavours));
    } catch (e) {
      setRoasters(null);
      setError(e instanceof ApiError ? e.message : "The brew log could not be reached.");
    }
  }, []);
  useEffect(() => { void load(selected); }, [load, selected]);

  // Arriving from a bean's plaque: open that roaster's sheet once the list is in. If the
  // palate filter hides it, drop the filter first and let the reload find it.
  const { roasterFocus, setRoasterFocus } = s;
  useEffect(() => {
    if (!roasterFocus || !roasters) return;
    const r = roasters.find((x) => x.id === roasterFocus);
    if (r) { setOpen(r); setRoasterFocus(null); }
    else if (selected.length) setSelected([]);
    else setRoasterFocus(null);
  }, [roasters, roasterFocus, setRoasterFocus, selected.length]);

  const toggle = (f: string) => setSelected((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const patch = (r: Roaster) => { setRoasters((rs) => rs?.map((x) => (x.id === r.id ? r : x)) ?? null); setOpen(r); };
  const unlocated = roasters?.filter((r) => !r.located) ?? [];

  return (
    <div className="screen">
      <StatusBar />
      <div className="nav">
        <button className="sqbtn" onClick={() => s.setScreen("library")} aria-label="Back">←</button>
        <div className="title">ROASTERS</div>
        <div style={{ flex: 1 }} />
        <span className="link" style={{ color: "rgba(233,214,174,.5)" }}>{roasters ? `${roasters.length} ON RECORD` : ""}</span>
      </div>

      <div className="filter">
        <Rule label="YOUR PALATE" right={selected.length ? `${selected.length} ON` : "ALL ROASTERS"} />
        {palate.length === 0 ? (
          <div className="hint" style={{ textAlign: "left", marginTop: 8 }}>tag flavours on a brew to search roasters by what you like</div>
        ) : (
          <div className="chips compact" style={{ marginTop: 8 }}>
            {palate.map((f) => (
              <button key={f} className={"leaf" + (selected.includes(f) ? " pos" : "")} onClick={() => toggle(f)}>{f}</button>
            ))}
            {selected.length > 0 && <button className="leaf" style={{ borderStyle: "dashed", color: "var(--text-55)" }} onClick={() => setSelected([])}>clear</button>}
          </div>
        )}
      </div>

      {mapState.kind === "ready" && <MapView apiKey={mapState.key} roasters={roasters ?? []} onPick={setOpen} onFail={(why) => setMapState({ kind: "off", why })} />}
      {mapState.kind === "off" && <div className="hint" style={{ margin: "12px 22px 0", textAlign: "left" }}>{mapState.why} — showing the list</div>}

      <div className="roasters">
        {mapState.kind === "ready" && unlocated.length > 0 && <div style={{ marginTop: 14 }}><Rule label="NOT ON THE MAP" right={`${unlocated.length}`} /></div>}
        {error && <div className="empty">{error} <button className="act" style={{ marginLeft: 8 }} onClick={() => void load(selected)}>TRY AGAIN →</button></div>}
        {!error && roasters === null && <div className="empty">Finding your roasters…</div>}
        {roasters?.length === 0 && (
          <div className="empty">{selected.length ? "No roaster matches this palate — clear a flavour." : "No roasters yet — add a bag with the roaster on its label."}</div>
        )}
        {(mapState.kind === "ready" ? unlocated : roasters ?? []).map((r) => (
          <button key={r.id} className="roaster-row" onClick={() => setOpen(r)}>
            <div className={"pin" + (r.avgRating === null ? " off" : "")}>{ratingLabel(r.avgRating)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name">{r.name}</div>
              <div className="sub">{[r.address ?? "not located", `${r.bags} ${r.bags === 1 ? "bag" : "bags"}`, r.topFlavours.slice(0, 3).join(" · ")].filter(Boolean).join(" · ")}</div>
            </div>
            {r.matchCount !== null && <span className="match">{r.matchCount} OF {selected.length}</span>}
          </button>
        ))}
        <div style={{ height: 20 }} />
      </div>
      <HomeBar />
      {open && <RoasterSheet roaster={open} onClose={() => setOpen(null)} onPatched={patch} />}
    </div>
  );
};

const MapView = ({ apiKey, roasters, onPick, onFail }: { apiKey: string; roasters: Roaster[]; onPick: (r: Roaster) => void; onFail: (why: string) => void }) => {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<{ g: GoogleMaps; m: GMap } | null>(null);
  const markers = useRef<GMarker[]>([]);
  const [ready, setReady] = useState(false);
  const pick = useRef(onPick);
  pick.current = onPick;
  const fail = useRef(onFail);
  fail.current = onFail;

  useEffect(() => {
    let alive = true;
    loadGoogleMaps(apiKey).then((g) => {
      if (!alive || !el.current) return;
      map.current = { g, m: new g.Map(el.current, { center: { lat: 20, lng: 0 }, zoom: 2, disableDefaultUI: true, gestureHandling: "greedy", clickableIcons: false, backgroundColor: "#141318", styles: MAP_STYLE }) };
      setReady(true);
    }).catch((e: Error) => { if (alive) fail.current(e.message); });
    return () => { alive = false; };
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const { g, m } = map.current;
    for (const mk of markers.current) mk.setMap(null);
    markers.current = [];
    const bounds = new g.LatLngBounds();
    for (const r of roasters) {
      if (!r.located || r.lat === null || r.lng === null) continue;
      const pos = { lat: r.lat, lng: r.lng };
      const rated = r.avgRating !== null;
      const mk = new g.Marker({
        position: pos, map: m, title: r.name,
        icon: { path: g.SymbolPath.CIRCLE, scale: pinRadius(r.avgRating), fillColor: "#c2905e", fillOpacity: rated ? 1 : 0.5, strokeColor: "#1c1a21", strokeWeight: 2 },
        label: rated ? { text: ratingLabel(r.avgRating), color: "#1c1a21", fontFamily: "'Courier Prime', 'Courier New', monospace", fontWeight: "700", fontSize: "11px" } : undefined,
      });
      mk.addListener("click", () => pick.current(r));
      markers.current.push(mk);
      bounds.extend(pos);
    }
    if (!bounds.isEmpty()) {
      m.fitBounds(bounds, 40);
      if (markers.current.length === 1) m.setZoom(12);
    }
  }, [ready, roasters]);

  return <div className="map"><div ref={el} />{!ready && <div className="map-wait">LOADING MAP</div>}</div>;
};

const RoasterSheet = ({ roaster: r, onClose, onPatched }: { roaster: Roaster; onClose: () => void; onPatched: (r: Roaster) => void }) => {
  const s = useStore();
  const [fixing, setFixing] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const relocate = async () => {
    setBusy(true);
    try {
      const moved = await api.relocateRoaster(r.id, query.trim() || null);
      onPatched(moved);
      setFixing(false);
      s.showToast(moved.located ? `${moved.name} moved to ${moved.address ?? "its new spot"}` : `Nothing found for "${query.trim() || r.name}"`);
    } catch (e) {
      s.showToast(e instanceof ApiError && e.status === 503 ? "Roaster lookup is not configured on this deployment" : "Could not move the roaster");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet">
        <Grabber />
        <div className="sheet-head"><span>ROASTER</span><div className="line" /><span className="count">{r.matchCount !== null ? `${r.matchCount} in your palate` : ""}</span></div>
        <div className="roaster-name">{r.name}</div>
        <div className="roaster-addr">{r.located ? r.address ?? "located, address unknown" : "not on the map — no place matched this name"}</div>
        <div className="roaster-stats">
          <span>★ {ratingLabel(r.avgRating)}</span>
          <span>{r.bags} {r.bags === 1 ? "BAG" : "BAGS"}</span>
          <span>{r.brews} {r.brews === 1 ? "BREW" : "BREWS"}</span>
        </div>
        {(r.topFlavours.length > 0 || r.dislikedFlavours.length > 0) && (
          <div className="chips" style={{ gap: 8, marginTop: 12 }}>
            {r.topFlavours.map((f) => <div key={f} className="tag-dash">{f}</div>)}
            {r.dislikedFlavours.map((f) => <div key={"-" + f} className="tag-dash" style={{ borderColor: "rgba(161,85,63,.7)", color: "var(--rust-light)", textDecoration: "line-through" }}>{f}</div>)}
          </div>
        )}
        {fixing ? (
          <div className="relocate">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${r.name}, city or street`} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && !busy) void relocate(); }} />
            <button className="act" disabled={busy} onClick={() => void relocate()}>{busy ? "…" : "FIND →"}</button>
          </div>
        ) : (
          <div className="log-open" style={{ background: "transparent", border: 0, padding: 0, marginTop: 14 }}>
            <div className="acts">
              <a className="act" href={mapsUrl(r)} target="_blank" rel="noopener noreferrer">OPEN IN MAPS →</a>
              {r.website && <a className="act" href={r.website} target="_blank" rel="noopener noreferrer">WEBSITE →</a>}
              <button className="act" style={{ borderColor: "rgba(194,144,94,.35)", color: "rgba(233,214,174,.55)" }} onClick={() => setFixing(true)}>{r.located ? "WRONG PLACE?" : "FIND IT"}</button>
            </div>
          </div>
        )}
        <button className="cta panel" style={{ marginTop: 16 }} onClick={onClose}><span>DONE</span></button>
      </div>
    </>
  );
};
