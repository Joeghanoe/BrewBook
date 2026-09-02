import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { CategoryCoverage, Passport as PassportData } from "../api/types";
import { Rule } from "../components/Chrome";
import { whenLabel } from "../lib/format";
import { fraction, leavesByGroup, ledgerOrder, stampDate } from "../lib/passport";
import { annular, polar, wedgeAngles, WHEEL_GEOMETRY } from "../lib/wheelGeometry";
import { useStore } from "../state/store";

export const Passport = () => {
  const s = useStore();
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.passport()); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e.message : "The passport could not be reached."); }
  }, []);
  // Reload whenever the brews change under us: the wheel sheet may still be saving tags as this opens.
  useEffect(() => { void load(); }, [load, s.brews]);

  const tasted = data ? data.coverage.categories.reduce((n, c) => n + c.tasted, 0) : 0;
  const of = data ? data.coverage.categories.reduce((n, c) => n + c.of, 0) : 0;
  const stamps = data ? data.achievements.filter((a) => a.unlocked).length : 0;

  return (
    <div className="screen">
      <div className="nav">
        <button className="sqbtn" onClick={() => s.setScreen("profile")} aria-label="Back to the profile">←</button>
        <div className="title">PASSPORT</div>
      </div>
      <div className="passport">
        {!data && !error && <div className="empty" style={{ textAlign: "center" }}>Opening the passport…</div>}
        {!data && error && (
          <div className="empty" style={{ textAlign: "center" }}>
            <div>{error}</div>
            <button className="act" style={{ marginTop: 14 }} onClick={() => void load()}>TRY AGAIN →</button>
          </div>
        )}
        {data && (
          <>
            <div style={{ margin: "16px 22px 0" }}><Rule label="FLAVOUR WHEEL" right={`${tasted} / ${of} TASTED`} /></div>
            <CoverageWheel categories={data.coverage.categories} tasted={tasted} of={of} selected={sel} onSelect={(c) => setSel(sel === c ? null : c)} />
            {sel === null && <div className="hint" style={{ marginTop: 4 }}>tap a wedge to see what is left to taste</div>}
            {sel !== null && (
              <div className="pp-panel">
                <div className="rule">
                  <span>{sel}</span><div className="line" />
                  <span className="dim">{data.coverage.categories.find((c) => c.name === sel)?.tasted ?? 0} / {data.coverage.categories.find((c) => c.name === sel)?.of ?? 0}</span>
                  <button className="pp-close" onClick={() => setSel(null)} aria-label="Close">✕</button>
                </div>
                {leavesByGroup(data.coverage.leaves, sel).map((g) => (
                  <div key={g.name}>
                    <div className="pp-group">{g.name}</div>
                    <div className="chips compact">
                      {g.leaves.map((l) => (
                        <div key={l.flavour} className={"pp-leaf" + (l.tasted ? "" : " off")}>
                          {l.flavour}
                          {l.tasted && l.lastTaggedAt && <span>{whenLabel(l.lastTaggedAt)}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ margin: "22px 22px 6px" }}><Rule label="STAMPS" right={`${stamps} / ${data.achievements.length}`} /></div>
            <div className="pp-ledger">
              {ledgerOrder(data.achievements).map((a) => (
                <div key={a.key} className={"pp-row" + (a.unlocked ? "" : " locked")}>
                  <div className="pp-text">
                    <div className="t">{a.title}</div>
                    <div className="s">{a.subtitle}</div>
                  </div>
                  {a.unlocked && a.unlockedAt
                    ? <div className="pp-stamp">✦ {stampDate(a.unlockedAt)}</div>
                    : <><div className="pp-leader" /><div className="pp-count">{a.progress.have} / {a.progress.of}</div></>}
                </div>
              ))}
            </div>
            <div style={{ height: 20 }} />
          </>
        )}
      </div>
    </div>
  );
};

const CoverageWheel = ({ categories, tasted, of, selected, onSelect }: {
  categories: CategoryCoverage[]; tasted: number; of: number; selected: string | null; onSelect: (name: string) => void;
}) => {
  const { cx, cy, ro, ri, size, viewBox } = WHEEL_GEOMETRY;
  const n = categories.length;
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
      <svg width={size} height={size} viewBox={viewBox} fill="none" style={{ maxWidth: "100%", animation: "bb-pop .5s both" }}>
        <g strokeWidth="1.2">
          {categories.map((c, i) => {
            const { a0, a1 } = wedgeAngles(i, n);
            const f = fraction(c.tasted, c.of);
            const on = c.name === selected;
            return (
              <g key={c.name} className="wedge" onClick={() => onSelect(c.name)}>
                <path d={annular(cx, cy, ro, ri, a0, a1)} fill="rgba(194,144,94,.06)" stroke={on ? "#d8a86f" : "rgba(194,144,94,.55)"} strokeWidth={on ? 1.8 : 1.2} />
                {f > 0 && <path d={annular(cx, cy, ri + (ro - ri) * f, ri, a0, a1)} fill="#c2905e" fillOpacity={0.22 + 0.5 * f} stroke="none" pointerEvents="none" />}
              </g>
            );
          })}
        </g>
        <g fontFamily="Space Grotesk" fontSize="11" fontWeight="600" letterSpacing="1.5" fill="#e9d6ae" textAnchor="middle" pointerEvents="none">
          {categories.map((c, i) => {
            const [x, y] = polar(cx, cy, (ro + ri) / 2 + 4, wedgeAngles(i, n).mid);
            return (
              <g key={c.name}>
                <text x={x.toFixed(1)} y={(y - 1).toFixed(1)}>{c.name}</text>
                <text x={x.toFixed(1)} y={(y + 13).toFixed(1)} fontFamily="Courier Prime" fontSize="10" fontWeight="700" letterSpacing="1" fill={c.tasted ? "#d8a86f" : "rgba(233,214,174,.45)"}>{c.tasted} / {c.of}</text>
              </g>
            );
          })}
        </g>
        <g pointerEvents="none" textAnchor="middle">
          <text x={cx} y={cy + 6} fontFamily="Courier Prime" fontSize="30" fontWeight="700" fill="#e9d6ae">{tasted}</text>
          <text x={cx} y={cy + 24} fontFamily="Courier Prime" fontSize="9" fontWeight="700" letterSpacing="2" fill="rgba(233,214,174,.55)">OF {of}</text>
          <text x={cx} y={cy - 22} fontFamily="Courier Prime" fontSize="9" fontWeight="700" letterSpacing="2" fill="rgba(194,144,94,.9)">TASTED</text>
        </g>
      </svg>
    </div>
  );
};
