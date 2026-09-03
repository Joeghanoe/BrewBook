import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Brew } from "../api/types";
import { Defect } from "./Chrome";
import { useStore } from "../state/store";
import { C } from "../theme/tokens";

export const DEFECTS = ["Sour", "Bitter", "Thin", "Harsh"];

/**
 * Stars and defects for one brew, usable at any time after it: on the rate card, in the dial-in
 * log, on the edit screen. Tapping the star it already has takes the rating off again.
 */
export const RateRow = ({ brew, onPick, compact, children }: { brew: Brew; onPick?: (rating: number) => void; compact?: boolean; children?: ReactNode }) => {
  const s = useStore();
  const [defects, setDefects] = useState<string[]>(brew.defects);
  const toggle = (d: string) => {
    const next = defects.includes(d) ? defects.filter((x) => x !== d) : [...defects, d];
    setDefects(next);
    void s.rateBrew(brew.id, null, next);
  };
  const pick = (n: number) => {
    const next = n === brew.rating ? 0 : n;
    void s.rateBrew(brew.id, next, null);
    s.showToast(next ? `N° ${String(brew.number).padStart(3, "0")} rated ${"★".repeat(next)}` : `N° ${String(brew.number).padStart(3, "0")} unrated`);
    onPick?.(next);
  };
  return (
    <>
      <View style={[st.stars, compact && { marginTop: 10 }]}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= brew.rating;
          return (
            <Pressable key={n} onPress={() => pick(n)} accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`} accessibilityState={{ selected: on }}
              style={({ pressed }) => [st.star, compact && { height: 38 }, on && st.starOn, pressed && { backgroundColor: C.copper20 }]}>
              <Text style={{ fontSize: compact ? 16 : 19, color: C.copperLight }}>★</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={st.defects}>
        {DEFECTS.map((d) => <Defect key={d} on={defects.includes(d)} onPress={() => toggle(d)}>{d}</Defect>)}
        {children}
      </View>
    </>
  );
};

const st = StyleSheet.create({
  stars: { flexDirection: "row", gap: 8, marginTop: 12 },
  star: { flex: 1, height: 46, borderWidth: 1, borderColor: C.copper50, alignItems: "center", justifyContent: "center" },
  starOn: { borderColor: C.copperLight, backgroundColor: "rgba(194, 144, 94, 0.22)" },
  defects: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" },
});
