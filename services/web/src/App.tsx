import { Toast } from "./components/Chrome";
import { BeanDetail } from "./screens/BeanDetail";
import { Guide } from "./screens/Guide";
import { Home } from "./screens/Home";
import { Library } from "./screens/Library";
import { Passport } from "./screens/Passport";
import { Profile } from "./screens/Profile";
import { Scan } from "./screens/Scan";
import { ScanForm } from "./screens/ScanForm";
import { Splash } from "./screens/Splash";
import { Timer } from "./screens/Timer";
import { WheelLayer } from "./screens/Wheel";
import { useStore } from "./state/store";

export const App = () => {
  const s = useStore();
  return (
    <div className="canvas">
      <div className="shell">
        <div className="grain" />
        {s.screen === "splash" && <Splash />}
        {s.screen !== "splash" && s.loading && <Notice title="OPENING THE LOG" sub="fetching your bags and brews" />}
        {s.screen !== "splash" && !s.loading && s.error && (
          <Notice title="LOG UNAVAILABLE" sub={s.error}>
            <button className="act" onClick={() => void s.refresh()}>TRY AGAIN →</button>
          </Notice>
        )}
        {s.screen !== "splash" && !s.loading && !s.error && (
          <>
            {s.screen === "home" && <Home />}
            {s.screen === "timer" && <Timer />}
            {s.screen === "bean" && <BeanDetail />}
            {s.screen === "library" && <Library />}
            {s.screen === "scan" && <Scan />}
            {s.screen === "scanform" && <ScanForm />}
            {s.screen === "passport" && <Passport />}

            {s.screen === "profile" && <Profile />}
            {s.wheelOpen && <WheelLayer />}
            {s.guideOpen && <Guide />}
          </>
        )}
        <Toast />
      </div>
    </div>
  );
};

const Notice = ({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) => (
  <div className="notice"><div className="t">{title}</div><div className="s">{sub}</div>{children}</div>
);
