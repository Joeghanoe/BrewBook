import type { Achievement, LeafCoverage } from "../api/types";

/** 0..1, safe when `of` is 0. */
export const fraction = (have: number, of: number) => (of > 0 ? Math.min(1, Math.max(0, have / of)) : 0);

/** Stamps first, newest on top; then the rest by how close they are. Ties keep catalogue order. */
export const ledgerOrder = (list: Achievement[]): Achievement[] =>
  list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      if (x.a.unlocked !== y.a.unlocked) return x.a.unlocked ? -1 : 1;
      if (x.a.unlocked) return (y.a.unlockedAt ?? "").localeCompare(x.a.unlockedAt ?? "") || x.i - y.i;
      return fraction(y.a.progress.have, y.a.progress.of) - fraction(x.a.progress.have, x.a.progress.of) || x.i - y.i;
    })
    .map((x) => x.a);

/** Leaves of one category grouped in wheel order. */
export const leavesByGroup = (leaves: LeafCoverage[], category: string) => {
  const groups: { name: string; leaves: LeafCoverage[] }[] = [];
  for (const l of leaves) {
    if (l.category !== category) continue;
    let g = groups.find((x) => x.name === l.group);
    if (!g) { g = { name: l.group, leaves: [] }; groups.push(g); }
    g.leaves.push(l);
  }
  return groups;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "12 AUG 26" — the date on a stamp. */
export const stampDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear() % 100).padStart(2, "0")}`;
};
