import { parseScan, type Drug, type Patient, type ScannedPack } from '../engine'
import { NATIONAL_ID, findByRecordNo, findDrugByGtin, parseKkjh } from '../data'

/** Turns raw scanner text into a pilgrim, a drug, or a clear reason why not. */

export type Resolved =
  | { kind: 'patient'; patient: Patient }
  | { kind: 'drug'; drug: Drug; pack?: ScannedPack }
  /** A valid ID or KKJH card with no record behind it. */
  | { kind: 'no-record'; source: Patient['source']; recordNo: string }
  | { kind: 'unknown'; value: string }

/** EAN-13 / UPC-A printed on some packs → GTIN-14 by left-padding. */
const toGtin14 = (digits: string) => digits.padStart(14, '0')

export function resolveScan(text: string): Resolved {
  const scan = parseScan(text)

  if (scan.type === 'gs1') {
    const drug = scan.pack.gtin ? findDrugByGtin(scan.pack.gtin) : undefined
    return drug ? { kind: 'drug', drug, pack: scan.pack } : { kind: 'unknown', value: scan.pack.gtin ?? text }
  }

  // Indonesian Hajj health card (QR).
  const kkjh = parseKkjh(scan.value)
  if (kkjh) {
    const patient = findByRecordNo(kkjh, 'kkjh')
    return patient ? { kind: 'patient', patient } : { kind: 'no-record', source: 'kkjh', recordNo: kkjh }
  }

  // Any record number typed or printed bare (wristband, or the number on a KKJH card).
  const byNo = findByRecordNo(scan.value)
  if (byNo) return { kind: 'patient', patient: byNo }
  if (NATIONAL_ID.test(scan.value)) return { kind: 'no-record', source: 'ehr', recordNo: scan.value }

  if (/^\d{8,14}$/.test(scan.value)) {
    const drug = findDrugByGtin(toGtin14(scan.value))
    if (drug) return { kind: 'drug', drug }
  }
  return { kind: 'unknown', value: scan.value }
}
