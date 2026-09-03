import type { BrewMethod, BrewParams, BrewStep } from "../api/types";

export const fmtTime = (ms: number) => {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return m + ":" + String(s).padStart(2, "0");
};

export const num = (v: number, dp = 1) => (Number.isInteger(v) ? String(v) : v.toFixed(dp));

/** Any ticket value that is a number; `method` is the one that is not. */
export type ParamKey = Exclude<keyof BrewParams, "method">;

export interface ParamCfg {
  key: ParamKey;
  label: string;
  unit: string;
  step: number;
  fmt: (v: number) => string;
  cellUnit: string;
  delta: (v: number, b: number) => string;
}

export const METHOD_LABEL: Record<BrewMethod, string> = { filter: "FILTER", espresso: "ESPRESSO" };
export const METHODS: BrewMethod[] = ["filter", "espresso"];

/** What the first brew of a bag starts from, per method. The espresso grind is a placeholder for the user's own scale. */
export const METHOD_DEFAULTS: Record<BrewMethod, BrewParams> = {
  filter: { method: "filter", grind: 4.5, doseG: 15, yieldG: 250, tempC: 94, blooms: 2, preInfusionS: null, targetMs: 150_000 },
  espresso: { method: "espresso", grind: 2, doseG: 18, yieldG: 36, tempC: 93, blooms: 0, preInfusionS: 0, targetMs: 28_000 },
};

/** A ticket value as a number; a field the method does not have reads as 0. */
export const val = (p: BrewParams, key: ParamKey): number => p[key] ?? 0;

const sign = (v: number, b: number) => (v < b ? "−" : "+");
const secs = (ms: number) => Math.round(ms / 1000);

const GRIND: ParamCfg = { key: "grind", label: "GRIND", unit: "clicks", step: 0.5, fmt: (v) => v.toFixed(1), cellUnit: "",
  delta: (v, b) => sign(v, b) + Math.abs(v - b).toFixed(1) + (v < b ? " FINER" : " COARSER") };
const DOSE: ParamCfg = { key: "doseG", label: "DOSE", unit: "g", step: 0.1, fmt: (v) => v.toFixed(1), cellUnit: "g",
  delta: (v, b) => sign(v, b) + Math.abs(v - b).toFixed(1) + " G" };
const WATER: ParamCfg = { key: "yieldG", label: "WATER", unit: "g", step: 5, fmt: (v) => num(v), cellUnit: "g",
  delta: (v, b) => sign(v, b) + num(Math.abs(v - b)) + " G" };
const YIELD: ParamCfg = { ...WATER, label: "YIELD", unit: "g out", step: 1, fmt: (v) => num(v) };
const TEMP: ParamCfg = { key: "tempC", label: "TEMP", unit: "°C", step: 1, fmt: (v) => num(v), cellUnit: "°C",
  delta: (_v, b) => "WAS " + num(b) + "°C" };
const BLOOM: ParamCfg = { key: "blooms", label: "BLOOM", unit: "pours", step: 1, fmt: (v) => "× " + v, cellUnit: "",
  delta: (_v, b) => "WAS × " + b };
const PREINF: ParamCfg = { key: "preInfusionS", label: "PRE-INF", unit: "s", step: 1, fmt: (v) => num(v), cellUnit: "s",
  delta: (v, b) => sign(v, b) + Math.abs(v - b) + " S" };
const TIME: ParamCfg = { key: "targetMs", label: "TIME", unit: "target", step: 5000, fmt: (v) => fmtTime(v), cellUnit: "",
  delta: (_v, b) => "WAS " + fmtTime(b) };
const SHOT: ParamCfg = { ...TIME, label: "SHOT", step: 1000, delta: (v, b) => sign(v, b) + Math.abs(secs(v) - secs(b)) + " S" };

/** The ticket's six cells for a method, in ticket order. Steps from the handoff. */
export const paramsFor = (method: BrewMethod): ParamCfg[] =>
  method === "espresso" ? [GRIND, DOSE, YIELD, TEMP, PREINF, SHOT] : [GRIND, DOSE, WATER, TEMP, BLOOM, TIME];

export const round1 = (v: number) => Math.round(v * 10) / 10;
export const sameParams = (a: BrewParams, b: BrewParams) => a.method === b.method && paramsFor(a.method).every((c) => val(a, c.key) === val(b, c.key));
/** The cells that differ. A method change is every cell, so the list is the new method's cells. */
export const changedKeys = (a: BrewParams, b: BrewParams) =>
  a.method !== b.method ? paramsFor(a.method) : paramsFor(a.method).filter((c) => val(a, c.key) !== val(b, c.key));

