import { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { api, ApiError, type LocalFile } from "../api/client";
import type { LabelScan } from "../api/types";
import { Nav, Screen, SqBtn, Title } from "../components/Chrome";
import { ScanEye } from "../components/Icons";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C } from "../theme/tokens";

export interface ScanResult { scan: LabelScan; preview: string | null }

// Handed from Scan to ScanForm without a router: one module-level slot.
let pending: ScanResult | null = null;
export const takeScanResult = () => { const r = pending; pending = null; return r; };

export const Scan = () => {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const hasCamera = !!perm?.granted;

  // Ask once on arrival; a refusal leaves the shutter on the photo library.
  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) void requestPerm(); }, [perm?.granted, perm?.canAskAgain]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (f: LocalFile, preview: string | null) => {
    setBusy(true); setStatus(null);
    try {
      const scan = await api.scanLabel(f);
      pending = { scan, preview };
      s.setScreen("scanform");
    } catch (e) {
      setBusy(false);
      setStatus(e instanceof ApiError ? e.message.toUpperCase() : "COULD NOT REACH THE LABEL READER");
    }
  };

  // Labels are read off-device; a 12-megapixel frame is more than the reader needs.
  const shrink = async (uri: string, width: number) => {
    const out = await manipulateAsync(uri, width > 1600 ? [{ resize: { width: 1600 } }] : [], { compress: 0.85, format: SaveFormat.JPEG });
    return out.uri;
  };

  const shutter = async () => {
    if (busy) return;
    if (hasCamera && cam.current) {
      try {
        const pic = await cam.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
        const uri = await shrink(pic.uri, pic.width);
        void submit({ uri, name: "label.jpg", type: "image/jpeg" }, uri);
        return;
      } catch { /* the picker below is the fallback */ }
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    const a = res.assets?.[0];
    if (!a) return;
    const uri = await shrink(a.uri, a.width);
    void submit({ uri, name: "label.jpg", type: "image/jpeg" }, uri);
  };

  return (
    <Screen style={{ backgroundColor: C.scanBg }}>
      <Nav>
        <SqBtn onPress={() => s.setScreen("library")} label="Close">✕</SqBtn>
        <Title>SCAN LABEL</Title>
      </Nav>
      <View style={st.viewfinder}>
        {hasCamera && <CameraView ref={cam} facing="back" style={[StyleSheet.absoluteFill, { opacity: 0.85 }]} />}
        <View style={[st.bracket, { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3 }]} />
        <View style={[st.bracket, { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3 }]} />
        <View style={[st.bracket, { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
        <View style={[st.bracket, { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3 }]} />
        <View style={st.targetWrap}>
          <View style={st.target}>
            {busy ? <ScanEye /> : <Text style={st.targetText}>{hasCamera ? "align the bag's label inside the frame" : "no camera here — the shutter opens your photos"}</Text>}
          </View>
          <Text style={st.status}>
            {busy ? "READING LABEL…" : status ?? (!s.me?.features?.labelReading ? "LABEL READING NOT CONFIGURED · FILL IN BY HAND" : "EXTRACTION RUNS OFF-DEVICE")}
          </Text>
        </View>
      </View>
      <View style={[st.shutterWrap, { paddingBottom: 34 + insets.bottom }]}>
        <Pressable onPress={() => void shutter()} accessibilityLabel="Capture label" style={st.shutter}><View style={st.shutterDot} /></Pressable>
      </View>
    </Screen>
  );
};

export const Thumb = ({ uri }: { uri: string | null }) => (
  <View style={st.thumb}>{uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : <Text style={st.thumbText}>LABEL{"\n"}KEPT</Text>}</View>
);

const st = StyleSheet.create({
  viewfinder: { flex: 1, marginVertical: 20, marginHorizontal: 22, borderWidth: 1, borderColor: C.copper30, backgroundColor: "rgba(0,0,0,0.5)", overflow: "hidden" },
  bracket: { position: "absolute", width: 26, height: 26, zIndex: 2, borderColor: C.copper },
  targetWrap: { ...StyleSheet.absoluteFill as object, alignItems: "center", justifyContent: "center", gap: 16, zIndex: 2 },
  target: { width: 200, height: 260, borderWidth: 2, borderStyle: "dashed", borderColor: C.text35, alignItems: "center", justifyContent: "center" },
  targetText: { ...g(400, 13, 0, C.text50), textAlign: "center", paddingHorizontal: 20 },
  status: { ...c(700, 10, 3, C.copper90), textAlign: "center", paddingHorizontal: 20 },
  shutterWrap: { alignItems: "center" },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: C.text60, alignItems: "center", justifyContent: "center" },
  shutterDot: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.copper },
  thumb: { width: 40, height: 52, borderWidth: 1, borderColor: C.copper50, backgroundColor: C.copper12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbText: { ...c(700, 8, 0, C.text60), textAlign: "center", lineHeight: 11 },
});
