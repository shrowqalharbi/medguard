/**
 * MEDGUARD engine types.
 *
 * The engine is pure and UI-agnostic: it takes a patient, a scanned drug and
 * (optionally) findings produced by the AI note analyzer, and returns ONE
 * decision plus the list of lower-priority findings it chose not to interrupt
 * the nurse with.
 */

/** Ordered from most to least severe. Order matters: see SEVERITY_RANK. */
export type Severity = 'critical' | 'interaction' | 'renal' | 'info'

/** The single signal shown to the nurse. */
export type Level = 'critical' | 'interaction' | 'renal' | 'safe'

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  interaction: 2,
  renal: 1,
  info: 0,
}

export type FindingKind =
  | 'allergy'
  | 'allergy-from-note'
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
  /** 'rule' = deterministic clinical rule. 'ai' = raised by the note analyzer. */
  source: 'rule' | 'ai'
  title: string
  detail: string
  /** Verbatim text the finding is based on (e.g. the clinical note). */
  evidence?: string
  /** For AI findings: which analyzer produced it. */
  detectedBy?: 'llm' | 'lexicon'
  /** Model-estimated probability the nurse would dismiss this as noise (0..1). */
  noiseScore?: number
}

export interface DrugFamilyAllergy {
  family: string
  reaction: string
  recordedAt?: string
  /** Where the allergy came from. Missing = the hospital record. */
  source?: 'hospital' | 'hajj-card'
}

/** Identity and declared health data read from a pilgrim's Hajj card. */
export interface HajjInfo {
  pilgrimId: string
  nameLatin: string
  nationality: string
  language: string
  campaign: string
  emergencyContact?: string
}

export interface ClinicalNote {
  date: string
  author: string
  text: string
}

export interface Patient {
  id: string
  wristband: string
  name: string
  age: number
  bloodType?: string
  room: string
  ward: string
  allergies: DrugFamilyAllergy[]
  /** Drug ids the patient is currently receiving. */
  currentMeds: string[]
  /** Latest kidney function. Missing for patients with no lab result yet (e.g. a pilgrim from the ER). */
  egfr?: { value: number; measuredAt: string; source: string }
  /** Chronic conditions, e.g. 'ckd', 'diabetes'. 'ckd' raises the renal checks when eGFR is missing. */
  conditions?: string[]
  clinicalNotes: ClinicalNote[]
  /** Set when the patient was identified by a Hajj card instead of a hospital wristband. */
  hajj?: HajjInfo
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
  /** Brand names clinicians might write in free-text notes. */
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
  /** major → interaction (orange); minor → info (deferred). */
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
  /** Findings from the AI clinical-note analyzer. Can only ADD risk. */
  aiFindings?: Finding[]
  /** ISO date used for expiry checks. Injected so tests are deterministic. */
  today: string
}

export interface Decision {
  level: Level
  /** The one finding that decided the colour (null when safe). */
  primary: Finding | null
  /** Everything else, most important first. Shown collapsed under the result. */
  deferred: Finding[]
  /** Plain-language reason for the colour. */
  explanation: string
  adjustedDose?: string
  /** Every finding the engine produced, for the audit log. */
  all: Finding[]
}
