import { describe, expect, it } from "vitest";
import { annular, polar, wedgeAngles, WHEEL_GEOMETRY } from "./wheelGeometry";

describe("wheelGeometry", () => {
  it("places points around the centre", () => {
    const [x, y] = polar(170, 170, 160, -90);
    expect(x).toBeCloseTo(170);
    expect(y).toBeCloseTo(10);
    const [x2, y2] = polar(0, 0, 10, 0);
    expect([x2, y2]).toEqual([10, 0]);
  });

  it("lays nine wedges out from 12 o'clock", () => {
    expect(wedgeAngles(0, 9)).toEqual({ a0: -90, a1: -50, mid: -70, step: 40 });
    expect(wedgeAngles(8, 9).a1).toBe(270);
  });

  it("draws a closed ring sector with a small-arc flag under 180°", () => {
    const { cx, cy, ro, ri } = WHEEL_GEOMETRY;
    const d = annular(cx, cy, ro, ri, -90, -50);
    expect(d.startsWith("M 170.0 10.0 A 160 160 0 0 1 ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
    expect(annular(cx, cy, ro, ri, 0, 200)).toContain("A 160 160 0 1 1 ");
  });
});
