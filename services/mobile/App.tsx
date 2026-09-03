import { useCallback, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { CourierPrime_400Regular, CourierPrime_700Bold } from "@expo-google-fonts/courier-prime";
import * as SplashScreen from "expo-splash-screen";
import { Act, BarCtx, Toast } from "./src/components/Chrome";
import { TabBar } from "./src/components/TabBar";
import { BeanDetail } from "./src/screens/BeanDetail";
import { BeanEdit } from "./src/screens/BeanEdit";
import { BrewEdit } from "./src/screens/BrewEdit";
import { Friends } from "./src/screens/Friends";
import { Guide } from "./src/screens/Guide";
import { Home } from "./src/screens/Home";
import { Library } from "./src/screens/Library";
import { Passport } from "./src/screens/Passport";
import { Profile } from "./src/screens/Profile";
import { Roasters } from "./src/screens/Roasters";
import { Scan } from "./src/screens/Scan";
import { ScanForm } from "./src/screens/ScanForm";
import { SignIn } from "./src/screens/SignIn";
import { Splash } from "./src/screens/Splash";
import { Timer } from "./src/screens/Timer";
import { WheelLayer } from "./src/screens/Wheel";
import { StoreProvider, useStore, type Screen } from "./src/state/store";
import { c, g } from "./src/theme/text";
import { C } from "./src/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** The bar is hidden only where the screen is a single task the user is inside of. */
const BAR_SCREENS: Screen[] = ["home", "library", "roasters", "friends", "profile", "bean", "passport"];

const showBar = (screen: Screen, wheelOpen: boolean) => BAR_SCREENS.includes(screen) && !wheelOpen;

const Shell = () => {
  const s = useStore();
  const bar = showBar(s.screen, s.wheelOpen);
  return (
    <BarCtx.Provider value={bar}>
      <View style={st.shell}>
        {s.screen === "splash" && <Splash />}
        {s.screen !== "splash" && !s.signedIn && <SignIn />}
        {s.screen !== "splash" && s.signedIn && s.loading && <Notice title="OPENING THE LOG" sub="fetching your bags and brews" />}
        {s.screen !== "splash" && s.signedIn && !s.loading && s.error && (
          <Notice title="LOG UNAVAILABLE" sub={s.error}>
            <Act onPress={() => void s.refresh()}>TRY AGAIN →</Act>
          </Notice>
        )}
        {s.screen !== "splash" && s.signedIn && !s.loading && !s.error && (
          <>
            {s.screen === "home" && <Home />}
            {s.screen === "timer" && <Timer />}
            {s.screen === "bean" && <BeanDetail />}
            {s.screen === "beanedit" && <BeanEdit />}
            {s.screen === "brewedit" && <BrewEdit />}
            {s.screen === "library" && <Library />}
            {s.screen === "roasters" && <Roasters />}
            {s.screen === "scan" && <Scan />}
            {s.screen === "scanform" && <ScanForm />}
            {s.screen === "passport" && <Passport />}
            {s.screen === "profile" && <Profile />}
            {s.screen === "friends" && s.hasFriends && <Friends />}
            {bar && <TabBar />}
            {s.wheelOpen && <WheelLayer />}
            {s.guideOpen && <Guide />}
          </>
        )}
        <Toast />
      </View>
    </BarCtx.Provider>
  );
};

const Notice = ({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) => (
  <View style={st.notice}><Text style={st.noticeT}>{title}</Text><Text style={st.noticeS}>{sub}</Text>{children}</View>
);

export default function App() {
  const [loaded] = useFonts({ SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, CourierPrime_400Regular, CourierPrime_700Bold });
  const onReady = useCallback(() => { void SplashScreen.hideAsync().catch(() => {}); }, []);
  useEffect(() => { if (loaded) onReady(); }, [loaded, onReady]);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  shell: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },
  notice: { ...StyleSheet.absoluteFill as object, alignItems: "center", justifyContent: "center", gap: 14, padding: 40 },
  noticeT: { ...c(700, 11, 3, C.copperLight), textAlign: "center" },
  noticeS: { ...g(400, 13, 0, C.text55), textAlign: "center" },
});
