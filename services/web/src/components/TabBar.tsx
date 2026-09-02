import type { ReactNode } from "react";
import { useStore, type Screen } from "../state/store";
import { FriendsIcon, LibraryIcon, MapIcon, ProfileIcon, TicketIcon } from "./Icons";

/**
 * The only way around the app (§3). It carries destinations, not actions: scan, bean detail,
 * the wheel and the passport are reached from the place they belong to, never from here.
 * Sub-screens (`bean`, `passport`, `scan`, `scanform`) light the tab they hang off.
 */
const TABS: { screen: Screen; label: string; under: Screen[]; icon: ReactNode }[] = [
  { screen: "home", label: "HOME", under: [], icon: <TicketIcon /> },
  { screen: "library", label: "LIBRARY", under: ["bean", "scan", "scanform"], icon: <LibraryIcon /> },
  { screen: "roasters", label: "MAP", under: [], icon: <MapIcon /> },
  { screen: "friends", label: "FRIENDS", under: [], icon: <FriendsIcon /> },
  { screen: "profile", label: "PROFILE", under: ["passport"], icon: <ProfileIcon /> },
];

export const TabBar = () => {
  const s = useStore();
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const on = s.screen === t.screen || t.under.includes(s.screen);
        return (
          <button key={t.screen} className={"tab" + (on ? " on" : "")} aria-current={on ? "page" : undefined}
            onClick={() => { s.setSheet(null); s.setScreen(t.screen); }}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
