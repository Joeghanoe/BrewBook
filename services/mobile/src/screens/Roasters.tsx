import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { api, ApiError } from "../api/client";
import type { Roaster, RoasterScope, RoasterVoice, SharedBrew } from "../api/types";
import { Act, Backdrop, Chips, Cta, Empty, Hint, Leaf, Link, Nav, Rule, Screen, Sheet, SheetHead, Spacer, SqBtn, Title } from "../components/Chrome";
import { RoasterPicker } from "../components/RoasterPicker";
import { MAP_STYLE } from "../lib/mapStyle";
import { fmtTimeOrDash, METHOD_LABEL, paramsFor, stars, val } from "../lib/format";
import { mapsUrl, pinKind, pinRadius, pinVoice, ratingLabel, topLikedFlavours } from "../lib/roasters";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C } from "../theme/tokens";

const PRESELECTED = 3;

export const Roasters = () => {
  const s = useStore();
  const palate = useMemo(() => topLikedFlavours(s.brews), [s.brews]);
  const [selected, setSelected] = useState<string[]>(() => palate.slice(0, PRESELECTED));
  const [roasters, setRoasters] = useState<Roaster[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Roaster | null>(null);

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
  const located = roasters?.filter((r) => r.located && r.lat !== null && r.lng !== null) ?? [];
  const unlocated = roasters?.filter((r) => !r.located) ?? [];
  // The map draws itself from the device; it is there as soon as one roaster has a place.
  const mapOn = located.length > 0;

  return (
    <Screen>
      <Nav>
        <Title>ROASTERS</Title>
        <Spacer />
        <Link color={C.text50}>{roasters ? `${roasters.length} ON RECORD` : ""}</Link>
      </Nav>

      {s.hasFriends && <ScopeSwitch />}

      <View style={{ paddingTop: 14, paddingHorizontal: 22 }}>
        <Rule label="YOUR PALATE" right={selected.length ? `${selected.length} ON` : "ALL ROASTERS"} />
        {palate.length === 0 ? (
          <Hint left style={{ marginTop: 8 }}>tag flavours on a brew to search roasters by what you like</Hint>
        ) : (
          <Chips compact style={{ marginTop: 8 }}>
            {palate.map((f) => <Leaf key={f} compact state={selected.includes(f) ? "pos" : null} onPress={() => toggle(f)}>{f}</Leaf>)}
            {selected.length > 0 && <Leaf compact dashed onPress={() => setSelected([])}>clear</Leaf>}
          </Chips>
        )}
      </View>

      {mapOn && <RoasterMap roasters={located} onPick={setOpen} />}

      <ScrollView style={{ flex: 1, paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
        {mapOn && unlocated.length > 0 && <Rule label="NOT ON THE MAP" right={`${unlocated.length}`} style={{ marginTop: 14 }} />}
        {error && <View style={{ paddingVertical: 26, gap: 10 }}><Empty style={{ paddingVertical: 0 }}>{error}</Empty><Act onPress={() => void load(selected, scope)}>TRY AGAIN →</Act></View>}
        {!error && roasters === null && <Empty>Finding your roasters…</Empty>}
        {roasters?.length === 0 && <Empty>{emptyLine(scope, selected.length > 0)}</Empty>}
        {(mapOn ? unlocated : roasters ?? []).map((r) => {
          const v = pinVoice(r);
          const kind = pinKind(r);
          const off = v?.avgRating == null;
          return (
            <Pressable key={r.id} style={({ pressed }) => [st.row, pressed && { backgroundColor: C.copper06 }]} onPress={() => setOpen(r)}>
              <View style={[st.pin, kind === "friend" && { backgroundColor: C.green }, kind === "wish" && st.pinWish, off && kind !== "wish" && st.pinOff]}>
                <Text style={[st.pinText, kind === "wish" && { color: C.copperLight }, off && kind !== "wish" && { color: C.text55 }]}>{kind === "wish" ? "◇" : ratingLabel(v?.avgRating ?? null)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.rowName} numberOfLines={1}>{r.name}</Text>
                <Text style={st.rowSub} numberOfLines={1}>{rowLine(r, v, kind)}</Text>
              </View>
              {r.matchCount !== null && <Text style={st.match}>{r.matchCount} OF {selected.length}</Text>}
            </Pressable>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
      {open && <RoasterSheet roaster={open} onClose={() => setOpen(null)} onPatched={patch} />}
    </Screen>
  );
};

const RoasterMap = ({ roasters, onPick }: { roasters: Roaster[]; onPick: (r: Roaster) => void }) => {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready || !map.current) return;
    const coords = roasters.map((r) => ({ latitude: r.lat!, longitude: r.lng! }));
    if (coords.length === 1) map.current.animateToRegion({ ...coords[0], latitudeDelta: 0.08, longitudeDelta: 0.08 }, 300);
    else if (coords.length > 1) map.current.fitToCoordinates(coords, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
  }, [ready, roasters]);
  return (
    <View style={st.map}>
      <MapView ref={map} provider={PROVIDER_DEFAULT} style={StyleSheet.absoluteFill} customMapStyle={MAP_STYLE} userInterfaceStyle="dark"
        initialRegion={{ latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 120 }}
        showsPointsOfInterests={false} showsBuildings={false} showsTraffic={false} toolbarEnabled={false} onMapReady={() => setReady(true)}>
        {roasters.map((r) => {
          const v = pinVoice(r);
          const kind = pinKind(r);
          const rated = v?.avgRating != null;
          // Whose it is, the roaster, the rating. Everything else waits for the tap (§4).
          const fill = kind === "mine" ? C.copper : kind === "friend" ? C.green : C.panel;
          const d = pinRadius(v?.avgRating ?? null) * 2;
          return (
            <Marker key={r.id} coordinate={{ latitude: r.lat!, longitude: r.lng! }} onPress={() => onPick(r)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}
              title={kind === "wish" ? `${r.name} — want to visit` : `${r.name} — ${v?.name ?? ""}`}>
              <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: fill, opacity: kind === "wish" ? 0.9 : rated ? 1 : 0.5, borderWidth: 2, borderColor: kind === "wish" ? C.copperLight : C.bg, alignItems: "center", justifyContent: "center" }}>
                {kind === "wish" ? <Text style={c(700, 12, 0, C.copperLight)}>◇</Text> : rated ? <Text style={c(700, 10, 0, C.bg)}>{v!.initials} {ratingLabel(v!.avgRating)}</Text> : null}
              </View>
            </Marker>
          );
        })}
      </MapView>
      {!ready && <View style={st.mapWait}><Text style={c(700, 10, 3, C.copper70)}>LOADING MAP</Text></View>}
    </View>
  );
};

const RoasterSheet = ({ roaster: r, onClose, onPatched }: { roaster: Roaster; onClose: () => void; onPatched: (r: Roaster) => void }) => {
  const s = useStore();
  // A wrong pin is fixed the way a missing one is: pick from the candidates, or say none of them.
  const [fixing, setFixing] = useState(false);
  const [wished, setWished] = useState(r.wished);
  const [reading, setReading] = useState<RoasterVoice | null>(null);

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
  if (fixing) return <RoasterPicker roasterId={r.id} name={r.name} onPlaced={(moved) => { onPatched(moved); setFixing(false); }} onClose={() => setFixing(false)} />;

  return (
    <>
      <Backdrop onPress={onClose} />
      <Sheet>
        <SheetHead title="ROASTER" count={r.matchCount !== null ? `${r.matchCount} in your palate` : ""} />
        <Text style={st.roasterName}>{r.name}</Text>
        <Text style={st.roasterAddr}>{r.located ? r.address ?? "located, address unknown" : "not on the map — no place matched this name"}</Text>

        {r.voices.length === 0 && (
          <Empty style={{ paddingVertical: 14 }}>Nobody has drunk this one yet — it is on your map because you want to go.</Empty>
        )}
        {/* Three friends who disagree show three ratings. The app never averages people into a score. */}
        {r.voices.map((v) => (
          <Pressable key={v.userId} style={st.voice} disabled={v.isMe} onPress={() => setReading(v)}>
            <View style={[st.avatar, v.isMe && st.avatarMe]}><Text style={[st.avatarText, v.isMe && { color: C.ink }]}>{v.initials}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.voiceName}>{v.isMe ? "You" : v.name}</Text>
              <Text style={st.voiceSub} numberOfLines={1}>
                {[`${v.bags} ${v.bags === 1 ? "bag" : "bags"}`, `${v.brews} ${v.brews === 1 ? "brew" : "brews"}`, ...v.topFlavours.slice(0, 2)].join(" · ")}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[st.voiceStars, v.avgRating === null && { color: C.text35 }]}>{v.avgRating === null ? "●" : stars(Math.round(v.avgRating))}</Text>
              <Text style={st.voiceAvg}>{v.avgRating === null ? "UNRATED" : `${v.avgRating.toFixed(1)} avg`}</Text>
            </View>
            {!v.isMe && <Text style={c(700, 13, 0, C.copperLight)}>→</Text>}
          </Pressable>
        ))}

        <View style={{ flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Act on={wished} onPress={() => void wish()}>{wished ? "✦ WANT TO VISIT" : "WANT TO VISIT"}</Act>
          <Act onPress={() => void Linking.openURL(mapsUrl(r))}>OPEN IN MAPS →</Act>
          {r.website && <Act onPress={() => void Linking.openURL(r.website!)}>WEBSITE →</Act>}
          <Act quiet onPress={() => setFixing(true)}>{r.located ? "WRONG PLACE?" : "FIND IT"}</Act>
        </View>
        <Cta panel label="DONE" style={{ marginTop: 16 }} onPress={onClose} />
      </Sheet>
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
      <Backdrop onPress={onClose} />
      <Sheet>
        <SheetHead title={voice.name.toUpperCase()} count={roaster.name} left={<SqBtn onPress={onBack} label="Back">←</SqBtn>} />
        {!recipes && !error && <Empty>Reading their brews…</Empty>}
        {error && <Empty>{error}</Empty>}
        {recipes?.length === 0 && <Empty>They have not rated anything from here yet.</Empty>}
        <ScrollView style={{ maxHeight: 360, marginTop: 12 }} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
          {recipes?.map((r) => (
            <View key={r.id} style={st.recipe}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <Text style={g(600, 14)}>{r.beanName}</Text>
                <Text style={{ fontSize: 12, color: C.copperLight, letterSpacing: 2 }}>{stars(r.rating)}</Text>
              </View>
              <View style={st.nums}>
                {[{ k: "METHOD", v: METHOD_LABEL[r.params.method] }, ...paramsFor(r.params.method).map((cfg) => ({ k: cfg.label, v: cfg.fmt(val(r.params, cfg.key)) + cfg.cellUnit })), { k: "TOOK", v: fmtTimeOrDash(r.durationMs) }].map((n) => (
                  <View key={n.k} style={st.num}><Text style={c(700, 8, 1.5, C.text45)}>{n.k}</Text><Text style={{ ...g(600, 15), marginTop: 2 }}>{n.v}</Text></View>
                ))}
              </View>
              {(r.flavourTags.length > 0 || r.declaredNotes.length > 0) && (
                <Chips compact style={{ marginTop: 10 }}>
                  {r.flavourTags.map((t) => <Leaf key={t.flavour} compact state={t.polarity < 0 ? "neg" : "pos"}>{t.polarity < 0 ? "− " : ""}{t.flavour}</Leaf>)}
                </Chips>
              )}
              <Act style={{ marginTop: 12 }} onPress={() => take(r)}>BREW THESE NUMBERS →</Act>
            </View>
          ))}
        </ScrollView>
        <Cta panel label="DONE" style={{ marginTop: 16 }} onPress={onClose} />
      </Sheet>
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
    <View style={st.scope}>
      {options.map((o) => (
        <Pressable key={o.key} style={[st.scopeBtn, s.scope === o.key && { backgroundColor: C.copper }]} onPress={() => s.setScope(o.key)}>
          <Text style={[st.scopeText, s.scope === o.key && { color: C.ink }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
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

const st = StyleSheet.create({
  map: { height: 320, marginTop: 12, marginHorizontal: 22, borderWidth: 1, borderColor: C.copper30, backgroundColor: C.inkCanvas, overflow: "hidden" },
  mapWait: { ...StyleSheet.absoluteFill as object, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.copper20, minHeight: 60 },
  pin: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.copper, alignItems: "center", justifyContent: "center" },
  pinOff: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: C.copper45 },
  pinWish: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: C.copper55 },
  pinText: c(700, 11, 0, C.bg),
  rowName: { ...g(600, 15, 1), textTransform: "uppercase" },
  rowSub: { ...g(400, 12, 0, C.text55), marginTop: 2 },
  match: c(700, 10, 1, C.copperLight),
  roasterName: { ...g(700, 20, 2), textTransform: "uppercase" },
  roasterAddr: { ...g(400, 13, 0, C.text55), marginTop: 4 },
  voice: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.copper15, minHeight: 44 },
  avatar: { width: 38, height: 38, borderWidth: 1, borderColor: C.copper55, alignItems: "center", justifyContent: "center", backgroundColor: C.copper10 },
  avatarMe: { backgroundColor: C.copper, borderColor: C.copper },
  avatarText: c(700, 12, 1, C.copperLight),
  voiceName: g(600, 14),
  voiceSub: { ...g(400, 11, 0, C.text50), marginTop: 2 },
  voiceStars: { fontSize: 11, letterSpacing: 1, color: C.copperLight },
  voiceAvg: { ...c(700, 9, 1, C.text50), marginTop: 2 },
  recipe: { borderWidth: 1, borderColor: C.copper30, padding: 14 },
  nums: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  num: { width: "31%", flexGrow: 1, borderWidth: 1, borderColor: C.copper20, paddingVertical: 6, paddingHorizontal: 4, alignItems: "center" },
  scope: { flexDirection: "row", gap: 1, marginTop: 12, marginHorizontal: 22, borderWidth: 1, borderColor: C.copper30, backgroundColor: C.copper20 },
  scopeBtn: { flex: 1, minHeight: 40, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  scopeText: c(700, 10, 2, C.text50),
});
