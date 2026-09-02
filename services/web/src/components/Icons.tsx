import { useEffect, useState } from "react";

const IDLE_MIN_MS = 55_000, IDLE_SPREAD_MS = 70_000;
const TWITCHES = ["blink", "slowblink", "aside", "invert", "double"] as const;

/**
 * The eye is decoration with a job (§10): it is also the way into the current bag. It twitches
 * only when nothing else is happening — never during a brew, a sheet or a rating — a minute or
 * two apart, under a second, and not at all when the system asks for reduced motion.
 */
export const EyeGlyph = ({ onClick, idle = false }: { onClick?: () => void; idle?: boolean }) => {
  const [twitch, setTwitch] = useState<string | null>(null);
  useEffect(() => {
    if (!idle) { setTwitch(null); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let clear = 0;
    const schedule = (): number => window.setTimeout(() => {
      setTwitch(TWITCHES[Math.floor(Math.random() * TWITCHES.length)]);
      clear = window.setTimeout(() => setTwitch(null), 900);
      next = schedule();
    }, IDLE_MIN_MS + Math.random() * IDLE_SPREAD_MS);
    let next = schedule();
    return () => { window.clearTimeout(next); window.clearTimeout(clear); };
  }, [idle]);
  return (
    <button onClick={onClick} aria-label="Bean detail" style={{ padding: 4 }}>
      <svg className={"eye" + (twitch ? " eye-" + twitch : "")} width="44" height="34" viewBox="0 0 64 44" fill="none" stroke="#c2905e" strokeWidth="2">
        <path d="M4 22 Q32 -4 60 22 Q32 48 4 22 Z" />
        <g className="iris">
          <ellipse cx="32" cy="22" rx="9" ry="10" />
          <path d="M32 13 q5 9 0 18" />
        </g>
      </svg>
    </button>
  );
};

export const WheelIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d8a86f" strokeWidth="1.4">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3.2" />
    <line x1="12" y1="2" x2="12" y2="8.8" /><line x1="12" y1="15.2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="8.8" y2="12" /><line x1="15.2" y1="12" x2="22" y2="12" />
    <line x1="5" y1="5" x2="9.6" y2="9.6" /><line x1="14.4" y1="14.4" x2="19" y2="19" />
    <line x1="19" y1="5" x2="14.4" y2="9.6" /><line x1="9.6" y1="14.4" x2="5" y2="19" />
  </svg>
);

export const MicIcon = ({ stroke = "#d8a86f", size = 14, stand = true }: { stroke?: string; size?: number; stand?: boolean }) => (
  <svg width={size} height={Math.round(size * 19 / 14)} viewBox="0 0 18 24" fill="none" stroke={stroke} strokeWidth={stand ? 1.8 : 2}>
    <rect x="5.5" y="1" width="7" height="13" rx="3.5" /><path d="M2 11 a7 7 0 0 0 14 0" /><line x1="9" y1="18" x2="9" y2="22" />
    {stand && <line x1="5" y1="22" x2="13" y2="22" />}
  </svg>
);

export const CameraIcon = () => (
  <svg width="20" height="16" viewBox="0 0 24 20" fill="none" stroke="#d8a86f" strokeWidth="1.6">
    <rect x="1" y="4" width="22" height="15" rx="2" /><circle cx="12" cy="11.5" r="4.5" /><path d="M8 4 L9.5 1 h5 L16 4" />
  </svg>
);

export const Seal = () => (
  <svg width="230" height="220" viewBox="0 0 200 190" fill="none">
    <path d="M100 12 L188 168 L12 168 Z" stroke="#c2905e" strokeWidth="2" />
    <path d="M100 30 L173 160 L27 160 Z" stroke="rgba(194,144,94,.4)" strokeWidth="1" />
    <g style={{ animation: "bb-spin 26s linear infinite", transformOrigin: "100px 122px" }}>
      <circle cx="100" cy="122" r="36" stroke="rgba(216,168,111,.7)" strokeWidth="1.6" strokeDasharray="3 8" />
    </g>
    <g style={{ animation: "bb-blink 4.2s ease-in-out infinite", transformOrigin: "100px 122px" }}>
      <path d="M48 122 Q100 78 152 122 Q100 166 48 122 Z" stroke="#d8a86f" strokeWidth="2.4" fill="#1c1a21" />
      <ellipse cx="100" cy="122" rx="19" ry="21" stroke="#d8a86f" strokeWidth="2.2" fill="rgba(194,144,94,.14)" />
      <path d="M100 104 q7 18 0 36" stroke="#d8a86f" strokeWidth="2" />
    </g>
  </svg>
);

export const ScanEye = () => (
  <svg width="70" height="54" viewBox="0 0 72 52" fill="none" stroke="#d8a86f" strokeWidth="2">
    <path d="M8 26 Q36 -2 64 26 Q36 54 8 26 Z" />
    <g style={{ animation: "bb-spin 1.4s linear infinite", transformOrigin: "36px 26px" }}><circle cx="36" cy="26" r="14" strokeDasharray="4 7" /></g>
  </svg>
);

export const TicketIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 6h20v4a2 2 0 0 0 0 4v4H2v-4a2 2 0 0 0 0-4V6Z" />
    <line x1="12" y1="8" x2="12" y2="10" /><line x1="12" y1="14" x2="12" y2="16" />
  </svg>
);

export const LibraryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="5" height="18" /><rect x="10" y="3" width="5" height="18" />
    <path d="M17.5 4.2 21.5 5.3 18.8 21.3 15 20.2Z" />
  </svg>
);

export const MapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" /><circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </svg>
);

export const FriendsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="9" cy="8" r="3.4" /><path d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8" />
    <path d="M16 5.2a3.4 3.4 0 0 1 0 6.4M17.5 14.6c2.4.5 4 2.5 4 5.4" />
  </svg>
);
