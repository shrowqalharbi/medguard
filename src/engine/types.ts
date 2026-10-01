/**
 * MEDGUARD engine types.
 *
 * The engine is pure and UI-agnostic: it takes a pilgrim's critical health
 * profile and a scanned drug, runs the three safety checks (allergy,
 * interactions, dose vs. kidneys) and returns ONE decision plus the list of
 * lower-priority findings it chose not to interrupt the nurse with.
 *
 * Every check is a deterministic clinical rule on STRUCTURED data. The only
 * AI in the system (Claude) orders the non-critical alerts afterwards; it can
 * never change the colour or hide a critical finding (see alertRanker.ts).
 */

/** Ordered from most to least severe. */
export type Severity = 'critical' | 'warning' | 'info'

/** The single signal shown to the nurse: 🔴 / 🟠 / 🟢. */
export type Level = 'critical' | 'warning' | 'safe'

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 2,
  warning: 1,
  info: 0,
}

export type FindingKind =
  | 'allergy'
  | 'interaction'
  | 'renal-adjust'
  | 'renal-contraindicated'
  | 'renal-near-threshold'
  | 'renal-avoid'
  | 'renal-unknown'
  | 'expired'
  | 'routine'

export interface Finding {
  id: string
  kind: FindingKind
  severity: Severity
  title: string
  detail: string
  /** Why the alert sits where it does in the list. Set by the ranker. */
  rankReason?: string
}

export interface DrugFamilyAllergy {
  family: string
  reaction: string
  recordedAt?: string
}

/**
 * Where the pilgrim's critical health profile was read from.
 *  - 'ehr':  the Saudi electronic health record (citizens and residents),
 *            looked up by the national ID / iqama number on the wristband.
 *  - 'kkjh': the Indonesian Hajj health card (Kartu Kesehatan Jemaah Haji),
 *            an International Patient Summary (IPS) behind the card's QR.
 * Both are HL7 FHIR, so one reader handles both.
 */
export type RecordSource = 'ehr' | 'kkjh'

export interface Patient {
  id: string
  source: RecordSource
  /** National ID / iqama (ehr) or Indonesian Hajj registration number (kkjh). */
  recordNo: string
  name: string
  nameLatin?: string
  /** e.g. 'سعودي', 'مقيم — مصر', 'إندونيسيا'. */
  nationality: string
  /** Spoken language when it is not Arabic. */
  language?: string
  /** Hajj campaign / mission sector. */
  campaign?: string
  emergencyContact?: string
  age: number
  bloodType?: string
  /** Where the pilgrim is being treated right now. */
  bed: string
  unit: string

  // ---- Critical health profile (FHIR resources) ----
  /** AllergyIntolerance */
  allergies: DrugFamilyAllergy[]
  /** MedicationStatement: drug ids the pilgrim currently takes. */
  currentMeds: string[]
  /** Condition: e.g. 'ckd', 'diabetes'. 'ckd' raises the renal checks when eGFR is missing. */
  conditions: string[]
  /** Observation: latest kidney function. Missing when no result is on record. */
  egfr?: { value: number; measuredAt: string; source: string }
}

export interface RenalRule {
  /** Reduce the dose when eGFR is below this value. */
  adjustBelow?: number
  adjustedDose?: string
  /** Do not give at all below this value. */
  contraindicatedBelow?: number
  /** Whole-class caution (e.g. NSAIDs in CKD) below this value. */
  avoidBelow?: number
  avoidReason?: string
}

export interface Drug {
  id: string
  nameAr: string
  nameEn: string
  /** Brand names, used by the search-by-name fallback. */
  brandNames: string[]
  gtin: string
  /** Pharmacological families this product belongs to (e.g. penicillin). */
  families: string[]
  strength: string
  standardDose: string
  renal?: RenalRule
  routineNotes: string[]
}

export interface InteractionRule {
  a: string
  b: string
  /** major → warning (orange); minor → info (deferred). */
  grade: 'major' | 'minor'
  effect: string
}

export interface ScannedPack {
  gtin?: string
  expiry?: string // ISO date YYYY-MM-DD
  batch?: string
  serial?: string
}

export interface EngineInput {
  patient: Patient
  drug: Drug
  pack?: ScannedPack
  /** ISO date used for expiry checks. Injected so tests are deterministic. */
  today: string
}

/** Who put the non-critical alerts in their current order. */
export type RankedBy = 'claude' | 'fallback'

export interface Decision {
  level: Level
  /** The one finding that decided the colour (null when safe). */
  primary: Finding | null
  /** Everything else, most important first. Shown collapsed under the result. */
  deferred: Finding[]
  /** Plain-language reason for the colour. */
  explanation: string
  /** Suggested dose when the kidney rule asks for a reduction. */
  adjustedDose?: string
  /** True when the pilgrim has no eGFR on record: the kidney check could not run fully. */
  renalMissing: boolean
  rankedBy: RankedBy
  /** Every finding the engine produced, for the audit log. */
  all: Finding[]
}
