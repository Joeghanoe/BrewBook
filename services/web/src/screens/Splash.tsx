import { useEffect } from "react";
import { Seal } from "../components/Icons";
import { useStore } from "../state/store";

const AUTO_ADVANCE_MS = 3200;

export const Splash = () => {
  const { setScreen, invite } = useStore();
  // Following an invitation link opens on the invitation itself (§5).
  const landing = invite ? "friends" : "home";
  useEffect(() => {
    const id = window.setTimeout(() => setScreen(landing), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [setScreen, landing]);
  return (
    <div className="screen splash" onClick={() => setScreen(landing)}>
      <Seal />
      <div className="wordmark">BREWBOOK</div>
      <div className="tagline"><span style={{ fontSize: 8 }}>✦</span> A PERSONAL BREW LOG <span style={{ fontSize: 8 }}>✦</span></div>
      <div className="enter">TAP TO ENTER</div>
    </div>
  );
};
