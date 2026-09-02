import { describe, expect, it } from "vitest";
import type { Achievement } from "../api/types";
import { fraction, leavesByGroup, ledgerOrder, stampDate } from "./passport";

const a = (key: string, have: number, of: number, unlockedAt: string | null = null): Achievement =>
  ({ key, title: key, subtitle: "", unlocked: unlockedAt !== null, unlockedAt, progress: { have, of } });

describe("passport", () => {
  it("clamps progress fractions", () => {
    expect(fraction(3, 4)).toBe(0.75);
    expect(fraction(9, 4)).toBe(1);
    expect(fraction(0, 0)).toBe(0);
  });

  it("orders stamps newest first, then the nearest misses", () => {
    const out = ledgerOrder([
      a("FAR", 1, 100),
      a("OLD", 1, 1, "2026-08-01T08:00:00Z"),
      a("NEAR", 6, 7),
      a("NEW", 1, 1, "2026-08-20T08:00:00Z"),
      a("ALSO_NEAR", 12, 14),
    ]).map((x) => x.key);
    expect(out).toEqual(["NEW", "OLD", "NEAR", "ALSO_NEAR", "FAR"]);
  });

  it("groups a category's leaves in wheel order", () => {
    const leaves = [
      { flavour: "Blackberry", category: "FRUITY", group: "BERRY", tasted: true, lastTaggedAt: null },
      { flavour: "Jasmine", category: "FLORAL", group: "FLOWERS", tasted: false, lastTaggedAt: null },
      { flavour: "Raisin", category: "FRUITY", group: "DRIED", tasted: false, lastTaggedAt: null },
      { flavour: "Raspberry", category: "FRUITY", group: "BERRY", tasted: false, lastTaggedAt: null },
    ];
    expect(leavesByGroup(leaves, "FRUITY").map((g) => [g.name, g.leaves.length])).toEqual([["BERRY", 2], ["DRIED", 1]]);
  });

  it("dates a stamp", () => {
    expect(stampDate(new Date(2026, 7, 12, 9, 0).toISOString())).toBe("12 AUG 26");
  });
});
