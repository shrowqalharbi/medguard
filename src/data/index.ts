import type { Drug, InteractionRule, Patient } from '../engine/types'
import drugsJson from './drugs.json'
import interactionsJson from './interactions.json'
import ordersJson from './orders.json'
import patientsJson from './patients.json'

/**
 * DEMO DATA ONLY. Invented pilgrims, invented ID numbers, invented GTINs
 * (prefix 628-999). Clinical values must be reviewed and signed off by the
 * nursing team before the demo. See docs/data-template.csv.
 *
 * In production each pilgrim's critical health profile comes from:
 *   - Saudi citizens and residents: the electronic health record (HL7 FHIR),
 *     looked up by the national ID / iqama number on the wristband.
 *   - Indonesian pilgrims: the Hajj health card KKJH, an International
 *     Patient Summary (IPS, built on FHIR) behind the card's QR code.
 * Only the critical profile is read: allergies, current medicines, chronic
 * conditions, latest eGFR and blood type. Never the whole record.
 */
export const drugs = drugsJson as Drug[]
export const interactions = interactionsJson as InteractionRule[]
export const patients = patientsJson as Patient[]

/** Pharmacy orders behind patient-specific labels (unit-dose packs dispensed for ONE patient). */
export interface PharmacyOrder {
  orderNo: string
  patientId: string
  drugId: string
  dose: string
  dispensedAt: string
}
export const orders = ordersJson as PharmacyOrder[]

/** Pharmacy label barcode: "RX:<order number>". */
export const rxPayload = (orderNo: string) => `RX:${orderNo}`
export function parseRx(text: string): string | null {
  const m = /^RX\s*[:|]\s*(RX-\d{4,10})$/i.exec(text.trim())
  return m ? m[1].toUpperCase() : null
}
export const findOrder = (orderNo: string) => orders.find((o) => o.orderNo === orderNo)

export const findDrugByGtin = (gtin: string) => drugs.find((d) => d.gtin === gtin)
export const findDrugById = (id: string) => drugs.find((d) => d.id === id)

/** Saudi national ID (starts with 1) or iqama (starts with 2): 10 digits. */
export const NATIONAL_ID = /^[12]\d{9}$/

/** QR on the Indonesian Hajj health card carries "KKJH:<registration number>". */
export const kkjhPayload = (recordNo: string) => `KKJH:${recordNo}`

/** Returns the KKJH registration number in a card QR, or null when it is not a KKJH card. */
export function parseKkjh(text: string): string | null {
  const m = /^KKJH\s*[:|]\s*(\d{6,16})$/i.exec(text.trim())
  return m ? m[1] : null
}

export const findByRecordNo = (no: string, source?: Patient['source']) =>
  patients.find((p) => p.recordNo === no.trim() && (!source || p.source === source))

export const SOURCE_AR: Record<Patient['source'], string> = {
  ehr: 'السجل الصحي الإلكتروني',
  kkjh: 'بطاقة الحاج الصحية KKJH (IPS)',
}

export const CONDITION_AR: Record<string, string> = {
  ckd: 'مرض كلى مزمن',
  diabetes: 'سكري',
  hypertension: 'ضغط دم مرتفع',
  'atrial-fibrillation': 'رجفان أذيني',
}
