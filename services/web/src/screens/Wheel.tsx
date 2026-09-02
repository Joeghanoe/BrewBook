import { useState } from "react";
import { Grabber } from "../components/Chrome";
import { useLongPress } from "../hooks/useLongPress";
import { categoryOf, groupOf, WHEEL, type FlavourCategory } from "../lib/flavours";
import { whenLabel } from "../lib/format";
import { annular, polar, wedgeAngles, WHEEL_GEOMETRY } from "../lib/wheelGeometry";
import { useStore } from "../state/store";

const COPPER_FILL = "rgba(194,144,94,.07)", COPPER_FILL_ON = "rgba(194,144,94,.30)", COPPER_STROKE = "rgba(194,144,94,.55)";
const RUST_FILL = "rgba(161,85,63,.22)", RUST_STROKE = "rgba(161,85,63,.7)";

interface Counts { pos: number; neg: number }
const useCounts = () => {
  const { tags } = useStore();
  const byCat = new Map<string, Counts>();
  const byGroup = new Map<string, Counts>();
  for (const t of tags) {
    const c = categoryOf(t.flavour), g = groupOf(t.flavour) ?? "";
    const cc = byCat.get(c) ?? { pos: 0, neg: 0 }; const gc = byGroup.get(c + "/" + g) ?? { pos: 0, neg: 0 };
    if (t.polarity > 0) { cc.pos++; gc.pos++; } else { cc.neg++; gc.neg++; }
    byCat.set(c, cc); byGroup.set(c + "/" + g, gc);
  }
  return { byCat, byGroup, total: tags.length };
};

const fillFor = (c: Counts | undefined, base = COPPER_FILL, on = COPPER_FILL_ON) =>
  !c || c.pos + c.neg === 0 ? base : c.pos === 0 ? RUST_FILL : on;
const strokeFor = (c: Counts | undefined) => (c && c.pos + c.neg > 0 && c.pos === 0 ? RUST_STROKE : COPPER_STROKE);

