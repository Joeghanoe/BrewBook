// Wire types for /api/v1. Mirror services/api/src/Brewbook.Api/Contracts/Dtos.cs.

export interface BrewParams {
  grind: number;
  doseG: number;
  yieldG: number;
  tempC: number;
  blooms: number;
}

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  features: { labelReading: boolean; speechTranscription: boolean; friends: boolean; emailInvites: boolean };
  /** When the first-sign-in guide was finished or skipped; null until then. */
  onboardedAt: string | null;
  /** Whether a newly rated brew is visible to friends. Per-brew overrides sit on the brew. */
  shareRatedByDefault: boolean;
}

export interface Bean {
  id: string;
  name: string;
  roaster: string | null;
  roasterId: string | null;
  origin: string | null;
  process: string | null;
  roastDate: string | null;
  producer: string | null;
  varietal: string | null;
  altitude: string | null;
  roastLevel: string | null;
  declaredNotes: string[];
  /** Net weight off the label, in grams. Null when the label did not say. */
  weightG: number | null;
  /** Rough brews left at the current dose. Null without a weight — no weight, no countdown. */
  brewsLeft: number | null;
  /** The bag is empty or over a year off roast, and has not been asked about yet. */
  askToArchive: boolean;
  archived: boolean;
  labelKept: boolean;
  createdAt: string;
  brewCount: number;
  lastBrewedAt: string | null;
  lastParams: BrewParams;
}

export interface CreateBean {
  name: string;
  roaster?: string | null;
  origin?: string | null;
  process?: string | null;
  roastDate?: string | null;
  producer?: string | null;
  varietal?: string | null;
  altitude?: string | null;
  roastLevel?: string | null;
  declaredNotes?: string[];
  weightG?: number | null;
  labelScanId?: string | null;
}

/** Editing a bag. Every field is optional: omit one to leave it alone, send "" to clear it. */
export interface UpdateBean {
  name?: string;
  roaster?: string;
  origin?: string;
  process?: string;
  roastDate?: string | null;
  clearRoastDate?: boolean;
  producer?: string;
  varietal?: string;
  altitude?: string;
  roastLevel?: string;
  declaredNotes?: string[];
  weightG?: number | null;
  clearWeight?: boolean;
  archived?: boolean;
}

export interface FlavourTag {
  flavour: string;
  polarity: 1 | -1;
}

/** A passport stamp earned by the write that produced the response. */
export interface Unlocked {
  key: string;
  title: string;
}

export interface Brew {
  id: string;
  beanId: string;
  number: number;
  params: BrewParams;
  durationMs: number;
  pourMarkersMs: number[];
  rating: number;
  defects: string[];
  flavourTags: FlavourTag[];
  brewedAt: string;
  /** Kept out of friends' view. An unrated brew is never shared whatever this says. */
  isPrivate: boolean;
  /** Empty on reads and on writes that earned nothing. */
  newlyUnlocked: Unlocked[];
}

export interface Progress {
  have: number;
  of: number;
}

export interface Achievement {
  key: string;
  title: string;
  subtitle: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: Progress;
}

export interface LeafCoverage {
  flavour: string;
  category: string;
  group: string;
  tasted: boolean;
  lastTaggedAt: string | null;
}

export interface CategoryCoverage {
  name: string;
  tasted: number;
  of: number;
}

export interface Passport {
  achievements: Achievement[];
  coverage: { leaves: LeafCoverage[]; categories: CategoryCoverage[] };
}

