import { afterEach, describe, expect, it, vi } from 'vitest'
import { drugs, findDrugById, interactions, kkjhPayload, parseKkjh, patients } from '../data'
import { rankWithClaude } from '../lib/ranking'
import { resolveScan } from '../lib/resolve'
import { applyRanking, evaluate, needsRanking, parseScan, rankable, toRankPayload, type Decision } from './index'

const TODAY = '2026-10-01'
const ctx = { drugs, interactions }
const pilgrim = (id: string) => patients.find((p) => p.id === id)!
const fahad = pilgrim('p-fahad') // Saudi, EHR: penicillin allergy, warfarin, eGFR 38, 66
const ahmed = pilgrim('p-ahmed') // resident, EHR: CKD, eGFR 24
const siti = pilgrim('p-siti') // Indonesian, KKJH: 72, warfarin, NO eGFR
const budi = pilgrim('p-budi') // Indonesian, KKJH: NSAID allergy, eGFR 52
const drug = (id: string) => findDrugById(id)!
const on = (patient: typeof fahad, drugId: string, extra = {}) =>
  evaluate({ patient, drug: drug(drugId), today: TODAY, ...extra }, ctx)

describe('three colours only', () => {
  it('every scenario lands on red, orange or green — never yellow', () => {
    for (const p of patients)
      for (const d of drugs) expect(['critical', 'warning', 'safe']).toContain(on(p, d.id).level)
  })
})

describe('Saudi pilgrim, health record (Fahad: penicillin allergy, warfarin, eGFR 38)', () => {
  it('paracetamol → green, minor notes deferred silently', () => {
    const d = on(fahad, 'paracetamol')
    expect(d.level).toBe('safe')
    expect(d.primary).toBeNull()
    expect(d.deferred.length).toBeGreaterThan(0)
    expect(d.deferred.every((f) => f.severity === 'info')).toBe(true)
  })

  it('metformin → orange (was yellow) with the suggested dose', () => {
    const d = on(fahad, 'metformin')
    expect(d.level).toBe('warning')
    expect(d.primary?.kind).toBe('renal-adjust')
    expect(d.adjustedDose).toBe('500 ملغ مرتين يومياً')
  })

  it('ibuprofen → orange with two orange alerts (warfarin + kidneys)', () => {
    const d = on(fahad, 'ibuprofen')
    expect(d.level).toBe('warning')
    expect(d.primary?.kind).toBe('interaction') // fallback order
    expect(d.deferred.map((f) => f.kind)).toContain('renal-avoid')
  })

  it('amoxicillin → red from the recorded allergy; other notes deferred', () => {
    const d = on(fahad, 'amoxicillin')
    expect(d.level).toBe('critical')
    expect(d.primary?.kind).toBe('allergy')
    expect(d.primary?.detail).toContain('السجل الصحي')
    expect(d.deferred.map((f) => f.kind)).toEqual(expect.arrayContaining(['interaction', 'renal-near-threshold']))
  })

  it('shows exactly one decision no matter how many findings exist', () => {
    const d = on(fahad, 'amoxicillin')
    expect(d.all.length).toBeGreaterThanOrEqual(3)
    expect(d.all.length).toBe(d.deferred.length + 1)
  })

  it('an expired pack is red even for a safe drug', () => {
    const d = on(fahad, 'paracetamol', { pack: { expiry: '2026-01-31' } })
    expect(d.level).toBe('critical')
    expect(d.primary?.kind).toBe('expired')
  })
})

describe('resident pilgrim, health record (Ahmed: CKD, eGFR 24)', () => {
  it('metformin below eGFR 30 is red (forbidden), not just adjusted', () => {
    const d = on(ahmed, 'metformin')
    expect(d.level).toBe('critical')
    expect(d.primary?.kind).toBe('renal-contraindicated')
  })

  it('amoxicillin below eGFR 30 → orange with the suggested dose', () => {
    const d = on(ahmed, 'amoxicillin')
    expect(d.level).toBe('warning')
    expect(d.adjustedDose).toBe('500 ملغ كل 12 ساعة')
  })

  it('ibuprofen with weak kidneys → orange', () => {
    expect(on(ahmed, 'ibuprofen').level).toBe('warning')
  })
})

describe('Indonesian pilgrim, KKJH card', () => {
  it('a recorded allergy on the card is red (Budi + ibuprofen)', () => {
    const d = on(budi, 'ibuprofen')
    expect(d.level).toBe('critical')
    expect(d.primary?.kind).toBe('allergy')
    expect(d.primary?.detail).toContain('KKJH')
  })

  it('the pre-departure eGFR on the card is used (Budi: 52, not missing)', () => {
    expect(on(budi, 'paracetamol').renalMissing).toBe(false)
  })

  it('missing eGFR: the system does not stop, it flags the gap (Siti + paracetamol)', () => {
    const d = on(siti, 'paracetamol')
    expect(d.level).toBe('safe')
    expect(d.renalMissing).toBe(true)
  })

  it('missing eGFR + age 72 + kidney-dosed drug → orange, asks for a kidney test', () => {
    const d = on(siti, 'metformin')
    expect(d.level).toBe('warning')
    expect(d.primary?.kind).toBe('renal-unknown')
    expect(d.adjustedDose).toBeUndefined()
  })

  it('card medicines feed the interaction check (warfarin + ibuprofen → orange)', () => {
    const d = on(siti, 'ibuprofen')
    expect(d.level).toBe('warning')
    expect(d.all.map((f) => f.kind)).toEqual(expect.arrayContaining(['interaction', 'renal-unknown']))
  })

  it('a young pilgrim with no eGFR and no kidney disease is not interrupted', () => {
    const young = { ...siti, age: 40, currentMeds: [], conditions: [] }
    const d = on(young, 'amoxicillin')
    expect(d.level).toBe('safe')
    expect(d.deferred.map((f) => f.kind)).toContain('renal-unknown')
  })
})

/* ------------------------------------------------------------- AI ranking */

const orderOf = (_: Decision, ids: string[]) => ids.map((id) => ({ id, reason: `سبب ${id}` }))
const idsOf = (d: Decision) => rankable(d).map((f) => f.id)

describe('Claude alert ranking — safety guards', () => {
  it('critical findings are never sent to Claude', () => {
    const d = on(fahad, 'amoxicillin')
    const sent = toRankPayload(rankable(d))
    expect(sent.some((a) => (a as { severity: string }).severity === 'critical')).toBe(false)
    expect(sent.map((a) => a.id)).not.toContain(d.primary!.id)
  })

  it('no patient identity is sent: only alert text', () => {
    const sent = JSON.stringify(toRankPayload(rankable(on(fahad, 'ibuprofen'))))
    expect(sent).not.toContain(fahad.name)
    expect(sent).not.toContain(fahad.recordNo)
    for (const a of toRankPayload(rankable(on(fahad, 'ibuprofen'))))
      expect(Object.keys(a).sort()).toEqual(['detail', 'id', 'kind', 'severity', 'title'])
  })

  it('Claude can choose which orange alert is shown first, but the colour stays orange', () => {
    const d = on(fahad, 'ibuprofen')
    const ids = idsOf(d)
    const avoid = ids.find((id) => id.startsWith('renal:avoid'))!
    const r = applyRanking(d, orderOf(d, [avoid, ...ids.filter((i) => i !== avoid)]))!
    expect(r.level).toBe('warning')
    expect(r.primary?.kind).toBe('renal-avoid')
    expect(r.primary?.rankReason).toBe(`سبب ${avoid}`)
    expect(r.rankedBy).toBe('claude')
    expect(r.all).toHaveLength(d.all.length)
  })

  it('Claude cannot put an info note above an orange alert', () => {
    const d = on(fahad, 'ibuprofen')
    const ids = idsOf(d)
    const r = applyRanking(d, orderOf(d, [...ids].reverse()))!
    expect(r.primary?.severity).toBe('warning')
    const sev = r.deferred.map((f) => f.severity)
    expect(sev).toEqual([...sev].sort((a, b) => (a === b ? 0 : a === 'warning' ? -1 : 1)))
  })

  it('a red decision stays red with the same primary, whatever Claude says', () => {
    const d = on(fahad, 'amoxicillin')
    const r = applyRanking(d, orderOf(d, [...idsOf(d)].reverse()))!
    expect(r.level).toBe('critical')
    expect(r.primary?.id).toBe(d.primary?.id)
  })

  it('a green decision stays green', () => {
    const d = on(fahad, 'paracetamol')
    expect(needsRanking(d)).toBe(true)
    const r = applyRanking(d, orderOf(d, [...idsOf(d)].reverse()))!
    expect(r.level).toBe('safe')
    expect(r.primary).toBeNull()
  })

  it('rejects a reply with a missing, extra, duplicated or invented alert', () => {
    const d = on(fahad, 'ibuprofen')
    const ids = idsOf(d)
    expect(applyRanking(d, orderOf(d, ids.slice(1)))).toBeNull()
    expect(applyRanking(d, orderOf(d, [...ids, 'invented']))).toBeNull()
    expect(applyRanking(d, orderOf(d, [ids[0], ...ids.slice(0, -1)]))).toBeNull()
    expect(applyRanking(d, orderOf(d, ['invented', ...ids.slice(1)]))).toBeNull()
    expect(applyRanking(d, 'not a list')).toBeNull()
    expect(applyRanking(d, [{ id: ids[0] }, ...orderOf(d, ids.slice(1))])).toBeNull()
  })
})

