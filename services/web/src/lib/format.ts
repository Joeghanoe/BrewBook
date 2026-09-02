import type { BrewParams } from "../api/types";

export const fmtTime = (ms: number) => {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return m + ":" + String(s).padStart(2, "0");
};

export const num = (v: number, dp = 1) => (Number.isInteger(v) ? String(v) : v.toFixed(dp));

export interface ParamCfg {
  key: keyof BrewParams;
  label: string;
  unit: string;
  step: number;
  fmt: (v: number) => string;
  cellUnit: string;
  delta: (v: number, b: number) => string;
}

// The ticket's five values, in ticket order. Steps from the handoff.
export const PARAMS: ParamCfg[] = [
  { key: "grind", label: "GRIND", unit: "clicks", step: 0.5, fmt: (v) => v.toFixed(1), cellUnit: "",
    delta: (v, b) => (v < b ? "−" : "+") + Math.abs(v - b).toFixed(1) + (v < b ? " FINER" : " COARSER") },
  { key: "doseG", label: "DOSE", unit: "g", step: 0.1, fmt: (v) => v.toFixed(1), cellUnit: "g",
    delta: (v, b) => (v < b ? "−" : "+") + Math.abs(v - b).toFixed(1) + " G" },
  { key: "yieldG", label: "YIELD", unit: "g", step: 5, fmt: (v) => num(v), cellUnit: "g",
    delta: (v, b) => (v < b ? "−" : "+") + num(Math.abs(v - b)) + " G" },
  { key: "tempC", label: "WATER", unit: "°C", step: 1, fmt: (v) => num(v), cellUnit: "°C",
    delta: (_v, b) => "WAS " + num(b) + "°C" },
  { key: "blooms", label: "BLOOM", unit: "pours", step: 1, fmt: (v) => "× " + v, cellUnit: "",
    delta: (_v, b) => "WAS × " + b },
];

export const round1 = (v: number) => Math.round(v * 10) / 10;
export const sameParams = (a: BrewParams, b: BrewParams) => PARAMS.every((c) => a[c.key] === b[c.key]);
export const changedKeys = (a: BrewParams, b: BrewParams) => PARAMS.filter((c) => a[c.key] !== b[c.key]);

/** "93°C (was 94) · −0.5 grind" — the dial-in log's delta line between two brews. */
export const describeDelta = (p: BrewParams, prev: BrewParams | null): string => {
  if (!prev) return "first brew";
  const parts: string[] = [];
  if (p.tempC !== prev.tempC) parts.push(`${num(p.tempC)}°C (was ${num(prev.tempC)})`);
  if (p.grind !== prev.grind) parts.push(`${p.grind < prev.grind ? "−" : "+"}${Math.abs(p.grind - prev.grind).toFixed(1)} grind`);
  if (p.doseG !== prev.doseG) parts.push(`${p.doseG < prev.doseG ? "−" : "+"}${Math.abs(p.doseG - prev.doseG).toFixed(1)} g dose`);
  if (p.yieldG !== prev.yieldG) parts.push(`${p.yieldG < prev.yieldG ? "−" : "+"}${num(Math.abs(p.yieldG - prev.yieldG))} g yield`);
  if (p.blooms !== prev.blooms) parts.push(`${p.blooms} blooms (was ${prev.blooms})`);
  return parts.length ? parts.join(" · ") : "same as last";
};

/** "−0.5 FINER" · "+10 G" · "−1°C" · "SAME" — how a preferred value sits against the overall median. */
export const describePreference = (key: keyof BrewParams, v: number, b: number): string => {
  if (v === b) return "SAME";
  const sign = v < b ? "−" : "+";
  const d = Math.abs(v - b);
  switch (key) {
    case "grind": return `${sign}${d.toFixed(1)} ${v < b ? "FINER" : "COARSER"}`;
    case "doseG": return `${sign}${d.toFixed(1)} G`;
    case "yieldG": return `${sign}${num(d)} G`;
    case "tempC": return `${sign}${num(d)}°C`;
    case "blooms": return `${sign}${d} ${d === 1 ? "BLOOM" : "BLOOMS"}`;
  }
};

export const describeFull = (p: BrewParams, durationMs: number) =>
  `${p.doseG.toFixed(1)} g → ${num(p.yieldG)} g · ${num(p.tempC)}°C · grind ${p.grind.toFixed(1)} · ${p.blooms} blooms · ${fmtTime(durationMs)}`;

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const daysOffRoast = (roastDate: string | null, now = new Date()): number | null => {
  if (!roastDate) return null;
  const [y, m, d] = roastDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.max(0, Math.floor((startOfDay(now) - new Date(y, m - 1, d).getTime()) / DAY));
};

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** JUST NOW · 08:02 · YESTERDAY · THURSDAY · 12 AUG — the log's "when" column. */
export const whenLabel = (iso: string, now = new Date()): string => {
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 5 * 60_000) return "JUST NOW";
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (days === 0) return clock(d);
  if (days === 1) return "YESTERDAY";
  if (days < 7) return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const clock = (d: Date, padHours = false) => `${padHours ? String(d.getHours()).padStart(2, "0") : d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "same as yesterday, 08:02" — the ticket footer when nothing changed. */
export const sameAsLabel = (lastBrewedAt: string | null, now = new Date()): string => {
  if (!lastBrewedAt) return "method defaults";
  const d = new Date(lastBrewedAt);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  const when = days === 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? WEEKDAYS[d.getDay()].toLowerCase() : `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`;
  return `same as ${when}, ${clock(d, true)}`;
};

export const lastLabel = (lastBrewedAt: string | null, now = new Date()) => (lastBrewedAt ? whenLabel(lastBrewedAt, now) : "—");

export const stars = (n: number) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "●");
