import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Roaster, RoasterScope, RoasterVoice, SharedBrew } from "../api/types";
import { Grabber, Rule } from "../components/Chrome";
import { loadGoogleMaps, MAP_STYLE, type GMap, type GMarker, type GoogleMaps } from "../lib/googleMaps";
import { fmtTime, PARAMS, stars } from "../lib/format";
import { mapsUrl, pinKind, pinRadius, pinVoice, ratingLabel, topLikedFlavours } from "../lib/roasters";
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

  const load = useCallback(async (flavours: string[], scope: RoasterScope) => {
    setError(null);
    try {
      setRoasters(await api.roasters(flavours, scope));
    } catch (e) {
      setRoasters(null);
      setError(e instanceof ApiError ? e.message : "The brew log could not be reached.");
    }
  }, []);
  const { scope } = s;
  useEffect(() => { void load(selected, scope); }, [load, selected, scope]);

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
      <div className="nav">
        <div className="title">ROASTERS</div>
        <div style={{ flex: 1 }} />
        <span className="link" style={{ color: "rgba(233,214,174,.5)" }}>{roasters ? `${roasters.length} ON RECORD` : ""}</span>
      </div>

      <ScopeSwitch />

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
        {error && <div className="empty">{error} <button className="act" style={{ marginLeft: 8 }} onClick={() => void load(selected, scope)}>TRY AGAIN →</button></div>}
        {!error && roasters === null && <div className="empty">Finding your roasters…</div>}
        {roasters?.length === 0 && <div className="empty">{emptyLine(scope, selected.length > 0)}</div>}
        {(mapState.kind === "ready" ? unlocated : roasters ?? []).map((r) => {
          const v = pinVoice(r);
          const kind = pinKind(r);
          return (
            <button key={r.id} className="roaster-row" onClick={() => setOpen(r)}>
              <div className={`pin ${kind}` + (v?.avgRating == null ? " off" : "")}>{kind === "wish" ? "◇" : ratingLabel(v?.avgRating ?? null)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{r.name}</div>
                <div className="sub">{rowLine(r, v, kind)}</div>
              </div>
              {r.matchCount !== null && <span className="match">{r.matchCount} OF {selected.length}</span>}
            </button>
          );
        })}
        <div style={{ height: 20 }} />
      </div>
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
      const v = pinVoice(r);
      const kind = pinKind(r);
      const rated = v?.avgRating != null;
      // Whose it is, the roaster, the rating. Everything else waits for the tap (§4).
      const fill = kind === "mine" ? "#c2905e" : kind === "friend" ? "#8fae7e" : "#26242e";
      const mk = new g.Marker({
        position: pos, map: m, title: kind === "wish" ? `${r.name} — want to visit` : `${r.name} — ${v?.name ?? ""}`,
        icon: {
          path: g.SymbolPath.CIRCLE, scale: pinRadius(v?.avgRating ?? null), fillColor: fill,
          fillOpacity: kind === "wish" ? 0.9 : rated ? 1 : 0.5,
          strokeColor: kind === "wish" ? "#d8a86f" : "#1c1a21", strokeWeight: 2,
        },
        label: kind === "wish"
          ? { text: "◇", color: "#d8a86f", fontFamily: "'Courier Prime', 'Courier New', monospace", fontWeight: "700", fontSize: "12px" }
          : rated
            ? { text: `${v!.initials} ${ratingLabel(v!.avgRating)}`, color: "#1c1a21", fontFamily: "'Courier Prime', 'Courier New', monospace", fontWeight: "700", fontSize: "10px" }
            : undefined,
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
  const [wished, setWished] = useState(r.wished);
  const [reading, setReading] = useState<RoasterVoice | null>(null);

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

  // A place you mean to go, marked on the map you already have open (§4).
  const wish = async () => {
    const next = !wished;
    setWished(next);
    try {
      await api.wishRoaster(r.id, next);
      s.showToast(next ? `${r.name} pinned — add a bag from here and the pin clears itself` : "Pin removed");
    } catch {
      setWished(!next);
      s.showToast("Could not change the pin");
    }
  };

  if (reading) return <RecipesSheet roaster={r} voice={reading} onBack={() => setReading(null)} onClose={onClose} />;

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet">
        <Grabber />
        <div className="sheet-head"><span>ROASTER</span><div className="line" /><span className="count">{r.matchCount !== null ? `${r.matchCount} in your palate` : ""}</span></div>
        <div className="roaster-name">{r.name}</div>
        <div className="roaster-addr">{r.located ? r.address ?? "located, address unknown" : "not on the map — no place matched this name"}</div>

        {r.voices.length === 0 && (
          <div className="empty" style={{ padding: "14px 0" }}>Nobody has drunk this one yet — it is on your map because you want to go.</div>
        )}
        {/* Three friends who disagree show three ratings. The app never averages people into a score. */}
        {r.voices.map((v) => (
          <button key={v.userId} className={"voice" + (v.isMe ? " me" : "")} disabled={v.isMe}
            onClick={() => setReading(v)}>
            <div className={"avatar" + (v.isMe ? " me" : "")}>{v.initials}</div>
            <div className="body">
              <div className="name">{v.isMe ? "You" : v.name}</div>
              <div className="sub">
                {[`${v.bags} ${v.bags === 1 ? "bag" : "bags"}`, `${v.brews} ${v.brews === 1 ? "brew" : "brews"}`, ...v.topFlavours.slice(0, 2)].join(" · ")}
              </div>
            </div>
            <div className={"score" + (v.avgRating === null ? " none" : "")}>
              <span className="stars">{v.avgRating === null ? "●" : stars(Math.round(v.avgRating))}</span>
              <div className="avg">{v.avgRating === null ? "UNRATED" : `${v.avgRating.toFixed(1)} avg`}</div>
            </div>
            {!v.isMe && <span className="go">→</span>}
          </button>
        ))}

        {fixing ? (
          <div className="relocate">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${r.name}, city or street`} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && !busy) void relocate(); }} />
            <button className="act" disabled={busy} onClick={() => void relocate()}>{busy ? "…" : "FIND →"}</button>
          </div>
        ) : (
          <div className="log-open" style={{ background: "transparent", border: 0, padding: 0, marginTop: 14 }}>
            <div className="acts">
              <button className={"act" + (wished ? " on" : "")} onClick={() => void wish()}>{wished ? "✦ WANT TO VISIT" : "WANT TO VISIT"}</button>
              <a className="act" href={mapsUrl(r)} target="_blank" rel="noopener noreferrer">OPEN IN MAPS →</a>
              {r.website && <a className="act" href={r.website} target="_blank" rel="noopener noreferrer">WEBSITE →</a>}
              <button className="act quiet" onClick={() => setFixing(true)}>{r.located ? "WRONG PLACE?" : "FIND IT"}</button>
            </div>
          </div>
        )}
        <button className="cta panel" style={{ marginTop: 16 }} onClick={onClose}><span>DONE</span></button>
      </div>
    </>
  );
};

/**
 * A friend's rated brews from this roaster. A recipe is not an object in this app — it is a rated
 * brew, and the shortest path from seeing one to owning it is to put its numbers on your ticket (§5).
 */
const RecipesSheet = ({ roaster, voice, onBack, onClose }: { roaster: Roaster; voice: RoasterVoice; onBack: () => void; onClose: () => void }) => {
  const s = useStore();
  const [recipes, setRecipes] = useState<SharedBrew[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.recipes(roaster.id, voice.userId)
      .then((rs) => { if (alive) setRecipes(rs); })
      .catch((e) => { if (alive) setError(e instanceof ApiError ? e.message : "Their brews could not be read."); });
    return () => { alive = false; };
  }, [roaster.id, voice.userId]);

  const take = (r: SharedBrew) => {
    if (!s.currentBean) { s.showToast("Add a bag first — numbers need beans to go with"); return; }
    // Their numbers land whole, against the user's own beans. Bags are never copied (§5).
    s.loadParams(r.params, { name: r.fromName, number: r.number });
    onClose();
    s.setScreen("home");
    s.showToast(`${r.fromName}'s N° ${String(r.number).padStart(3, "0")} on your ticket`);
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet">
        <Grabber />
        <div className="sheet-head">
          <button className="sqbtn" onClick={onBack} aria-label="Back">←</button>
          <span style={{ marginLeft: 10 }}>{voice.name.toUpperCase()}</span>
          <div className="line" />
          <span className="count">{roaster.name}</span>
        </div>
        {!recipes && !error && <div className="empty">Reading their brews…</div>}
        {error && <div className="empty">{error}</div>}
        {recipes?.length === 0 && <div className="empty">They have not rated anything from here yet.</div>}
        <div className="recipes">
          {recipes?.map((r) => (
            <div key={r.id} className="recipe">
              <div className="head">
                <span className="bean">{r.beanName}</span>
                <span className="stars">{stars(r.rating)}</span>
              </div>
              <div className="nums">
                {PARAMS.map((c) => (
                  <div key={c.key} className="num"><span>{c.label}</span><b>{c.fmt(r.params[c.key])}{c.cellUnit}</b></div>
                ))}
                <div className="num"><span>TIME</span><b>{fmtTime(r.durationMs)}</b></div>
              </div>
              {(r.flavourTags.length > 0 || r.declaredNotes.length > 0) && (
                <div className="chips compact" style={{ marginTop: 10 }}>
                  {r.flavourTags.map((t) => <div key={t.flavour} className={"leaf" + (t.polarity < 0 ? " neg" : " pos")}>{t.polarity < 0 ? "− " : ""}{t.flavour}</div>)}
                </div>
              )}
              <button className="act" style={{ marginTop: 12 }} onClick={() => take(r)}>BREW THESE NUMBERS →</button>
            </div>
          ))}
        </div>
        <button className="cta panel" style={{ marginTop: 16 }} onClick={onClose}><span>DONE</span></button>
      </div>
    </>
  );
};

/** Mine, friends', or both — one control, always visible, defaulting to the user's own map (§4). */
const ScopeSwitch = () => {
  const s = useStore();
  const options: { key: RoasterScope; label: string }[] = [
    { key: "mine", label: "MINE" },
    { key: "friends", label: "FRIENDS" },
    { key: "both", label: "BOTH" },
  ];
  return (
    <div className="scope">
      {options.map((o) => (
        <button key={o.key} className={"scope-btn" + (s.scope === o.key ? " on" : "")} onClick={() => s.setScope(o.key)}>{o.label}</button>
      ))}
    </div>
  );
};

const emptyLine = (scope: RoasterScope, filtered: boolean) => {
  if (filtered) return "No roaster matches this palate — clear a flavour.";
  if (scope === "friends") return "No friends' roasters yet. Swap links on the friends tab and their maps join yours.";
  if (scope === "both") return "Nothing on the map yet — add a bag with the roaster on its label, or add a friend.";
  return "No roasters yet — add a bag with the roaster on its label.";
};

const rowLine = (r: Roaster, v: RoasterVoice | null, kind: "mine" | "friend" | "wish") => {
  if (kind === "wish") return [r.address ?? "not located", "want to visit"].join(" · ");
  const whose = kind === "friend" ? (v?.name ?? "a friend") : `${r.bags} ${r.bags === 1 ? "bag" : "bags"}`;
  return [r.address ?? "not located", whose, (v?.topFlavours ?? []).slice(0, 3).join(" · ")].filter(Boolean).join(" · ");
};
