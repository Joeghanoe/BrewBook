import { useEffect } from "react";
import { Seal } from "../components/Icons";
import { useStore } from "../state/store";

const AUTO_ADVANCE_MS = 3200;

export const Splash = () => {
  const { setScreen } = useStore();
  useEffect(() => {
    const id = window.setTimeout(() => setScreen("home"), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [setScreen]);
  return (
    <div className="screen splash" onClick={() => setScreen("home")}>
      <Seal />
      <div className="wordmark">BREWBOOK</div>
      <div className="tagline"><span style={{ fontSize: 8 }}>✦</span> A PERSONAL BREW LOG <span style={{ fontSize: 8 }}>✦</span></div>
      <div className="enter">TAP TO ENTER</div>
    </div>
  );
};
