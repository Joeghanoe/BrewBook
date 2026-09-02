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
