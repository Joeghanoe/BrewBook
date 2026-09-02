import { describe, expect, it } from "vitest";
import type { Brew, Roaster } from "../api/types";
import { mapsUrl, pinRadius, ratingLabel, topLikedFlavours } from "./roasters";

const brew = (tags: [string, 1 | -1][]): Brew => ({
  id: "b", beanId: "x", number: 1, params: { grind: 4.5, doseG: 15, yieldG: 250, tempC: 94, blooms: 2 },
  durationMs: 0, pourMarkersMs: [], rating: 0, defects: [], brewedAt: "2026-09-01T08:00:00Z",
  flavourTags: tags.map(([flavour, polarity]) => ({ flavour, polarity })),
});

const roaster = (over: Partial<Roaster>): Roaster => ({
  id: "r", name: "Symple", address: null, lat: null, lng: null, located: false, website: null,
  bags: 1, brews: 1, avgRating: null, topFlavours: [], dislikedFlavours: [], matchCount: null, ...over,
});

describe("roasters", () => {
  it("ranks liked flavours by count and ignores dislikes", () => {
    const brews = [brew([["Peach", 1], ["Jasmine", 1]]), brew([["Peach", 1], ["Smoky", -1]]), brew([["Honey", 1]])];
    expect(topLikedFlavours(brews)).toEqual(["Peach", "Honey", "Jasmine"]);
    expect(topLikedFlavours(brews, 1)).toEqual(["Peach"]);
    expect(topLikedFlavours([])).toEqual([]);
  });

  it("labels and sizes pins by rating", () => {
    expect(ratingLabel(null)).toBe("—");
    expect(ratingLabel(4.25)).toBe("4.3");
    expect(pinRadius(null)).toBeLessThan(pinRadius(1));
    expect(pinRadius(5)).toBeGreaterThan(pinRadius(3));
  });

  it("links to the pin when located, to a search when not", () => {
    expect(mapsUrl(roaster({ located: true, lat: 4.65, lng: -74.05 }))).toBe("https://www.google.com/maps/search/?api=1&query=4.65,-74.05");
    expect(mapsUrl(roaster({}))).toBe("https://www.google.com/maps/search/?api=1&query=Symple%20coffee%20roaster");
  });
});
