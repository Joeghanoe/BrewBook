import type { TextStyle } from "react-native";
import { C, courier, grotesk } from "./tokens";

/** `font: 700 10px courier; letter-spacing: 3px` → one TextStyle. */
export const g = (weight: 400 | 500 | 600 | 700, size: number, letterSpacing = 0, color: string = C.text): TextStyle =>
  ({ fontFamily: grotesk(weight), fontSize: size, letterSpacing, color });
export const c = (weight: 400 | 700, size: number, letterSpacing = 0, color: string = C.text): TextStyle =>
  ({ fontFamily: courier(weight), fontSize: size, letterSpacing, color });
export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };
