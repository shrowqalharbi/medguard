/**
 * The printed stage props must scan into the right patient / drug in the app.
 * Renders each code to PNG, decodes it with the same ZXing library the camera
 * uses, and runs the result through the app's scan resolver.
 */
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library'
import bwipjs from 'bwip-js'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { resolveScan } from '../src/lib/resolve'
// @ts-expect-error plain JS module
import { PACKS, drugs, hajjPayload, packPayload, patients, pilgrims } from './make-labels.mjs'

const hints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]],
  [DecodeHintType.TRY_HARDER, true],
])

async function decode(bcid: string, text: string): Promise<string> {
  const buf = await bwipjs.toBuffer({ bcid, text, scale: 4, paddingwidth: 10, paddingheight: 10, backgroundcolor: 'FFFFFF' })
  const png = PNG.sync.read(buf)
  const lum = new Uint8ClampedArray(png.width * png.height)
  for (let i = 0; i < lum.length; i++) lum[i] = png.data[i * 4] // greyscale: red channel is enough
  const source = new RGBLuminanceSource(lum, png.width, png.height)
  const reader = new MultiFormatReader()
  reader.setHints(hints)
  return reader.decode(new BinaryBitmap(new HybridBinarizer(source))).getText()
}

describe('printed labels scan correctly', () => {
  for (const p of patients as { recordNo: string; id: string }[]) {
    it(`wristband ${p.recordNo} → health record`, async () => {
      const r = resolveScan(await decode('code128', p.recordNo))
      expect(r).toMatchObject({ kind: 'patient', patient: { id: p.id, source: 'ehr' } })
    })
  }

  for (const p of pilgrims as { recordNo: string; id: string }[]) {
    it(`KKJH card ${p.recordNo} → Indonesian pilgrim`, async () => {
      const r = resolveScan(await decode('qrcode', hajjPayload(p.recordNo)))
      expect(r).toMatchObject({ kind: 'patient', patient: { id: p.id, source: 'kkjh' } })
    })
  }

  for (const pack of PACKS as { id: string; expiry: string; batch: string; expired?: boolean }[]) {
    it(`pack ${pack.id} ${pack.batch} → drug with expiry`, async () => {
      const d = (drugs as { id: string; gtin: string }[]).find((x) => x.id === pack.id)!
      const r = resolveScan(await decode('gs1datamatrix', packPayload(d.gtin, pack)))
      expect(r.kind).toBe('drug')
      if (r.kind !== 'drug') return
      expect(r.drug.id).toBe(pack.id)
      expect(r.pack?.batch).toBe(pack.batch)
      expect(r.pack?.expiry?.startsWith(`20${pack.expiry.slice(0, 2)}-${pack.expiry.slice(2, 4)}`)).toBe(true)
    })
  }
})
