import type { Brew, Roaster, RoasterVoice } from "../api/types";

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

/**
 * What a pin says: whose it is, the roaster, the overall rating (§4). A roaster several people
 * disagree about keeps every one of their ratings — the app never averages people into a score,
 * so the pin shows the best of them and the tap shows them all.
 */
export const pinVoice = (r: Roaster): RoasterVoice | null => {
  if (r.voices.length === 0) return null;
  const mine = r.voices.find((v) => v.isMe);
  if (mine && mine.avgRating !== null) return mine;
  const rated = r.voices.filter((v) => v.avgRating !== null);
  if (rated.length > 0) return rated.reduce((best, v) => (v.avgRating! > best.avgRating! ? v : best));
  return mine ?? r.voices[0];
};

/** A pin the user has not drunk and only means to visit reads differently from one they have. */
export const pinKind = (r: Roaster): "mine" | "friend" | "wish" => {
  if (r.mine) return "mine";
  if (r.voices.length > 0) return "friend";
  return "wish";
};
