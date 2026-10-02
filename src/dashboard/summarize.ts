import { DAYS, OVERRIDE_REASONS, type DemoCheck, type OrangeOutcome, type RedCause } from './demoLog'

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

function median(values: number[]) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function countBy<K extends string>(items: DemoCheck[], key: (c: DemoCheck) => K | undefined, keys: readonly K[]) {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  for (const c of items) {
    const k = key(c)
    if (k !== undefined) out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/** Everything the dashboard shows, computed from the administration log. */
export function summarize(log: DemoCheck[]) {
  const red = log.filter((c) => c.level === 'critical')
  const orange = log.filter((c) => c.level === 'warning')
  const green = log.filter((c) => c.level === 'safe')

  // The problem: a conventional system pops every alert. MEDGUARD interrupts
  // the nurse once per risky check (orange or red), never for green.
  const popups = log.reduce((s, c) => s + c.rawAlerts, 0)
  const interruptions = red.length + orange.length

  const byDay = DAYS.map((d, i) => {
    const day = log.filter((c) => c.day === i)
    return {
      ...d,
      total: day.length,
      critical: day.filter((c) => c.level === 'critical').length,
      warning: day.filter((c) => c.level === 'warning').length,
      safe: day.filter((c) => c.level === 'safe').length,
    }
  })
  const peakRed = byDay.reduce((a, b) => (b.critical > a.critical ? b : a))

  const redByCause = countBy<RedCause>(red, (c) => c.redCause, ['allergy', 'renal', 'expired'])
  const orangeOutcome = countBy<OrangeOutcome>(orange, (c) => c.orangeOutcome, [
    'given-adjusted',
    'given-with-reason',
    'escalated',
    'cancelled',
  ])
  const reasons = countBy(orange, (c) => c.overrideReason, OVERRIDE_REASONS)
  const withReason = orangeOutcome['given-with-reason']
  // Every orange continuation carries either a dose adjustment or a written reason.
  const documented = orange.filter((c) => c.orangeOutcome !== undefined).length

  const drugs = new Map<string, { critical: number; warning: number }>()
  for (const c of [...red, ...orange]) {
    const d = drugs.get(c.drug) ?? { critical: 0, warning: 0 }
    d[c.level as 'critical' | 'warning']++
    drugs.set(c.drug, d)
  }
  const topDrugs = [...drugs.entries()]
    .map(([name, v]) => ({ name, ...v, total: v.critical + v.warning }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const sources = (['ehr', 'kkjh'] as const).map((s) => {
    const items = log.filter((c) => c.source === s)
    const missing = items.filter((c) => c.egfrMissing).length
    return { source: s, checks: items.length, egfrMissing: missing, egfrMissingPct: pct(missing, items.length) }
  })

  const rankable = log.filter((c) => c.rankable)
  const byClaude = rankable.filter((c) => c.rankedBy === 'claude').length

  return {
    total: log.length,
    counts: { critical: red.length, warning: orange.length, safe: green.length },
    popups,
    interruptions,
    reductionPct: 100 - pct(interruptions, popups),
    silentPct: pct(green.length, log.length),
    byDay,
    peakRed,
    redByCause,
    orangeOutcome,
    reasons,
    withReason,
    documentedPct: pct(documented, orange.length),
    topDrugs,
    sources,
    ranking: {
      rankable: rankable.length,
      claude: byClaude,
      fallback: rankable.length - byClaude,
      claudePct: pct(byClaude, rankable.length),
    },
    decisionSec: {
      safe: median(green.map((c) => c.decisionSec)),
      warning: median(orange.map((c) => c.decisionSec)),
      critical: median(red.map((c) => c.decisionSec)),
    },
  }
}

export type Summary = ReturnType<typeof summarize>
