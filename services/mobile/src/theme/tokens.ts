// Brewbook — "secret coffee society". Tokens from the design handoff, mirrored from
// services/web/src/styles.css. Change both in the same commit.
export const C = {
  inkCanvas: "#141318",
  bg: "#1c1a21",
  panel: "#26242e",
  scanBg: "#111015",
  text: "#e9d6ae",
  copper: "#c2905e",
  copperLight: "#d8a86f",
  cream: "#e6d3ab",
  ink: "#26242e",
  rust: "#a1553f",
  rustLight: "#d89680",
  green: "#8fae7e",
  copper90: "rgba(194, 144, 94, 0.9)",
  copper70: "rgba(194, 144, 94, 0.7)",
  copper60: "rgba(194, 144, 94, 0.6)",
  copper55: "rgba(194, 144, 94, 0.55)",
  copper50: "rgba(194, 144, 94, 0.5)",
  copper45: "rgba(194, 144, 94, 0.45)",
  copper35: "rgba(194, 144, 94, 0.35)",
  copper30: "rgba(194, 144, 94, 0.3)",
  copper20: "rgba(194, 144, 94, 0.2)",
  copper18: "rgba(194, 144, 94, 0.18)",
  copper16: "rgba(194, 144, 94, 0.16)",
  copper15: "rgba(194, 144, 94, 0.15)",
  copper14: "rgba(194, 144, 94, 0.14)",
  copper12: "rgba(194, 144, 94, 0.12)",
  copper10: "rgba(194, 144, 94, 0.1)",
  copper08: "rgba(194, 144, 94, 0.08)",
  copper07: "rgba(194, 144, 94, 0.07)",
  copper06: "rgba(194, 144, 94, 0.06)",
  copper05: "rgba(194, 144, 94, 0.05)",
  text85: "rgba(233, 214, 174, 0.85)",
  text75: "rgba(233, 214, 174, 0.75)",
  text70: "rgba(233, 214, 174, 0.7)",
  text65: "rgba(233, 214, 174, 0.65)",
  text60: "rgba(233, 214, 174, 0.6)",
  text55: "rgba(233, 214, 174, 0.55)",
  text50: "rgba(233, 214, 174, 0.5)",
  text45: "rgba(233, 214, 174, 0.45)",
  text40: "rgba(233, 214, 174, 0.4)",
  text35: "rgba(233, 214, 174, 0.35)",
  text30: "rgba(233, 214, 174, 0.3)",
  text25: "rgba(233, 214, 174, 0.25)",
  ink75: "rgba(38, 36, 46, 0.75)",
  ink65: "rgba(38, 36, 46, 0.65)",
  ink60: "rgba(38, 36, 46, 0.6)",
  ink45: "rgba(38, 36, 46, 0.45)",
  ink40: "rgba(38, 36, 46, 0.4)",
  rust18: "rgba(161, 85, 63, 0.18)",
  rust22: "rgba(161, 85, 63, 0.22)",
  rust70: "rgba(161, 85, 63, 0.7)",
  rust90: "rgba(161, 85, 63, 0.9)",
  rust95: "rgba(161, 85, 63, 0.95)",
  backdrop: "rgba(10, 9, 12, 0.6)",
  layerBackdrop: "rgba(10, 9, 12, 0.55)",
  tabbar: "rgba(28, 26, 33, 0.96)",
  copperLight80: "rgba(216, 168, 111, 0.8)",
  copperLight85: "rgba(216, 168, 111, 0.85)",
} as const;

export const TABBAR_H = 62;

/** Font files are picked by weight here; React Native does not synthesise weights from one family. */
export const grotesk = (w: 400 | 500 | 600 | 700 = 400) =>
  w === 700 ? "SpaceGrotesk_700Bold" : w === 600 ? "SpaceGrotesk_600SemiBold" : w === 500 ? "SpaceGrotesk_500Medium" : "SpaceGrotesk_400Regular";
export const courier = (w: 400 | 700 = 400) => (w === 700 ? "CourierPrime_700Bold" : "CourierPrime_400Regular");

export const shadowCard = { shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 12 } as const;
export const shadowSheet = { shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: -18 }, elevation: 16 } as const;
