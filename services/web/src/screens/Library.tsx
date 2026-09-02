import { useState } from "react";
import type { Bean } from "../api/types";
import { Rule } from "../components/Chrome";
import { CameraIcon } from "../components/Icons";
import { brewsLeftLabel, daysOffRoast } from "../lib/format";
import { useStore } from "../state/store";

/**
 * Asked once, then never again for that bag. Archiving is always the user's word: never automatic,
 * never nagged (§7).
 */
const ArchivePrompt = ({ bean }: { bean: Bean }) => {
  const s = useStore();
  const empty = bean.brewsLeft === 0;
  return (
    <div className="ask">
      <div className="t">{bean.name}</div>
      <div className="s">{empty ? "That is the last of this bag by the numbers." : "This bag is a year past its roast date."} Finished with it?</div>
      <div className="acts">
        <button className="act" onClick={() => { void s.archiveBean(bean.id, true); s.showToast(`${bean.name} archived — its brews stay in the log`); }}>ARCHIVE IT</button>
        <button className="act quiet" onClick={() => void s.keepBean(bean.id)}>LEAVE IT OPEN</button>
      </div>
    </div>
  );
};

export const Library = () => {
  const s = useStore();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const openBean = (id: string) => { s.selectBean(id); s.setScreen("bean"); };
  return (
    <div className="screen">
      <div className="nav">
        <div className="title">BEAN LIBRARY</div>
        <div style={{ flex: 1 }} />
        <span className="link" style={{ color: "var(--text-50)" }}>{s.beansOpen.length} OPEN</span>
      </div>
      <div style={{ overflow: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
        {s.beansOpen.filter((b) => b.askToArchive).map((b) => <ArchivePrompt key={b.id} bean={b} />)}
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
                {brewsLeftLabel(b.brewsLeft) && <div className="left">{brewsLeftLabel(b.brewsLeft)}</div>}
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
    </div>
  );
};
