import { parseScan, type Drug, type Patient, type ScannedPack } from '../engine'
import { findDrugByGtin, findPatientByWristband, findPilgrim, parseHajjCard, type PilgrimRecord } from '../data'

/** Turns raw scanner text into a patient, a drug, or a clear reason why not. */

export type Resolved =
  | { kind: 'patient'; patient: Patient }
  | { kind: 'drug'; drug: Drug; pack?: ScannedPack }
  /** A Hajj card QR. `pilgrim` is missing when the card is valid but not in the health registry. */
  | { kind: 'pilgrim'; pilgrimId: string; pilgrim?: PilgrimRecord }
  | { kind: 'unknown'; value: string }

/** EAN-13 / UPC-A printed on some packs → GTIN-14 by left-padding. */
const toGtin14 = (digits: string) => digits.padStart(14, '0')

export function resolveScan(text: string): Resolved {
  const scan = parseScan(text)

  if (scan.type === 'gs1') {
    const drug = scan.pack.gtin ? findDrugByGtin(scan.pack.gtin) : undefined
    return drug ? { kind: 'drug', drug, pack: scan.pack } : { kind: 'unknown', value: scan.pack.gtin ?? text }
  }

  const pilgrimId = parseHajjCard(scan.value)
  if (pilgrimId) return { kind: 'pilgrim', pilgrimId, pilgrim: findPilgrim(pilgrimId) }

  const patient = findPatientByWristband(scan.value)
  if (patient) return { kind: 'patient', patient }

  if (/^\d{8,14}$/.test(scan.value)) {
    const drug = findDrugByGtin(toGtin14(scan.value))
    if (drug) return { kind: 'drug', drug }
  }
  return { kind: 'unknown', value: scan.value }
}
