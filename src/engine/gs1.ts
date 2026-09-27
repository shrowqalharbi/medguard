import type { ScannedPack } from './types'

/**
 * GS1 barcode parsing.
 *
 * Medicine packs carry a GS1 DataMatrix with Application Identifiers:
 *   (01) GTIN, 14 digits      (17) expiry YYMMDD
 *   (10) batch, variable      (21) serial, variable
 * Variable-length fields end with the FNC1 separator (ASCII 29).
 * We also accept the human-readable form "(01)...(17)..." so labels can be
 * typed or printed for the demo.
 */

const GS = String.fromCharCode(29)

export type ScanResult =
  | { type: 'gs1'; pack: ScannedPack }
  | { type: 'code'; value: string }

function expiryToIso(yymmdd: string): string {
  const yy = Number(yymmdd.slice(0, 2))
  const mm = yymmdd.slice(2, 4)
  let dd = yymmdd.slice(4, 6)
  // GS1: day "00" means the last day of the month.
  if (dd === '00') {
    const last = new Date(Date.UTC(2000 + yy, Number(mm), 0)).getUTCDate()
    dd = String(last).padStart(2, '0')
  }
  return `${2000 + yy}-${mm}-${dd}`
}

function parseBracketed(text: string): ScannedPack | null {
  const re = /\((\d{2})\)([^(]*)/g
  const pack: ScannedPack = {}
  let found = false
  for (const m of text.matchAll(re)) {
    found = true
    assign(pack, m[1], m[2].trim())
  }
  return found ? pack : null
}

function parseRaw(raw: string): ScannedPack | null {
  let s = raw.replace(/^\]d2|^\]Q3|^\]C1/, '')
  if (s.startsWith(GS)) s = s.slice(1)
  if (!/^(01|17|10|21)/.test(s)) return null

  const pack: ScannedPack = {}
  while (s.length >= 2) {
    const ai = s.slice(0, 2)
    s = s.slice(2)
    if (ai === '01') {
      assign(pack, ai, s.slice(0, 14))
      s = s.slice(14)
    } else if (ai === '17') {
      assign(pack, ai, s.slice(0, 6))
      s = s.slice(6)
    } else if (ai === '10' || ai === '21') {
      const end = s.indexOf(GS)
      assign(pack, ai, end === -1 ? s : s.slice(0, end))
      s = end === -1 ? '' : s.slice(end + 1)
    } else {
      break // unknown AI: stop rather than guess
    }
  }
  return pack.gtin ? pack : null
}

function assign(pack: ScannedPack, ai: string, value: string) {
  if (ai === '01') pack.gtin = value
  else if (ai === '17' && /^\d{6}$/.test(value)) pack.expiry = expiryToIso(value)
  else if (ai === '10') pack.batch = value
  else if (ai === '21') pack.serial = value
}

export function parseScan(text: string): ScanResult {
  const trimmed = text.trim()
  const pack = trimmed.includes('(') ? parseBracketed(trimmed) : parseRaw(trimmed)
  if (pack?.gtin) return { type: 'gs1', pack }
  return { type: 'code', value: trimmed }
}
