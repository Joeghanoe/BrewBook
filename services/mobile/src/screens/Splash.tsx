import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeUp, Glow } from "../components/Anim";
import { Seal } from "../components/Icons";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C } from "../theme/tokens";

const AUTO_ADVANCE_MS = 3200;

export const Splash = () => {
  const { setScreen, invite } = useStore();
  const insets = useSafeAreaInsets();
  // Following an invitation link opens on the invitation itself (§5).
  const landing = invite ? "friends" : "home";
  useEffect(() => {
    const id = setTimeout(() => setScreen(landing), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [setScreen, landing]);
  return (
    <Pressable style={st.splash} onPress={() => setScreen(landing)}>
      <Seal draw />
      <FadeUp duration={1000} delay={300}><Text style={st.wordmark}>BREWBOOK</Text></FadeUp>
      <FadeUp duration={1000} delay={550} style={st.tagline}>
        <Text style={st.starSmall}>✦</Text><Text style={st.taglineText}>A PERSONAL BREW LOG</Text><Text style={st.starSmall}>✦</Text>
      </FadeUp>
      <Glow style={[st.enter, { bottom: 56 + insets.bottom }]}><Text style={st.enterText}>TAP TO ENTER</Text></Glow>
      <View />
    </Pressable>
  );
};

const st = StyleSheet.create({
  splash: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  wordmark: { ...g(700, 26, 12), marginTop: 26, marginLeft: 12 },
  tagline: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  taglineText: c(700, 10, 4, C.copper90),
  starSmall: { fontSize: 8, color: C.copper90 },
  enter: { position: "absolute" },
  enterText: g(400, 12, 2, C.text45),
});
