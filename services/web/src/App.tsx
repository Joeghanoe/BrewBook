import { Toast } from "./components/Chrome";
import { useIsDesktop } from "./hooks/useIsPhone";
import { TabBar } from "./components/TabBar";
import { BeanDetail } from "./screens/BeanDetail";
import { BeanEdit } from "./screens/BeanEdit";
import { BrewEdit } from "./screens/BrewEdit";
import { DesktopDoor } from "./screens/DesktopDoor";
import { Guide } from "./screens/Guide";
import { Friends } from "./screens/Friends";
import { Home } from "./screens/Home";
import { Library } from "./screens/Library";
import { Passport } from "./screens/Passport";
import { Profile } from "./screens/Profile";
import { Roasters } from "./screens/Roasters";
import { Scan } from "./screens/Scan";
import { ScanForm } from "./screens/ScanForm";
import { Splash } from "./screens/Splash";
import { Timer } from "./screens/Timer";
import { WheelLayer } from "./screens/Wheel";
import { useStore, type Screen } from "./state/store";

/** The bar is hidden only where the screen is a single task the user is inside of. */
const BAR_SCREENS: Screen[] = ["home", "library", "roasters", "friends", "profile", "bean", "passport"];

const showBar = (screen: Screen, wheelOpen: boolean) => BAR_SCREENS.includes(screen) && !wheelOpen;

export const App = () => {
  const s = useStore();
  const desktop = useIsDesktop();
  if (desktop) return <DesktopDoor />;
  return (
    <div className="canvas">
      <div className={"shell" + (showBar(s.screen, s.wheelOpen) ? " has-bar" : "")}>
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
            {s.screen === "beanedit" && <BeanEdit />}
            {s.screen === "brewedit" && <BrewEdit />}
            {s.screen === "library" && <Library />}
            {s.screen === "roasters" && <Roasters />}
            {s.screen === "scan" && <Scan />}
            {s.screen === "scanform" && <ScanForm />}
            {s.screen === "passport" && <Passport />}
            {s.screen === "profile" && <Profile />}
            {s.screen === "friends" && s.hasFriends && <Friends />}
            {showBar(s.screen, s.wheelOpen) && <TabBar />}
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
