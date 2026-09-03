import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, ApiError } from "../api/client";
import type { Roaster, RoasterCandidate } from "../api/types";
import { useDeviceLocation } from "../hooks/useDeviceLocation";
import { fmtDistance } from "../lib/roasters";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C } from "../theme/tokens";
import { Act, Backdrop, Empty, Hint, Sheet, SheetHead } from "./Chrome";

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
  const waiting = loc.kind === "asking" || found.kind === "loading";

  return (
    <>
      <Backdrop onPress={onClose} />
      <Sheet>
        <SheetHead title={`FIND ${name.toUpperCase()}`} count={near} />
        <View style={st.search}>
          <TextInput value={query} onChangeText={setQuery} placeholder={`${name}, city or street`} placeholderTextColor={C.text45}
            onSubmitEditing={() => { if (!busy) setRetry((n) => n + 1); }} style={st.input} accessibilityLabel="Roaster search" />
          <Act disabled={busy || loc.kind === "asking"} onPress={() => setRetry((n) => n + 1)} style={{ height: 44 }}>SEARCH →</Act>
        </View>

        {waiting && <Empty>Looking for {query.trim() || name}…</Empty>}
        {found.kind === "unavailable" && <Empty>Roaster lookup is not configured on this deployment — the bag is saved, the roaster has no pin.</Empty>}
        {found.kind === "error" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14 }}>
            <Text style={{ ...g(400, 13, 0, C.text50), flex: 1 }}>{found.message}</Text>
            <Act onPress={() => setRetry((n) => n + 1)}>TRY AGAIN →</Act>
          </View>
        )}
        {found.kind === "list" && found.candidates.length === 0 && <Empty>Nothing found for "{found.query}" — try the city or the street.</Empty>}
        {found.kind === "list" && found.candidates.map((cand) => (
          <Pressable key={cand.placeId} style={st.row} disabled={busy} onPress={() => void place(cand)}>
            <Text style={st.mark}>◎</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.name}>{cand.name}</Text>
              <Text style={st.sub}>{cand.address ?? "address unknown"}</Text>
            </View>
            <Text style={st.dist}>{fmtDistance(cand.distanceKm)}</Text>
          </Pressable>
        ))}

        {!waiting && found.kind !== "unavailable" && <Hint left style={{ marginTop: 12 }}>Not here? Close this and the question stays open for next time.</Hint>}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Act quiet disabled={busy} onPress={() => void place(null)}>NONE OF THESE</Act>
          <Act onPress={onClose}>LATER</Act>
        </View>
      </Sheet>
    </>
  );
};

const st = StyleSheet.create({
  search: { flexDirection: "row", gap: 8, marginTop: 6 },
  input: { ...g(500, 14), flex: 1, minWidth: 0, height: 44, borderWidth: 1, borderColor: C.copper45, paddingHorizontal: 12, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, width: "100%", borderBottomWidth: 1, borderBottomColor: C.copper30, borderStyle: "dotted" },
  mark: { width: 16, color: C.copper, fontSize: 10 },
  name: { ...g(600, 16, 1), textTransform: "uppercase" },
  sub: { ...g(400, 12, 0, C.text55), marginTop: 2 },
  dist: c(700, 10, 1, C.text50),
});
