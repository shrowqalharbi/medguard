import { describe, expect, it } from 'vitest'
import { generateDemoLog } from './demoLog'
import { summarize } from './summarize'

describe('dashboard summary', () => {
  const log = generateDemoLog()
  const s = summarize(log)

  it('is deterministic', () => {
    expect(summarize(generateDemoLog())).toEqual(s)
  })

  it('counts add up', () => {
    expect(s.total).toBe(1248)
    expect(s.counts.critical + s.counts.warning + s.counts.safe).toBe(s.total)
    expect(s.byDay.reduce((a, d) => a + d.total, 0)).toBe(s.total)
    expect(Object.values(s.redByCause).reduce((a, b) => a + b, 0)).toBe(s.counts.critical)
    expect(Object.values(s.orangeOutcome).reduce((a, b) => a + b, 0)).toBe(s.counts.warning)
    expect(Object.values(s.reasons).reduce((a, b) => a + b, 0)).toBe(s.withReason)
    expect(s.ranking.claude + s.ranking.fallback).toBe(s.ranking.rankable)
  })

  it('never ranks red and never blocks kidney checks without eGFR', () => {
    expect(log.some((c) => c.level === 'critical' && c.rankable)).toBe(false)
    expect(log.some((c) => c.egfrMissing && c.redCause === 'renal')).toBe(false)
  })

  it('interrupts only for orange and red', () => {
    expect(s.interruptions).toBe(s.counts.critical + s.counts.warning)
    expect(s.interruptions).toBeLessThan(s.popups)
  })
})