// Taste profile, derived from brews and tags on every read.
export interface ProfileFlavour {
  flavour: string;
  category: string;
  likes: number;
  dislikes: number;
  lastTaggedAt: string;
}
export interface ProfileCategory {
  category: string;
  likes: number;
  dislikes: number;
}
export interface ProfileDefect {
  defect: string;
  count: number;
}
export interface ProfileBean {
  beanId: string;
  name: string;
  roaster: string | null;
  archived: boolean;
  brews: number;
  avgRating: number | null;
  bestBrewId: string | null;
}
export interface ProfileRoaster {
  roaster: string;
  bags: number;
  brews: number;
  avgRating: number | null;
  topFlavours: string[];
}
export interface Profile {
  email: string;
  displayName: string | null;
  counts: { brews: number; bags: number; flavours: number; daysLogging: number };
  flavours: {
    leaves: ProfileFlavour[];
    /** Every wheel category in wheel order, zeros included. */
    categories: ProfileCategory[];
    topLiked: ProfileFlavour[];
    topDisliked: ProfileFlavour[];
  };
  preferences: {
    /** Medians over brews rated 4+; null until one exists. */
    preferred: BrewParams | null;
    /** Medians over every brew; null until one exists. */
    overall: BrewParams | null;
    ratedBrews: number;
    likedBrews: number;
    typicalDurationMs: number | null;
    defects: ProfileDefect[];
  };
  beans: ProfileBean[];
  topBeans: ProfileBean[];
  roasters: ProfileRoaster[];
}

/** One person's word on a roaster. Ratings stay attributed and are never averaged across people. */
export interface RoasterVoice {
  userId: string;
  name: string;
  initials: string;
  isMe: boolean;
  bags: number;
  brews: number;
  avgRating: number | null;
  topFlavours: string[];
  dislikedFlavours: string[];
  matchCount: number | null;
}

export type RoasterScope = "mine" | "friends" | "both";

export interface Roaster {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  located: boolean;
  website: string | null;
  bags: number;
  brews: number;
  avgRating: number | null;
  topFlavours: string[];
  dislikedFlavours: string[];
  matchCount: number | null;
  /** Everyone in scope who has drunk this roaster — the user first, then friends. */
  voices: RoasterVoice[];
  /** The user has a bag from here. False for a roaster only on the map through a friend. */
  mine: boolean;
  /** Pinned as somewhere to go. Clears itself once a bag from here is in the library. */
  wished: boolean;
}

/** A friend's rated brew, which is all a recipe is: the five values, the time, the stars and the tags. */
export interface SharedBrew {
  id: string;
  fromUserId: string;
  fromName: string;
  number: number;
  beanName: string;
  origin: string | null;
  process: string | null;
  declaredNotes: string[];
  params: BrewParams;
  durationMs: number;
  rating: number;
  flavourTags: FlavourTag[];
  brewedAt: string;
}

export interface Friend {
  userId: string;
  name: string;
  initials: string;
  email: string | null;
  since: string;
  roasters: number;
  sharedBrews: number;
}

export interface FriendInvite {
  token: string;
  fromName: string;
  toEmail: string | null;
  createdAt: string;
  expiresAt: string;
}

/** A new invitation. `posted` says whether it actually went out by mail; the link works either way. */
export interface CreatedInvite {
  invite: FriendInvite;
  posted: boolean;
}

export interface Friends {
  friends: Friend[];
  sent: FriendInvite[];
  received: FriendInvite[];
}

export interface Config {
  mapsBrowserKey: string | null;
}

export interface VoiceParse {
  applied: boolean;
  transcript: string;
  params: BrewParams;
  changes: string[];
  summary: string;
}

export type Provenance = "extracted" | "partial" | "missing";
export interface ExtractedField {
  value: string | null;
  provenance: Provenance;
}
export interface DeclaredNote {
  text: string;
  category: string | null;
}
export interface LabelScan {
  scanId: string;
  extracted: boolean;
  reason: string | null;
  roaster: ExtractedField;
  bean: ExtractedField;
  origin: ExtractedField;
  process: ExtractedField;
  roastDate: ExtractedField;
  producer: ExtractedField;
  varietal: ExtractedField;
  altitude: ExtractedField;
  roastLevel: ExtractedField;
  weight: ExtractedField;
  declaredNotes: DeclaredNote[];
}
