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
  features: { labelReading: boolean; speechTranscription: boolean };
  /** When the first-sign-in guide was finished or skipped; null until then. */
  onboardedAt: string | null;
}

export interface Bean {
  id: string;
  name: string;
  roaster: string | null;
  origin: string | null;
  process: string | null;
  roastDate: string | null;
  producer: string | null;
  varietal: string | null;
  altitude: string | null;
  roastLevel: string | null;
  declaredNotes: string[];
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
  labelScanId?: string | null;
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
  declaredNotes: DeclaredNote[];
}
