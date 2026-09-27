import type { Drug, InteractionRule, Patient } from '../engine/types'
import drugsJson from './drugs.json'
import interactionsJson from './interactions.json'
import patientsJson from './patients.json'
import pilgrimsJson from './pilgrims.json'

/**
 * DEMO DATA ONLY. Invented patients, invented GTINs (prefix 628-999).
 * Clinical values must be reviewed and signed off by the nursing team
 * before the demo. See docs/data-template.csv.
 */
export const drugs = drugsJson as Drug[]
export const interactions = interactionsJson as InteractionRule[]
export const patients = patientsJson as Patient[]

export const findDrugByGtin = (gtin: string) => drugs.find((d) => d.gtin === gtin)
export const findDrugById = (id: string) => drugs.find((d) => d.id === id)
export const findPatientByWristband = (code: string) =>
  patients.find((p) => p.wristband.toLowerCase() === code.trim().toLowerCase())

/* ------------------------------------------------------------------ Hajj card */

/**
 * DEMO Hajj health registry: what a pilgrim declared at registration and what
 * the QR on their Hajj card points to. Invented people and ids.
 */
export interface PilgrimRecord {
  pilgrimId: string
  name: string
  nameLatin: string
  nationality: string
  language: string
  age: number
  bloodType?: string
  campaign: string
  emergencyContact?: string
  allergies: Patient['allergies']
  conditions: string[]
  currentMeds: string[]
}

export const pilgrims = pilgrimsJson as PilgrimRecord[]

/** Pilgrim number as printed on the card: H-<hijri year>-<6 digits>. */
export const PILGRIM_ID = /^H-\d{4}-\d{6}$/i

/**
 * The card QR carries "HAJJ:<pilgrim id>". A bare id (typed by hand) is accepted too.
 * Returns the normalized pilgrim id, or null when the text is not a Hajj card.
 */
export function parseHajjCard(text: string): string | null {
  const id = text.trim().replace(/^(HAJJ|NUSUK)\s*[:|]\s*/i, '').toUpperCase()
  return PILGRIM_ID.test(id) ? id : null
}

export const findPilgrim = (id: string) => pilgrims.find((p) => p.pilgrimId === id.toUpperCase())

/**
 * A pilgrim with no hospital wristband becomes a temporary patient built from
 * the card. There is no lab result yet, so eGFR is missing on purpose: the
 * engine then asks for a kidney test instead of assuming normal kidneys.
 */
export function pilgrimToPatient(p: PilgrimRecord): Patient {
  return {
    id: `hajj:${p.pilgrimId}`,
    wristband: p.pilgrimId,
    name: p.name,
    age: p.age,
    bloodType: p.bloodType,
    room: 'الطوارئ',
    ward: 'الطوارئ — مرضى الحج',
    allergies: p.allergies.map((a) => ({ ...a, source: 'hajj-card' as const })),
    currentMeds: p.currentMeds,
    conditions: p.conditions,
    clinicalNotes: [],
    hajj: {
      pilgrimId: p.pilgrimId,
      nameLatin: p.nameLatin,
      nationality: p.nationality,
      language: p.language,
      campaign: p.campaign,
      emergencyContact: p.emergencyContact,
    },
  }
}

export const CONDITION_AR: Record<string, string> = {
  ckd: 'مرض كلى مزمن',
  diabetes: 'سكري',
  hypertension: 'ضغط دم مرتفع',
  'atrial-fibrillation': 'رجفان أذيني',
}
