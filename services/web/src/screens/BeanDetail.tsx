import { useState } from "react";
import { Rule } from "../components/Chrome";
import { RoasterPicker } from "../components/RoasterPicker";
import { daysOffRoast, describeDelta, describeFull, fmtTime, stars, whenLabel } from "../lib/format";
import { useStore } from "../state/store";

export const BeanDetail = () => {
  const s = useStore();
  const bean = s.currentBean;
  const [open, setOpen] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  if (!bean) { s.setScreen("library"); return null; }
  const hist = s.brewsFor(bean.id); // newest first
  const days = daysOffRoast(bean.roastDate);
  const originLine = [bean.origin, bean.process].filter(Boolean).join(" · ");
  const openMap = () => { s.setRoasterFocus(bean.roasterId); s.setScreen("roasters"); };

  return (
    <div className="screen">
      <div className="nav">
        <button className="sqbtn" onClick={() => s.setScreen("library")} aria-label="Back to the library">←</button>
        <div className="title">BEAN</div>
        <div style={{ flex: 1 }} />
        <button className="link" onClick={() => { s.selectBean(bean.id); s.setScreen("home"); }}>BREW THIS →</button>
      </div>
      <div className="plaque">
        <div className="name">{bean.name}</div>
        <div className="sub">
          {bean.roaster && bean.roasterId
            ? bean.roasterLocated
              ? <button className="roaster-link" onClick={openMap}>{bean.roaster} ↗</button>
              : <>{bean.roaster} <button className="roaster-link" onClick={() => setFinding(true)}>FIND IT →</button></>
            : bean.roaster}
          {bean.roaster && originLine ? " — " : ""}
          {originLine}
          {!bean.roaster && !originLine && "no roaster or origin on record"}
        </div>
        <div className="chips">
          <div className="tag-solid">{days === null ? "ROAST DATE UNSET" : `${days} DAYS OFF ROAST`}</div>
          {bean.declaredNotes.map((n) => <div key={n} className="tag-dash">{n}</div>)}
        </div>
      </div>
      <div style={{ margin: "20px 22px 4px" }}><Rule label="DIAL-IN LOG" right={`${hist.length} BREWS`} /></div>
      <div className="log">
        {hist.length === 0 && <div className="empty">No brews yet — the first brew starts from the method's defaults.</div>}
        {hist.map((h, i) => {
          const prev = hist[i + 1] ?? null;
          const isOpen = open === h.id;
          return (
            <div key={h.id} className="log-row">
              <button className="log-line" style={{ width: "100%" }} onClick={() => setOpen(isOpen ? null : h.id)}>
                <span className="when">{whenLabel(h.brewedAt)}</span>
                <span className="delta">{describeDelta(h.params, prev?.params ?? null)}</span>
                <span className="dur">{fmtTime(h.durationMs)}</span>
                <span className={"stars" + (h.rating ? "" : " none")}>{stars(h.rating)}</span>
              </button>
              {isOpen && (
                <div className="log-open">
                  <div className="full">{describeFull(h.params, h.durationMs)}</div>
                  {(h.flavourTags.length > 0 || h.defects.length > 0) && (
                    <div className="full" style={{ marginTop: 6, color: "rgba(216,168,111,.85)" }}>
                      {h.flavourTags.map((t) => (t.polarity < 0 ? "− " : "") + t.flavour).concat(h.defects.map((d) => `defect: ${d.toLowerCase()}`)).join(" · ")}
                    </div>
                  )}
                  <div className="acts">
                    <button className="act" onClick={() => { s.loadParams(h.params); s.setScreen("home"); s.showToast("Loaded onto the brew ticket"); }}>BREW THIS AGAIN →</button>
                    <button className="act" onClick={() => s.openWheel(h)}>TAG FLAVOURS →</button>
                    {s.hasFriends && h.rating > 0 && (
                      <button className={"act" + (h.isPrivate ? " quiet" : " on")} onClick={() => void s.setBrewPrivacy(h.id, !h.isPrivate)}>
                        {h.isPrivate ? "PRIVATE" : "SHARED WITH FRIENDS"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div style={{ padding: "18px 0 10px" }}>
          <button className="act" style={{ borderColor: "rgba(194,144,94,.35)", color: "rgba(233,214,174,.55)" }}
            onClick={() => { void s.archiveBean(bean.id, !bean.archived); s.showToast(bean.archived ? `${bean.name} back in open bags` : `${bean.name} archived`); if (!bean.archived) s.setScreen("library"); }}>
            {bean.archived ? "REOPEN BAG" : "ARCHIVE BAG"}
          </button>
        </div>
      </div>
      {finding && bean.roasterId && (
        <RoasterPicker roasterId={bean.roasterId} name={bean.roaster ?? ""}
          onPlaced={(r) => { s.patchBean({ ...bean, roasterLocated: r.located, roasterResolved: true }); setFinding(false); }}
          onClose={() => setFinding(false)} />
      )}
    </div>
  );
};