export const WheelLayer = () => {
  const s = useStore();
  const [zoom, setZoom] = useState<FlavourCategory | null>(null);
  const { byCat, total } = useCounts();
  const { cx: CX, cy: CY, ro: RO, ri: RI, size, viewBox } = WHEEL_GEOMETRY, N = WHEEL.length;
  const subtitle = s.tagTarget ? `${s.currentBean?.name ?? "bean"} — ${whenLabel(s.tagTarget.brewedAt).toLowerCase()} · N° ${s.tagTarget.number}` : "no brew logged yet — tags need a brew";
  const done = () => { setZoom(null); void s.closeWheel(); };

  return (
    <>
      <div className="layer-backdrop" onClick={done} />
      <div className="layer wheel">
        <Grabber />
        <div className="layer-title">
          <button className="sqbtn" onClick={zoom ? () => setZoom(null) : done} aria-label={zoom ? "Back" : "Close"}>{zoom ? "←" : "✕"}</button>
          <div style={{ flex: 1, minWidth: 0 }}><div className="t">TAG FLAVOURS</div><div className="s">{subtitle}</div></div>
        </div>
        {zoom ? (
          <ZoomView category={zoom} onBack={() => setZoom(null)} />
        ) : (
          <>
            <div className="rule" style={{ margin: "14px 22px 0" }}><span>ALL FLAVOURS</span><div className="line" /><span className="dim">{total} TAGGED</span></div>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
              <svg width={size} height={size} viewBox={viewBox} fill="none" style={{ animation: "bb-pop .5s both" }}>
                <g strokeWidth="1.2">
                  {WHEEL.map((c, i) => {
                    const { a0, a1 } = wedgeAngles(i, N);
                    const cnt = byCat.get(c.name);
                    return <path key={c.name} className="wedge" d={annular(CX, CY, RO, RI, a0, a1)} fill={fillFor(cnt)} stroke={strokeFor(cnt)} onClick={() => setZoom(c)} />;
                  })}
                </g>
                <g fontFamily="Space Grotesk" fontSize="11" fontWeight="600" letterSpacing="1.5" fill="#e9d6ae" textAnchor="middle" pointerEvents="none">
                  {WHEEL.map((c, i) => { const [x, y] = polar(CX, CY, (RO + RI) / 2, wedgeAngles(i, N).mid); return <text key={c.name} x={x.toFixed(1)} y={(y + 4).toFixed(1)}>{c.name}</text>; })}
                </g>
                {WHEEL.map((c, i) => {
                  const cnt = byCat.get(c.name); if (!cnt || cnt.pos + cnt.neg === 0) return null;
                  const [x, y] = polar(CX, CY, RO - 8, wedgeAngles(i, N).a0 + 6);
                  const rust = cnt.pos === 0;
                  return (
                    <g key={c.name} pointerEvents="none" style={{ animation: "bb-pop .35s both", transformOrigin: `${x}px ${y}px` }}>
                      <circle cx={x} cy={y} r="10" fill={rust ? "#a1553f" : "#c2905e"} />
                      <text x={x} y={y + 4} fontFamily="Courier Prime" fontSize="11" fontWeight="700" fill={rust ? "#e9d6ae" : "#1c1a21"} textAnchor="middle">{cnt.pos + cnt.neg}</text>
                    </g>
                  );
                })}
                <g stroke="#c2905e" strokeWidth="1.3" pointerEvents="none" style={{ animation: "bb-blink 4.4s ease-in-out infinite", transformOrigin: "170px 166px" }}>
                  <path d="M148 166 Q170 146 192 166 Q170 186 148 166 Z" /><ellipse cx="170" cy="166" rx="6.5" ry="7" />
                </g>
              </svg>
            </div>
            <div className="hint" style={{ marginTop: 6, color: "rgba(233,214,174,.45)" }}>tap a wedge to open it</div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <div className="chips" style={{ padding: "0 22px 14px", minHeight: 44 }}>
          {s.tags.map((t) => (
            <button key={t.flavour} className={"chip" + (t.polarity < 0 ? " neg" : "")} onClick={() => s.setTags(s.tags.filter((x) => x.flavour !== t.flavour))}>
              {t.polarity < 0 ? "− " : ""}{t.flavour} <span>✕</span>
            </button>
          ))}
        </div>
        <div style={{ padding: "0 22px 14px" }}><button className="cta" onClick={done}><span>DONE</span></button></div>
      </div>
    </>
  );
};

const ZoomView = ({ category, onBack }: { category: FlavourCategory; onBack: () => void }) => {
  const { byGroup, total } = useCounts();
  const groups = category.groups;
  const CX = 195, CY = 175, RO = 118, RI = 56, STEP = 180 / groups.length;
  return (
    <>
      <div className="crumbs">
        <button onClick={onBack}>← ALL FLAVOURS</button><span className="slash">/</span><span className="cur">{category.name}</span>
        <div className="line" /><span className="dim">{total} TAGGED</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="390" height="150" viewBox="0 40 390 150" fill="none" style={{ maxWidth: "100%", animation: "bb-pop .4s both" }}>
          <g stroke={COPPER_STROKE} strokeWidth="1.2">
            {groups.map((g, i) => {
              const a0 = 180 + i * STEP, a1 = a0 + STEP;
              return <path key={g.name} d={annular(CX, CY, RO, RI, a0, a1)} fill={fillFor(byGroup.get(category.name + "/" + g.name), "rgba(194,144,94,.08)", "rgba(194,144,94,.32)")} />;
            })}
          </g>
          <g fontFamily="Space Grotesk" fontSize="10" fontWeight="600" letterSpacing="1.5" fill="#e9d6ae" textAnchor="middle" pointerEvents="none">
            {groups.map((g, i) => { const [x, y] = polar(CX, CY, (RO + RI) / 2, 180 + (i + 0.5) * STEP); return <text key={g.name} x={x.toFixed(1)} y={(y + 4).toFixed(1)}>{g.name}</text>; })}
          </g>
          {groups.map((g, i) => {
            const cnt = byGroup.get(category.name + "/" + g.name); if (!cnt || cnt.pos + cnt.neg === 0) return null;
            const [x, y] = polar(CX, CY, RO - 8, 180 + i * STEP + 8);
            return (
              <g key={g.name} pointerEvents="none" style={{ animation: "bb-pop .35s both", transformOrigin: `${x}px ${y}px` }}>
                <circle cx={x} cy={y} r="9" fill="#c2905e" />
                <text x={x} y={y + 3.5} fontFamily="Courier Prime" fontSize="10" fontWeight="700" fill="#1c1a21" textAnchor="middle">{cnt.pos + cnt.neg}</text>
              </g>
            );
          })}
          <text x={CX} y={CY - 12} fontFamily="Space Grotesk" fontSize="13" fontWeight="700" letterSpacing="4" fill="#d8a86f" textAnchor="middle">{category.name}</text>
        </svg>
      </div>
      <div className="leaves">
        {groups.map((g, i) => (
          <div key={g.name}>
            <div className="rule" style={{ marginTop: i ? 12 : 0 }}><span>{g.name}</span><div className="line" /></div>
            <div className="chips compact" style={{ marginTop: 8 }}>{g.leaves.map((l) => <Leaf key={l} name={l} />)}</div>
          </div>
        ))}
      </div>
      <div className="hint" style={{ marginTop: 8, color: "rgba(233,214,174,.45)" }}>tap to tag · long-press to mark a dislike</div>
    </>
  );
};

const Leaf = ({ name }: { name: string }) => {
  const { tags, setTags } = useStore();
  const cur = tags.find((t) => t.flavour === name);
  const others = tags.filter((t) => t.flavour !== name);
  const press = useLongPress(
    () => setTags(cur?.polarity === 1 ? others : [...others, { flavour: name, polarity: 1 }]),
    () => setTags(cur?.polarity === -1 ? others : [...others, { flavour: name, polarity: -1 }]),
  );
  return (
    <button className={"leaf" + (cur?.polarity === 1 ? " pos" : cur?.polarity === -1 ? " neg" : "")} {...press}>
      {name}{cur?.polarity === 1 ? " ✓" : ""}
    </button>
  );
};
