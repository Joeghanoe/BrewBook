import { useState, type ReactNode } from "react";
import type { Brew } from "../api/types";
import { useStore } from "../state/store";

export const DEFECTS = ["Sour", "Bitter", "Thin", "Harsh"];

/**
 * Stars and defects for one brew, usable at any time after it: on the rate card, in the dial-in
 * log, on the edit screen. Tapping the star it already has takes the rating off again.
 */
export const RateRow = ({ brew, onPick, children }: { brew: Brew; onPick?: (rating: number) => void; children?: ReactNode }) => {
  const s = useStore();
  const [defects, setDefects] = useState<string[]>(brew.defects);
  const toggle = (d: string) => {
    const next = defects.includes(d) ? defects.filter((x) => x !== d) : [...defects, d];
    setDefects(next);
    void s.rateBrew(brew.id, null, next);
  };
  const pick = (n: number) => {
    const next = n === brew.rating ? 0 : n;
    void s.rateBrew(brew.id, next, null);
    s.showToast(next ? `N° ${String(brew.number).padStart(3, "0")} rated ${"★".repeat(next)}` : `N° ${String(brew.number).padStart(3, "0")} unrated`);
    onPick?.(next);
  };
  return (
    <>
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={n <= brew.rating ? "on" : ""} onClick={() => pick(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={n <= brew.rating}>★</button>
        ))}
      </div>
      <div className="defects">
        {DEFECTS.map((d) => <button key={d} className={"defect" + (defects.includes(d) ? " on" : "")} onClick={() => toggle(d)}>{d}</button>)}
        {children}
      </div>
    </>
  );
};
