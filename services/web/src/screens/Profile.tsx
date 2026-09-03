import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Profile as ProfileData, ProfileBean, ProfileRoaster } from "../api/types";
import { Rule } from "../components/Chrome";
import { describePreference, fmtTime, METHOD_LABEL, num, paramsFor, stars, val } from "../lib/format";
import { useStore } from "../state/store";

type State = { kind: "loading" } | { kind: "error"; msg: string } | { kind: "ready"; data: ProfileData };

export const Profile = () => {
  const s = useStore();
  const [state, setState] = useState<State>({ kind: "loading" });
  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", data: await api.profile() });
    } catch (e) {
      setState({ kind: "error", msg: e instanceof ApiError ? e.message : "The brew log could not be reached." });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="screen">
      <div className="nav">
        <div className="title">PROFILE</div>
        <div style={{ flex: 1 }} />
        <button className="link" onClick={s.openGuide}>GUIDE</button>
      </div>
      {state.kind === "loading" && <div className="empty" style={{ padding: "40px 22px", textAlign: "center" }}>Reading the log…</div>}
      {state.kind === "error" && (
        <div className="empty" style={{ padding: "40px 22px", textAlign: "center" }}>
          <div>{state.msg}</div>
          <button className="act" style={{ marginTop: 14 }} onClick={() => void load()}>TRY AGAIN →</button>
        </div>
      )}
      {state.kind === "ready" && <Body p={state.data} />}
    </div>
  );
};

const Body = ({ p }: { p: ProfileData }) => {
  const s = useStore();
  const who = p.displayName ?? p.email.split("@")[0];
  const c = p.counts;
  const tagged = p.flavours.leaves.reduce((n, l) => n + l.likes + l.dislikes, 0);
  return (
    <div className="profile-body">
      <div className="plaque">
        <div className="name">{who}</div>
        <div className="sub">{p.email}</div>
        <div className="chips">
          <div className="tag-solid">{c.brews} {c.brews === 1 ? "BREW" : "BREWS"}</div>
          <div className="tag-solid">{c.bags} {c.bags === 1 ? "BAG" : "BAGS"}</div>
          <div className="tag-solid">{c.flavours} {c.flavours === 1 ? "FLAVOUR" : "FLAVOURS"}</div>
          <div className="tag-solid">{c.daysLogging} {c.daysLogging === 1 ? "DAY" : "DAYS"} LOGGED</div>
        </div>
      </div>

      {c.brews === 0 ? (
        <div className="empty" style={{ padding: "30px 0 10px", textAlign: "center" }}>
          No brews yet. Brew, rate and tag — the profile writes itself.
        </div>
      ) : (
        <>
          <Rule label="YOUR PALATE" right={`${tagged} TAGGED`} />
          <Palate p={p} />

          <Rule label="HOW YOU BREW" right={p.preferences.likedBrews ? `${p.preferences.likedBrews} ${p.preferences.likedBrews === 1 ? "BREW" : "BREWS"} ★4+` : `${c.brews} ${c.brews === 1 ? "BREW" : "BREWS"}`} />
          <Preferences p={p} />

          <Rule label="TOP BAGS" right={`${c.bags} ${c.bags === 1 ? "BAG" : "BAGS"}`} />
          {p.topBeans.length === 0 && <div className="empty" style={{ padding: "14px 0" }}>Rate a brew and the bag ranks itself here.</div>}
          {p.topBeans.map((b) => <BeanRow key={b.beanId} b={b} onOpen={() => { s.selectBean(b.beanId); s.setScreen("bean"); }} />)}

          <Rule label="ROASTERS" right={`${p.roasters.length}`} />
          {p.roasters.length === 0 && <div className="empty" style={{ padding: "14px 0" }}>No roaster on any bag yet.</div>}
          {p.roasters.map((r) => <RoasterRow key={r.roaster} r={r} />)}
        </>
      )}

      <button className="rule" style={{ margin: "22px 0 0", width: "100%", minHeight: 44 }} onClick={() => s.setScreen("passport")}>
        <span>FLAVOUR PASSPORT</span><div className="line" /><span>STAMPS →</span>
      </button>

      {s.hasFriends && (
        <>
          <div style={{ marginTop: 22 }}><Rule label="SHARING" /></div>
          <button className="setting" onClick={() => void s.setSharing(!s.me?.shareRatedByDefault)} aria-pressed={s.me?.shareRatedByDefault ?? true}>
            <div className="body">
              <div className="name">Share brews I rate</div>
              <div className="sub">Rating one publishes it to your friends. Any brew can still be made private on its own.</div>
            </div>
            <div className={"switch" + (s.me?.shareRatedByDefault ? " on" : "")}><div /></div>
          </button>
        </>
      )}

      <div className="signout">
        <a className="act" href={api.signOutUrl}>SIGN OUT →</a>
      </div>
    </div>
  );
};

