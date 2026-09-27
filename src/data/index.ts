import type { Drug, InteractionRule, Patient } from '../engine/types'
import drugsJson from './drugs.json'
import interactionsJson from './interactions.json'
import patientsJson from './patients.json'

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
