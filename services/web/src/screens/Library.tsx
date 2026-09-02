import { useState } from "react";
import { HomeBar, Rule, StatusBar } from "../components/Chrome";
import { CameraIcon } from "../components/Icons";
import { daysOffRoast } from "../lib/format";
import { useStore } from "../state/store";

export const Library = () => {
  const s = useStore();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const openBean = (id: string) => { s.selectBean(id); s.setScreen("bean"); };
  return (
    <div className="screen">
      <StatusBar />
      <div className="nav">
        <button className="sqbtn" onClick={() => s.setScreen("home")} aria-label="Back">←</button>
        <div className="title">BEAN LIBRARY</div>
        <div style={{ flex: 1 }} />
        <button className="link" style={{ minHeight: 44 }} onClick={s.openGuide}>GUIDE</button>
        <button className="link" style={{ minHeight: 44 }} onClick={() => s.setScreen("passport")}>PASSPORT →</button>
      </div>
      <div style={{ overflow: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ margin: "18px 22px 0" }}><Rule label="OPEN BAGS" /></div>
        <div style={{ padding: "12px 22px 0", display: "flex", flexDirection: "column", gap: 12 }}>
          {s.beansOpen.length === 0 && <div className="empty" style={{ padding: "14px 0" }}>No open bags — scan a label to add the first one.</div>}
          {s.beansOpen.map((b) => {
            const d = daysOffRoast(b.roastDate);
            return (
              <button key={b.id} className="bag" onClick={() => openBean(b.id)}>
                <div className="top"><span className="name">{b.name}</span><span className="days">{d === null ? "— D" : `${d} D`}</span></div>
                <div className="sub">{[b.roaster, [b.origin, b.process].filter(Boolean).join(" · ")].filter(Boolean).join(" · ") || "no details on record"}</div>
                {b.declaredNotes.length > 0 && <div className="notes">{b.declaredNotes.join(" · ")}</div>}
              </button>
            );
          })}
        </div>
        <button className="rule" style={{ margin: "22px 22px 0", color: "rgba(233,214,174,.55)", width: "calc(100% - 44px)" }} onClick={() => setArchiveOpen((o) => !o)}>
          <span>ARCHIVE</span><div className="line" style={{ background: "rgba(194,144,94,.2)" }} /><span>{archiveOpen ? "⌃" : "⌄"}</span>
        </button>
        {archiveOpen && (
          <div style={{ padding: "10px 22px 0", display: "flex", flexDirection: "column", gap: 1 }}>
            {s.beansArchived.length === 0 && <div className="empty" style={{ padding: "12px 4px" }}>Nothing archived.</div>}
            {s.beansArchived.map((b) => (
              <button key={b.id} className="archive-row" onClick={() => openBean(b.id)}>
                <span>{b.name}{b.roaster ? ` — ${b.roaster}` : ""}</span><span>{b.brewCount} BREWS</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 20 }} />
      </div>
      <div style={{ padding: "0 22px 14px" }}>
        <button className="scan-cta" onClick={() => s.setScreen("scan")}><CameraIcon /> ADD A BAG — SCAN LABEL</button>
      </div>
      <HomeBar />
    </div>
  );
};
