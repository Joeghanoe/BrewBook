import type { Brew, Roaster } from "../api/types";

/** The user's palate: liked flavours across every brew, most tagged first, ties alphabetical. */
export const topLikedFlavours = (brews: Brew[], limit = 8): string[] => {
  const counts = new Map<string, number>();
  for (const b of brews) for (const t of b.flavourTags) if (t.polarity > 0) counts.set(t.flavour, (counts.get(t.flavour) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([f]) => f);
};

/** "4.5" for a rated roaster, "—" when none of its brews is rated yet. */
export const ratingLabel = (avg: number | null) => (avg === null ? "—" : avg.toFixed(1));

/** Pin radius in px: every roaster gets a dot, a well-rated one a bigger one. */
export const pinRadius = (avg: number | null) => (avg === null ? 8 : 9 + avg * 1.6);

/** Google Maps link for the sheet. Prefers the place id so the link lands on the same pin, not a fresh search. */
export const mapsUrl = (r: Roaster) => {
  if (r.located && r.lat !== null && r.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + " coffee roaster")}`;
};