const Palate = ({ p }: { p: ProfileData }) => {
  const cats = p.flavours.categories;
  const max = Math.max(1, ...cats.map((x) => x.likes + x.dislikes));
  const pct = (n: number) => `${(n / max) * 100}%`;
  if (p.flavours.leaves.length === 0) return <div className="empty" style={{ padding: "14px 0" }}>No flavours tagged yet — open the wheel after a brew.</div>;
  return (
    <>
      <div className="palate">
        {cats.map((x) => (
          <div key={x.category} className={"palate-row" + (x.likes + x.dislikes ? "" : " quiet")}>
            <span className="k">{x.category}</span>
            <div className="bar">
              {x.likes > 0 && <div className="pos" style={{ width: pct(x.likes) }} />}
              {x.dislikes > 0 && <div className="neg" style={{ width: pct(x.dislikes) }} />}
            </div>
            <span className="n">
              {x.likes + x.dislikes === 0 ? "—" : (
                <>
                  {x.likes > 0 && <span>+{x.likes}</span>}
                  {x.dislikes > 0 && <span className="neg">−{x.dislikes}</span>}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="chips" style={{ marginTop: 14 }}>
        {p.flavours.topLiked.map((f) => <div key={f.flavour} className="chip">{f.flavour} <span>×{f.likes}</span></div>)}
        {p.flavours.topDisliked.map((f) => <div key={"n" + f.flavour} className="chip neg">− {f.flavour} <span>×{f.dislikes}</span></div>)}
      </div>
    </>
  );
};

const Preferences = ({ p }: { p: ProfileData }) => {
  const { preferred, overall, typicalDurationMs, defects } = p.preferences;
  if (!overall) return null;
  const shown = preferred ?? overall;
  return (
    <div style={{ marginTop: 4 }}>
      {!preferred && <div className="hint" style={{ textAlign: "left", padding: "10px 0 2px" }}>Rate a brew ★4 or better and your preferred ticket appears here. Until then, your medians.</div>}
      <div className="pref-row"><span className="k">METHOD</span><span className="d">{METHOD_LABEL[overall.method]}</span><span className="v">brewed most</span></div>
      {paramsFor(overall.method).map((cfg) => {
        const v = val(shown, cfg.key);
        const b = val(overall, cfg.key);
        const delta = preferred ? describePreference(cfg.key, v, b) : "";
        return (
          <div key={cfg.key} className="pref-row">
            <span className="k">{cfg.label}</span>
            <span className={"d" + (delta === "SAME" ? " same" : "")}>{delta || cfg.fmt(v)}</span>
            <span className="v">{preferred ? `${cfg.fmt(v)}${cfg.cellUnit} · usually ${cfg.fmt(b)}${cfg.cellUnit}` : cfg.unit}</span>
          </div>
        );
      })}
      <div className="pref-row">
        <span className="k">TIME</span>
        <span className="d">{typicalDurationMs === null ? "—" : fmtTime(typicalDurationMs)}</span>
        <span className="v">typical brew</span>
      </div>
      <div className="pref-row" style={{ alignItems: "center" }}>
        <span className="k">DEFECTS</span>
        <div className="defects" style={{ marginTop: 0, flex: 1 }}>
          {defects.length === 0 && <span className="v">none marked</span>}
          {defects.map((d) => <div key={d.defect} className="defect on">{d.defect} ×{d.count}</div>)}
        </div>
      </div>
    </div>
  );
};

const Score = ({ avg }: { avg: number | null }) => (
  <div className={"score" + (avg === null ? " none" : "")}>
    <span className="stars">{avg === null ? "●" : stars(Math.round(avg))}</span>
    <div className="avg">{avg === null ? "UNRATED" : num(avg, 1)}</div>
  </div>
);

const BeanRow = ({ b, onOpen }: { b: ProfileBean; onOpen: () => void }) => (
  <button className="rank-row" onClick={onOpen}>
    <div className="body">
      <div className="name">{b.name}</div>
      <div className="sub">{[b.roaster, `${b.brews} ${b.brews === 1 ? "brew" : "brews"}`, b.archived ? "archived" : null].filter(Boolean).join(" · ")}</div>
    </div>
    <Score avg={b.avgRating} />
  </button>
);

const RoasterRow = ({ r }: { r: ProfileRoaster }) => (
  <div className="rank-row">
    <div className="body">
      <div className="name">{r.roaster}</div>
      <div className="sub">{[`${r.bags} ${r.bags === 1 ? "bag" : "bags"}`, `${r.brews} ${r.brews === 1 ? "brew" : "brews"}`, ...r.topFlavours].join(" · ")}</div>
    </div>
    <Score avg={r.avgRating} />
  </div>
);
