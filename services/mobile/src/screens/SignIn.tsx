import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { api } from "../api/client";
import { Hint, Outline } from "../components/Chrome";
import { Seal } from "../components/Icons";
import { ORIGIN } from "../config";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C } from "../theme/tokens";

// Google refuses to sign anyone in from a bare embedded web view; it wants a browser's name.
const SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/**
 * Identity comes only from the proxy (§AGENTS): the app signs in exactly where the browser does,
 * on the proxy's own pages, and keeps the cookie it hands back. Once the WebView lands on our
 * origin outside `/oauth2/`, the session exists and the log is fetched with it.
 */
export const SignIn = () => {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onNav = (e: WebViewNavigation) => {
    if (busy || e.loading) return;
    if (e.url.startsWith(ORIGIN) && !e.url.startsWith(ORIGIN + "/oauth2/")) {
      setBusy(true);
      void s.signIn().finally(() => { setBusy(false); setOpen(false); });
    }
  };

  if (open) {
    return (
      <View style={[st.fill, { paddingTop: insets.top, backgroundColor: C.bg }]}>
        <View style={st.bar}>
          <Text style={st.barText}>{busy ? "OPENING THE LOG" : "SIGN IN"}</Text>
          <Text onPress={() => setOpen(false)} style={[st.barText, { color: C.text50 }]}>CANCEL</Text>
        </View>
        <WebView source={{ uri: api.signInUrl }} sharedCookiesEnabled thirdPartyCookiesEnabled incognito={false} userAgent={SAFARI_UA}
          onNavigationStateChange={onNav} style={{ flex: 1, backgroundColor: C.bg }} />
      </View>
    );
  }

  return (
    <View style={[st.fill, st.door, { paddingTop: insets.top, paddingBottom: 40 + insets.bottom }]}>
      <Seal scale={0.85} />
      <Text style={st.wordmark}>BREWBOOK</Text>
      <View style={st.tagline}><Text style={st.star}>✦</Text><Text style={st.taglineText}>A PERSONAL BREW LOG</Text><Text style={st.star}>✦</Text></View>
      <Text style={st.blurb}>One bag of coffee at a time, one brew ticket per bag. Signing in is the account: no forms, no password.</Text>
      <Outline onPress={() => setOpen(true)} style={{ alignSelf: "stretch", marginTop: 30 }}>SIGN IN WITH GOOGLE →</Outline>
      <Hint style={{ marginTop: 14 }}>{ORIGIN.replace(/^https?:\/\//, "")}</Hint>
    </View>
  );
};

const st = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  door: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: C.bg },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, minHeight: 44 },
  barText: c(700, 10, 3, C.copperLight),
  wordmark: { ...g(700, 26, 12), marginTop: 20, marginLeft: 12 },
  tagline: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  taglineText: c(700, 10, 4, C.copper90),
  star: { fontSize: 8, color: C.copper90 },
  blurb: { ...g(400, 14, 0, C.text75), lineHeight: 21, textAlign: "center", marginTop: 26, maxWidth: 320 },
});
