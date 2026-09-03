import { describe, expect, it } from "vitest";
import { daysOffRoast, describeDelta, describePreference, fmtTime, sameAsLabel, whenLabel } from "./format";

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
    const base = { grind: 4.5, doseG: 15, yieldG: 250, tempC: 94, blooms: 2 };
    expect(describeDelta(base, null)).toBe("first brew");
    expect(describeDelta({ ...base, tempC: 93 }, base)).toBe("93°C (was 94)");
    expect(describeDelta({ ...base, grind: 4 }, base)).toBe("−0.5 grind");
    expect(describeDelta(base, base)).toBe("same as last");
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
  });

  it("labels when a brew happened", () => {
    expect(whenLabel(new Date(2026, 8, 1, 9, 39).toISOString(), now)).toBe("JUST NOW");
    expect(whenLabel(new Date(2026, 8, 1, 8, 2).toISOString(), now)).toBe("8:02");
    expect(whenLabel(new Date(2026, 7, 31, 8, 2).toISOString(), now)).toBe("YESTERDAY");
    expect(whenLabel(new Date(2026, 7, 27, 8, 2).toISOString(), now)).toBe("THURSDAY");
    expect(whenLabel(new Date(2026, 7, 12, 8, 2).toISOString(), now)).toBe("12 AUG");
    expect(sameAsLabel(new Date(2026, 7, 31, 8, 2).toISOString(), now)).toBe("same as yesterday, 08:02");
  });
});