describe('Claude alert ranking — network behaviour', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('uses Claude order when the reply is valid', async () => {
    const d = on(siti, 'ibuprofen')
    const ids = idsOf(d)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ order: orderOf(d, [...ids].reverse()) }))))
    const r = await rankWithClaude(d)
    expect(r.rankedBy).toBe('claude')
    expect(r.level).toBe('warning')
  })

  it('keeps the fallback order when offline / the call fails', async () => {
    const d = on(budi, 'metformin')
    const e = on(ahmed, 'ibuprofen')
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    for (const x of [d, e]) expect(await rankWithClaude(x)).toBe(x)
  })

  it('gives up after 2 seconds and keeps the fallback order', async () => {
    vi.useFakeTimers()
    const d = on(ahmed, 'amoxicillin')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_: string, init: RequestInit) =>
          new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      ),
    )
    const p = rankWithClaude(d)
    await vi.advanceTimersByTimeAsync(2000)
    const r = await p
    expect(r.rankedBy).toBe('fallback')
    expect(r).toBe(d)
  })

  it('never calls Claude when there is nothing to order (Ahmed + metformin: red + one note)', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const d = on(ahmed, 'metformin')
    expect(d.level).toBe('critical')
    expect(await rankWithClaude(d)).toBe(d)
    expect(f).not.toHaveBeenCalled()
  })

  it('the request body never contains the red finding or the pilgrim (Fahad + amoxicillin)', async () => {
    const d = on(fahad, 'amoxicillin')
    let body = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_: string, init: RequestInit) => {
        body = String(init.body)
        return new Response('{}', { status: 503 })
      }),
    )
    const r = await rankWithClaude(d)
    expect(r).toBe(d)
    expect(body).not.toContain(d.primary!.id)
    expect(body).not.toContain('critical')
    expect(body).not.toContain(fahad.name)
  })
})

/* ------------------------------------------------------------- scanning */

describe('scanning a pilgrim', () => {
  it('a Saudi / resident wristband (national ID or iqama) → health record', () => {
    expect(resolveScan('1034567812')).toMatchObject({ kind: 'patient', patient: { id: 'p-fahad', source: 'ehr' } })
    expect(resolveScan('2456789013')).toMatchObject({ kind: 'patient', patient: { id: 'p-ahmed' } })
  })

  it('a KKJH card QR → Indonesian health card', () => {
    expect(parseKkjh(kkjhPayload('0100234567'))).toBe('0100234567')
    expect(resolveScan('KKJH:0100234567')).toMatchObject({ kind: 'patient', patient: { id: 'p-siti', source: 'kkjh' } })
  })

  it('a valid ID with no record behind it is reported, not guessed', () => {
    expect(resolveScan('1999999999')).toEqual({ kind: 'no-record', source: 'ehr', recordNo: '1999999999' })
    expect(resolveScan('KKJH:0199999999')).toEqual({ kind: 'no-record', source: 'kkjh', recordNo: '0199999999' })
  })

  it('drug packs still resolve as drugs', () => {
    expect(resolveScan('(01)06289990000014').kind).toBe('drug')
  })
})

describe('GS1 barcode parsing', () => {
  const GS = String.fromCharCode(29)

  it('parses a raw DataMatrix payload with FNC1 separators', () => {
    const r = parseScan(`01062899900000451727033110BATCH7${GS}21SN001`)
    expect(r).toEqual({
      type: 'gs1',
      pack: { gtin: '06289990000045', expiry: '2027-03-31', batch: 'BATCH7', serial: 'SN001' },
    })
  })

  it('parses the human-readable bracketed form', () => {
    const r = parseScan('(01)06289990000021(17)270200(10)L42')
    // Day "00" = last day of the month.
    expect(r).toEqual({ type: 'gs1', pack: { gtin: '06289990000021', expiry: '2027-02-28', batch: 'L42' } })
  })

  it('treats a wristband code as a plain code', () => {
    expect(parseScan('1034567812')).toEqual({ type: 'code', value: '1034567812' })
  })
})

describe('payload sent to Claude carries no patient measurements', () => {
  const forbidden = [/eGFR:/, /مل\/د/, /العمر/, /مرض كلى/, /مزمن/, /KKJH/, /السجل الصحي/]

  it('for every demo pilgrim and drug', () => {
    let checked = 0
    for (const patient of patients) {
      for (const drug of drugs) {
        const d = on(patient, drug.id)
        const payload = JSON.stringify(toRankPayload(rankable(d)))
        for (const re of forbidden) expect(payload, `${patient.id}/${drug.id}`).not.toMatch(re)
        for (const p of [patient.name, patient.recordNo, String(patient.egfr?.value ?? '@@')]) {
          expect(payload, `${patient.id}/${drug.id}`).not.toContain(p)
        }
        checked++
      }
    }
    expect(checked).toBeGreaterThan(20)
  })
})
