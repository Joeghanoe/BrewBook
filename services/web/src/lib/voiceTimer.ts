/**
 * Timer commands spoken while brewing. These are UI events, not ticket changes, so they are parsed
 * here on the device before anything goes to the API's ticket parser: "start", "first bloom",
 * "second pour", "finished". Anything not recognised falls through; nothing is guessed.
 */
export type TimerCommand = { kind: "start" } | { kind: "stop" } | { kind: "mark"; label: string };

const STEP_WORDS = "bloom|pour|stir|swirl|plunge|press|mark";
const ORDINALS = "first|second|third|fourth|fifth|last|final";

const START = /^(?:start|go|begin)(?: the)?(?: timer| brew(?:ing)?)?$/;
const STOP = /^(?:stop|finish(?:ed)?|done|end|that's it)(?: the)?(?: timer| brew(?:ing)?)?(?: at .*)?$/;
// "first bloom", "mark the second pour", "pouring now", "mark". Counts ("two blooms") stay with the
// ticket parser, so only a bare or ordinal-led step word is a mark.
const MARK = new RegExp(`^(?:mark(?: the)?\\s+)?(?:(${ORDINALS})\\s+)?(${STEP_WORDS})(?:ing|s)?(?: now)?$`);

const clean = (text: string) => text.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();

export const parseTimerCommand = (text: string): TimerCommand | null => {
  const t = clean(text);
  if (!t) return null;
  if (START.test(t)) return { kind: "start" };
  if (STOP.test(t)) return { kind: "stop" };
  const m = MARK.exec(t);
  if (!m) return null;
  const word = m[2] === "mark" ? "pour" : m[2];
  if (m[2] === "mark" && m[1]) return null; // "first mark" is not a step name
  return { kind: "mark", label: m[1] ? `${m[1]} ${word}` : word };
};