/** "93°C (was 94) · −0.5 grind" — the dial-in log's delta line between two brews. */
export const describeDelta = (p: BrewParams, prev: BrewParams | null): string => {
  if (!prev) return "first brew";
  if (p.method !== prev.method) return `${METHOD_LABEL[p.method].toLowerCase()} (was ${METHOD_LABEL[prev.method].toLowerCase()})`;
  const parts: string[] = [];
  if (p.tempC !== prev.tempC) parts.push(`${num(p.tempC)}°C (was ${num(prev.tempC)})`);
  if (p.grind !== prev.grind) parts.push(`${sign(p.grind, prev.grind)}${Math.abs(p.grind - prev.grind).toFixed(1)} grind`);
  if (p.doseG !== prev.doseG) parts.push(`${sign(p.doseG, prev.doseG)}${Math.abs(p.doseG - prev.doseG).toFixed(1)} g dose`);
  if (p.yieldG !== prev.yieldG) parts.push(`${sign(p.yieldG, prev.yieldG)}${num(Math.abs(p.yieldG - prev.yieldG))} g ${p.method === "espresso" ? "out" : "water"}`);
  if (p.method === "filter" && p.blooms !== prev.blooms) parts.push(`${p.blooms} blooms (was ${prev.blooms})`);
  if (p.method === "espresso" && val(p, "preInfusionS") !== val(prev, "preInfusionS")) parts.push(`${val(p, "preInfusionS")} s pre-infusion (was ${val(prev, "preInfusionS")})`);
  if (p.targetMs !== prev.targetMs) parts.push(`target ${fmtTime(p.targetMs)} (was ${fmtTime(prev.targetMs)})`);
  return parts.length ? parts.join(" · ") : "same as last";
};

/** "−0.5 FINER" · "+10 G" · "−1°C" · "SAME" — how a preferred value sits against the overall median. */
export const describePreference = (key: ParamKey, v: number, b: number): string => {
  if (v === b) return "SAME";
  const d = Math.abs(v - b);
  switch (key) {
    case "grind": return `${sign(v, b)}${d.toFixed(1)} ${v < b ? "FINER" : "COARSER"}`;
    case "doseG": return `${sign(v, b)}${d.toFixed(1)} G`;
    case "yieldG": return `${sign(v, b)}${num(d)} G`;
    case "tempC": return `${sign(v, b)}${num(d)}°C`;
    case "blooms": return `${sign(v, b)}${d} ${d === 1 ? "BLOOM" : "BLOOMS"}`;
    case "preInfusionS": return `${sign(v, b)}${d} S`;
    case "targetMs": return `${sign(v, b)}${secs(d)} S`;
  }
};

/** "0:00" is not a time a brew took: an untimed brew shows a dash until one is entered. */
export const fmtTimeOrDash = (ms: number) => (ms > 0 ? fmtTime(ms) : "—");

/** "+11 s" · "−4 s" · "on target" · "" — the measured time against the recipe's. Empty while untimed. */
export const durationDelta = (durationMs: number, targetMs: number): string => {
  if (durationMs <= 0) return "";
  const d = secs(durationMs) - secs(targetMs);
  if (d === 0) return "on target";
  return `${d < 0 ? "−" : "+"}${Math.abs(d)} s`;
};

/** "POUR 2" · "FIRST BLOOM" — a step's name in the timer's marker row; plain pours are counted. */
export const stepName = (steps: BrewStep[], i: number): string => {
  const label = steps[i].label.trim().toLowerCase();
  if (label !== "pour") return label.toUpperCase();
  const n = steps.slice(0, i + 1).filter((st) => st.label.trim().toLowerCase() === "pour").length;
  return `POUR ${n}`;
};

/** "bloom 0:00 · pour 0:45 · pour 1:30" — the steps of a brew in the dial-in log. */
export const describeSteps = (steps: BrewStep[]): string =>
  steps.map((st) => `${st.label.trim().toLowerCase()} ${fmtTime(st.atMs)}`).join(" · ");

export const describeFull = (p: BrewParams, durationMs: number) => {
  const time = durationMs > 0 ? fmtTime(durationMs) : "untimed";
  return p.method === "espresso"
    ? `${p.doseG.toFixed(1)} g → ${num(p.yieldG)} g · ${num(p.tempC)}°C · grind ${p.grind.toFixed(1)} · ${val(p, "preInfusionS")} s pre-infusion · ${time} (target ${fmtTime(p.targetMs)})`
    : `${p.doseG.toFixed(1)} g → ${num(p.yieldG)} g · ${num(p.tempC)}°C · grind ${p.grind.toFixed(1)} · ${p.blooms} blooms · ${time} (target ${fmtTime(p.targetMs)})`;
};

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

/**
 * "≈ 4 brews left". An estimate, and it says so: it comes off the label weight minus the doses
 * actually brewed, and a user who scoops straight from the bag will drift (§7).
 */
export const brewsLeftLabel = (brewsLeft: number | null): string | null => {
  if (brewsLeft === null) return null;
  if (brewsLeft === 0) return "empty by the numbers";
  return `≈ ${brewsLeft} ${brewsLeft === 1 ? "brew" : "brews"} left`;
};

/** "2:41" · "241" (seconds) · "2 41" → ms; null while it is not a time yet. */
export const parseClock = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  const m = /^(\d{1,2})[:\s.](\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) * 60_000 + Number(m[2]) * 1000;
  if (/^\d+$/.test(t)) return Number(t) * 1000;
  return null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-09-01 08:02" in local time — the brewed-at field, as typed and as shown. `sep` is "T" for a datetime-local input. */
export const fmtLocalDateTime = (iso: string, sep = " "): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}${sep}${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** "2026-09-01 08:02" or "2026-09-01T08:02" (local) → ISO instant; null when it does not read as a date and time. */
export const parseLocalDateTime = (raw: string): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d.toISOString();
};
