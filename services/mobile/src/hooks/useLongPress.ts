export const LONG_PRESS_MS = 500;

/** Pressable props that call `onShort` on a tap and `onLong` when held ≥ threshold. */
export function useLongPress(onShort: () => void, onLong: () => void, thresholdMs = LONG_PRESS_MS) {
  return { onPress: onShort, onLongPress: onLong, delayLongPress: thresholdMs };
}
