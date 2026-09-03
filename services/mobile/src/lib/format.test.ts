import { describe, expect, it } from "vitest";
import { changedKeys, daysOffRoast, describeDelta, describeFull, describePreference, durationDelta, fmtLocalDateTime, fmtTime, fmtTimeOrDash, METHOD_DEFAULTS, paramsFor, parseClock, parseLocalDateTime, sameAsLabel, sameParams, whenLabel } from "./format";

const now = new Date(2026, 8, 1, 9, 41); // 1 Sep 2026, Tuesday

describe("format", () => {
  it("formats elapsed time as m:ss", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(154_000)).toBe("2:34");
    expect(fmtTime(-5)).toBe("0:00");
  });

  it("counts days off roast from a calendar date", () => {
    expect(daysOffRoast("2026-08-20", now)).toBe(12);
    expect(daysOffRoast(null, now)).toBeNull();
    expect(daysOffRoast("2026-09-05", now)).toBe(0);
  });

  it("describes the delta against the previous brew", () => {
    const base = METHOD_DEFAULTS.filter;
    expect(describeDelta(base, null)).toBe("first brew");
    expect(describeDelta({ ...base, tempC: 93 }, base)).toBe("93°C (was 94)");
    expect(describeDelta({ ...base, grind: 4 }, base)).toBe("−0.5 grind");
    expect(describeDelta({ ...base, targetMs: 165_000 }, base)).toBe("target 2:45 (was 2:30)");
    expect(describeDelta(base, base)).toBe("same as last");
  });

  it("names a method change instead of comparing numbers across methods", () => {
    expect(describeDelta(METHOD_DEFAULTS.espresso, METHOD_DEFAULTS.filter)).toBe("espresso (was filter)");
    const e = METHOD_DEFAULTS.espresso;
    expect(describeDelta({ ...e, preInfusionS: 8, yieldG: 40 }, e)).toBe("+4 g out · 8 s pre-infusion (was 0)");
  });

  it("lays out six cells per method and hides what the method has not got", () => {
    expect(paramsFor("filter").map((c) => c.label)).toEqual(["GRIND", "DOSE", "WATER", "TEMP", "BLOOM", "TIME"]);
    expect(paramsFor("espresso").map((c) => c.label)).toEqual(["GRIND", "DOSE", "YIELD", "TEMP", "PRE-INF", "SHOT"]);
    const f = METHOD_DEFAULTS.filter;
    expect(sameParams(f, { ...f, preInfusionS: 9 })).toBe(true);
    expect(sameParams(f, { ...f, blooms: 3 })).toBe(false);
    expect(sameParams(f, METHOD_DEFAULTS.espresso)).toBe(false);
    expect(changedKeys({ ...f, targetMs: 155_000 }, f).map((c) => c.key)).toEqual(["targetMs"]);
    expect(changedKeys(METHOD_DEFAULTS.espresso, f)).toHaveLength(6);
  });

  it("reads the measured time against the recipe", () => {
    expect(durationDelta(0, 150_000)).toBe("");
    expect(durationDelta(150_400, 150_000)).toBe("on target");
    expect(durationDelta(161_000, 150_000)).toBe("+11 s");
    expect(durationDelta(146_000, 150_000)).toBe("−4 s");
    expect(fmtTimeOrDash(0)).toBe("—");
    expect(describeFull(METHOD_DEFAULTS.filter, 0)).toContain("untimed (target 2:30)");
    expect(describeFull(METHOD_DEFAULTS.espresso, 27_000)).toBe("18.0 g → 36 g · 93°C · grind 2.0 · 0 s pre-infusion · 0:27 (target 0:28)");
  });

  it("describes a preferred value against the overall median", () => {
    expect(describePreference("grind", 4, 4.5)).toBe("−0.5 FINER");
    expect(describePreference("grind", 5, 4.5)).toBe("+0.5 COARSER");
    expect(describePreference("doseG", 15.5, 15)).toBe("+0.5 G");
    expect(describePreference("yieldG", 240, 250)).toBe("−10 G");
    expect(describePreference("tempC", 93, 93.5)).toBe("−0.5°C");
    expect(describePreference("blooms", 3, 2)).toBe("+1 BLOOM");
    expect(describePreference("blooms", 1, 3)).toBe("−2 BLOOMS");
    expect(describePreference("tempC", 94, 94)).toBe("SAME");
    expect(describePreference("preInfusionS", 8, 6)).toBe("+2 S");
    expect(describePreference("targetMs", 27_000, 30_000)).toBe("−3 S");
  });

  it("labels when a brew happened", () => {
    expect(whenLabel(new Date(2026, 8, 1, 9, 39).toISOString(), now)).toBe("JUST NOW");
    expect(whenLabel(new Date(2026, 8, 1, 8, 2).toISOString(), now)).toBe("8:02");
    expect(whenLabel(new Date(2026, 7, 31, 8, 2).toISOString(), now)).toBe("YESTERDAY");
    expect(whenLabel(new Date(2026, 7, 27, 8, 2).toISOString(), now)).toBe("THURSDAY");
    expect(whenLabel(new Date(2026, 7, 12, 8, 2).toISOString(), now)).toBe("12 AUG");
    expect(sameAsLabel(new Date(2026, 7, 31, 8, 2).toISOString(), now)).toBe("same as yesterday, 08:02");
  });

  it("reads a typed time and a typed date", () => {
    expect(parseClock("2:41")).toBe(161_000);
    expect(parseClock("2 41")).toBe(161_000);
    expect(parseClock("150")).toBe(150_000);
    expect(parseClock("")).toBeNull();
    expect(parseClock("two")).toBeNull();
    const iso = parseLocalDateTime("2026-09-01 08:02");
    expect(iso).toBe(new Date(2026, 8, 1, 8, 2).toISOString());
    expect(parseLocalDateTime("2026-09-01T08:02")).toBe(iso);
    expect(parseLocalDateTime("2026-02-30 08:02")).toBeNull();
    expect(parseLocalDateTime("yesterday")).toBeNull();
    expect(fmtLocalDateTime(iso!)).toBe("2026-09-01 08:02");
    expect(fmtLocalDateTime(iso!, "T")).toBe("2026-09-01T08:02");
  });
});
