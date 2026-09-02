import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { Seal } from "../components/Icons";

/**
 * The desktop gets a door, not a room (§9). Brewbook is used standing at a counter with wet
 * hands; the desktop is a different problem and not one worth solving yet. So: what this is,
 * and where to get it. No log, no ticket, no framed phone pretending to be an app.
 */
export const DesktopDoor = () => {
  const url = window.location.origin + "/";
  const path = useMemo(() => qrPath(url), [url]);

  return (
    <div className="door">
      <div className="mark"><Seal /></div>
      <div className="wordmark">BREWBOOK</div>
      <div className="tagline"><span style={{ fontSize: 8 }}>✦</span> A PERSONAL BREW LOG <span style={{ fontSize: 8 }}>✦</span></div>

      <p className="blurb">
        One bag of coffee at a time, one brew ticket per bag. Adjust the grind, time the pour, rate what
        came out — and see what you changed since last time.
      </p>

      <div className="qr">
        <svg viewBox="0 0 100 100" width="180" height="180" role="img" aria-label={`QR code for ${url}`}>
          <rect width="100" height="100" fill="#e6d3ab" />
          <path d={path} fill="#1c1a21" />
        </svg>
      </div>

      <a className="door-link" href={url}>{url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>
      <div className="door-note">Open it on your phone. It installs to the home screen and opens like an app.</div>
    </div>
  );
};

/** The QR as one SVG path, scaled into a 100×100 box with a quiet zone the spec asks for. */
function qrPath(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const size = 100 / (count + quiet * 2);
  let d = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      const x = (col + quiet) * size;
      const y = (row + quiet) * size;
      d += `M${x.toFixed(2)} ${y.toFixed(2)}h${size.toFixed(2)}v${size.toFixed(2)}h-${size.toFixed(2)}z`;
    }
  }
  return d;
}
