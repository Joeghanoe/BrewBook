import { useEffect, useState } from "react";

/**
 * Brewbook is a phone app (§9). A wide window driven by a mouse gets the door instead; a narrow
 * one still gets the app, so a desktop browser can be resized to work on it.
 */
const DESKTOP = "(min-width: 900px) and (pointer: fine)";

export const useIsDesktop = (): boolean => {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
};
