export const EyeGlyph = ({ onClick }: { onClick?: () => void }) => (
  <button onClick={onClick} aria-label="Bean detail" style={{ padding: 4 }}>
    <svg width="44" height="34" viewBox="0 0 64 44" fill="none" stroke="#c2905e" strokeWidth="2">
      <path d="M4 22 Q32 -4 60 22 Q32 48 4 22 Z" />
      <ellipse cx="32" cy="22" rx="9" ry="10" />
      <path d="M32 13 q5 9 0 18" />
    </svg>
  </button>
);

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
