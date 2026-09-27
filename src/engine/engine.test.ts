import { describe, expect, it } from 'vitest'
import { drugs, findDrugById, interactions, patients } from '../data'
import { evaluate, lexiconAnalyze, parseScan, signalsToFindings, type Finding } from './index'

const TODAY = '2026-10-01'
const ctx = { drugs, interactions }
const abdullah = patients.find((p) => p.id === 'p-abdullah')!
const saad = patients.find((p) => p.id === 'p-saad')!
const drug = (id: string) => findDrugById(id)!

const run = (patientId: 'abdullah' | 'saad', drugId: string, extra = {}) =>
  evaluate(
    { patient: patientId === 'abdullah' ? abdullah : saad, drug: drug(drugId), today: TODAY, ...extra },
    ctx,
  )

describe('demo scenarios — patient Abdullah (penicillin allergy, eGFR 38, on warfarin)', () => {
  it('paracetamol → green, minor notes deferred silently', () => {
    const d = run('abdullah', 'paracetamol')
    expect(d.level).toBe('safe')
    expect(d.primary).toBeNull()
    expect(d.deferred.length).toBeGreaterThan(0)
    expect(d.deferred.every((f) => f.severity === 'info')).toBe(true)
  })

  it('metformin → yellow with the adjusted dose', () => {
    const d = run('abdullah', 'metformin')
    expect(d.level).toBe('renal')
    expect(d.primary?.kind).toBe('renal-adjust')
    expect(d.adjustedDose).toBe('500 ملغ مرتين يومياً')
  })

  it('ibuprofen → orange (warfarin), kidney caution deferred underneath', () => {
    const d = run('abdullah', 'ibuprofen')
    expect(d.level).toBe('interaction')
    expect(d.primary?.kind).toBe('interaction')
    expect(d.deferred.map((f) => f.kind)).toContain('renal-avoid')
  })

  it('amoxicillin → red; interaction and renal notes are deferred, not shown as extra alerts', () => {
    const d = run('abdullah', 'amoxicillin')
    expect(d.level).toBe('critical')
    expect(d.primary?.kind).toBe('allergy')
    const kinds = d.deferred.map((f) => f.kind)
    expect(kinds).toEqual(expect.arrayContaining(['interaction', 'renal-near-threshold', 'routine']))
  })

  it('shows exactly one decision no matter how many findings exist', () => {
    const d = run('abdullah', 'amoxicillin')
    expect(d.all.length).toBeGreaterThanOrEqual(4)
    expect(d.all.length).toBe(d.deferred.length + 1)
  })
})

describe('AI clinical-note analysis — patient Saad (no recorded allergy)', () => {
  const aiFor = (drugId: string) =>
    signalsToFindings(lexiconAnalyze(saad.clinicalNotes, drugs), saad.clinicalNotes, drug(drugId), 'lexicon')

  it('rules alone would say green', () => {
    expect(run('saad', 'amoxicillin').level).toBe('safe')
  })

  it('AI finds the Augmentin reaction in a free-text note and escalates to red', () => {
    const d = run('saad', 'amoxicillin', { aiFindings: aiFor('amoxicillin') })
    expect(d.level).toBe('critical')
    expect(d.primary?.kind).toBe('allergy-from-note')
    expect(d.primary?.evidence).toContain('أوجمنتين')
  })

  it('AI does not flag unrelated drugs', () => {
    expect(aiFor('paracetamol')).toHaveLength(0)
  })

  it('discards AI signals whose quote is not in the record (anti-hallucination)', () => {
    const invented = [{ family: 'penicillin', product: 'X', reaction: 'rash', quote: 'نص غير موجود' }]
    expect(signalsToFindings(invented, saad.clinicalNotes, drug('amoxicillin'), 'llm')).toHaveLength(0)
  })
})

describe('safety guarantees', () => {
  it('AI can never lower a red decision', () => {
    const fake: Finding = {
      id: 'x',
      kind: 'routine',
      severity: 'info',
      source: 'ai',
      title: 'safe',
      detail: 'the model thinks this is fine',
    }
    const d = run('abdullah', 'amoxicillin', { aiFindings: [fake] })
    expect(d.level).toBe('critical')
    expect(d.all.find((f) => f.id === 'x')).toBeUndefined()
  })

  it('non-critical AI output is ignored entirely', () => {
    const d = run('saad', 'amoxicillin', {
      aiFindings: [{ id: 'y', kind: 'interaction', severity: 'interaction', source: 'ai', title: '', detail: '' }],
    })
    expect(d.level).toBe('safe')
  })

  it('an expired pack is red even for a safe drug', () => {
    const d = run('abdullah', 'paracetamol', { pack: { expiry: '2026-01-31' } })
    expect(d.level).toBe('critical')
    expect(d.primary?.kind).toBe('expired')
  })

  it('metformin below eGFR 30 is blocked, not just adjusted', () => {
    const low = { ...abdullah, egfr: { ...abdullah.egfr, value: 24 } }
    const d = evaluate({ patient: low, drug: drug('metformin'), today: TODAY }, ctx)
    expect(d.level).toBe('critical')
    expect(d.primary?.kind).toBe('renal-contraindicated')
  })
})

describe('ranking model', () => {
  it('orders deferred findings of equal severity by predicted noise', () => {
    const d = run('abdullah', 'amoxicillin')
    const info = d.deferred.filter((f) => f.severity === 'info')
    const scores = info.map((f) => f.noiseScore ?? 0)
    expect(scores).toEqual([...scores].sort((a, b) => a - b))
  })

  it('learns from overrides: a frequently overridden kind scores as noisier', () => {
    const base = run('abdullah', 'ibuprofen').primary!.noiseScore!
    const log = Array.from({ length: 10 }, () => ({ kind: 'interaction' as const, drugId: 'ibuprofen', reason: 'الطبيب على علم' }))
    const after = evaluate({ patient: abdullah, drug: drug('ibuprofen'), today: TODAY }, { ...ctx, overrideLog: log })
    expect(after.primary!.noiseScore!).toBeGreaterThan(base)
    // ...but the colour does not change: the model ranks, the rules decide.
    expect(after.level).toBe('interaction')
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
    expect(parseScan('A-2291')).toEqual({ type: 'code', value: 'A-2291' })
  })
})
