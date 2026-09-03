import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore, type Screen } from "../state/store";
import { c } from "../theme/text";
import { C, TABBAR_H } from "../theme/tokens";
import { FriendsIcon, LibraryIcon, MapIcon, ProfileIcon, TicketIcon } from "./Icons";

/**
 * The only way around the app (§3). It carries destinations, not actions: scan, bean detail,
 * the wheel and the passport are reached from the place they belong to, never from here.
 * Sub-screens (`bean`, `passport`, `scan`, `scanform`) light the tab they hang off.
 */
const TABS: { screen: Screen; label: string; under: Screen[]; icon: (color: string) => React.ReactNode }[] = [
  { screen: "home", label: "HOME", under: [], icon: (color) => <TicketIcon color={color} /> },
  { screen: "library", label: "LIBRARY", under: ["bean", "beanedit", "scan", "scanform"], icon: (color) => <LibraryIcon color={color} /> },
  { screen: "roasters", label: "MAP", under: [], icon: (color) => <MapIcon color={color} /> },
  { screen: "friends", label: "FRIENDS", under: [], icon: (color) => <FriendsIcon color={color} /> },
  { screen: "profile", label: "PROFILE", under: ["passport"], icon: (color) => <ProfileIcon color={color} /> },
];

export const TabBar = () => {
  const s = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[st.bar, { paddingBottom: insets.bottom }]}>
      {TABS.filter((t) => t.screen !== "friends" || s.hasFriends).map((t) => {
        const on = s.screen === t.screen || t.under.includes(s.screen);
        const color = on ? C.copperLight : C.text45;
        return (
          <Pressable key={t.screen} accessibilityRole="tab" accessibilityState={{ selected: on }} style={st.tab}
            onPress={() => { s.setSheet(null); s.setScreen(t.screen); }}>
            {t.icon(color)}
            <Text style={[st.label, { color: on ? C.text : C.text45 }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const st = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 70, flexDirection: "row", borderTopWidth: 1, borderTopColor: C.copper30, backgroundColor: C.tabbar },
  tab: { flex: 1, minHeight: TABBAR_H, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8 },
  label: c(700, 8.5, 1.4),
});
