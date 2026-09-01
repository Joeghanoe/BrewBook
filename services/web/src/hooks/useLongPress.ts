import { useRef } from "react";

export const LONG_PRESS_MS = 500;

/** Pointer handlers that call `onShort` on a tap and `onLong` when held ≥ threshold. */
export function useLongPress(onShort: () => void, onLong: () => void, thresholdMs = LONG_PRESS_MS) {
  const down = useRef(0);
  const active = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); down.current = Date.now(); active.current = true; },
    onPointerUp: () => {
      if (!active.current) return;
      active.current = false;
      if (Date.now() - down.current >= thresholdMs) onLong(); else onShort();
    },
    onPointerCancel: () => { active.current = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
