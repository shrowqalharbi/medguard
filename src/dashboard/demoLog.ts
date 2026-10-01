/**
 * Synthetic administration log for the judging dashboard.
 *
 * One Hajj week (8–14 Dhu al-Hijjah) in a Mina emergency unit. Every number on
 * the dashboard is computed from these records by `summarize()` — the analysis
 * is real code, only the records are invented. The generator is seeded, so the
 * dashboard shows the same figures on every load.
 */

export type DemoLevel = 'critical' | 'warning' | 'safe'
export type RedCause = 'allergy' | 'renal' | 'expired'
export type OrangeKind = 'interaction' | 'renal-adjust' | 'renal-unknown'
export type OrangeOutcome = 'given-adjusted' | 'given-with-reason' | 'escalated' | 'cancelled'

export interface DemoCheck {
  day: number
  source: 'ehr' | 'kkjh'
  egfrMissing: boolean
  level: DemoLevel
  redCause?: RedCause
  orangeKind?: OrangeKind
  orangeOutcome?: OrangeOutcome
  overrideReason?: string
  drug: string
  /** Alerts a conventional BCMA system would have shown as separate pop-ups. */
  rawAlerts: number
  /** Non-critical alerts that needed ordering (2 or more). */
  rankable: boolean
  rankedBy?: 'claude' | 'fallback'
  /** Seconds from drug scan to the nurse's decision. */
  decisionSec: number
}

export const DAYS = [
  { label: '8', name: 'التروية' },
  { label: '9', name: 'عرفة' },
  { label: '10', name: 'النحر' },
  { label: '11', name: 'التشريق ١' },
  { label: '12', name: 'التشريق ٢' },
  { label: '13', name: 'التشريق ٣' },
  { label: '14', name: 'المغادرة' },
] as const

/** Checks per day: the peak follows the move to Arafat and Muzdalifah. */
const VOLUME = [130, 260, 240, 190, 170, 140, 118]

export const OVERRIDE_REASONS = [
  'أمر الطبيب مؤكد',
  'الفائدة أعلى من الخطر',
  'جرعة واحدة فقط',
  'متابعة مخبرية خلال 24 ساعة',
]

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateDemoLog(seed = 1447): DemoCheck[] {
  const rnd = mulberry32(seed)
  const pick = <T,>(items: readonly (readonly [T, number])[]): T => {
    const total = items.reduce((s, [, w]) => s + w, 0)
    let r = rnd() * total
    for (const [v, w] of items) if ((r -= w) < 0) return v
    return items[items.length - 1][0]
  }
  const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))

  const log: DemoCheck[] = []
  VOLUME.forEach((count, day) => {
    // Heat and crowding on Arafat / Nahr days raise the share of risky checks.
    const peak = day === 1 || day === 2 ? 1.35 : 1
    for (let i = 0; i < count; i++) {
      const source = rnd() < 0.3 ? 'kkjh' : 'ehr'
      const egfrMissing = rnd() < (source === 'kkjh' ? 0.38 : 0.06)
      const level = pick<DemoLevel>([
        ['critical', 3 * peak],
        ['warning', 17 * peak],
        ['safe', 80],
      ])
      const c: DemoCheck = {
        day,
        source,
        egfrMissing,
        level,
        drug: '',
        rawAlerts: 0,
        rankable: false,
        decisionSec: 0,
      }

      if (level === 'critical') {
        c.redCause = pick<RedCause>([
          ['allergy', 45],
          ['renal', egfrMissing ? 0 : 40],
          ['expired', 15],
        ])
        c.drug =
          c.redCause === 'allergy'
            ? pick([['أموكسيسيللين', 5], ['أموكسيسيللين/كلافولانات', 3], ['إيبوبروفين', 3]] as const)
            : c.redCause === 'renal'
              ? 'ميتفورمين'
              : pick([['باراسيتامول', 2], ['أوميبرازول', 1], ['أملوديبين', 1]] as const)
        c.rawAlerts = between(4, 7)
        c.decisionSec = between(10, 25)
      } else if (level === 'warning') {
        c.orangeKind = egfrMissing
          ? pick<OrangeKind>([['renal-unknown', 70], ['interaction', 30]])
          : pick<OrangeKind>([['interaction', 45], ['renal-adjust', 55]])
        c.drug =
          c.orangeKind === 'interaction'
            ? pick([['إيبوبروفين', 5], ['وارفارين', 2], ['أوميبرازول', 2]] as const)
            : pick([['ميتفورمين', 5], ['أموكسيسيللين/كلافولانات', 2], ['إيبوبروفين', 2]] as const)
        c.orangeOutcome =
          c.orangeKind === 'renal-adjust'
            ? pick<OrangeOutcome>([['given-adjusted', 75], ['escalated', 15], ['cancelled', 10]])
            : pick<OrangeOutcome>([['given-with-reason', 55], ['escalated', 30], ['cancelled', 15]])
        if (c.orangeOutcome === 'given-with-reason') {
          c.overrideReason = pick(OVERRIDE_REASONS.map((r, i) => [r, [40, 30, 18, 12][i]] as const))
        }
        c.rawAlerts = between(3, 6)
        c.decisionSec = between(15, 40)
      } else {
        c.drug = pick([
          ['باراسيتامول', 8],
          ['أوميبرازول', 3],
          ['أملوديبين', 3],
          ['ميتفورمين', 2],
          ['أموكسيسيللين', 2],
        ] as const)
        c.rawAlerts = between(0, 4)
        c.decisionSec = between(4, 9)
      }

      // Only non-critical alerts are ranked, and only when there are 2 or more.
      c.rankable = level !== 'critical' && c.rawAlerts >= 2
      // Tents in Mina lose signal: no reply within 2 s → fixed fallback order.
      if (c.rankable) c.rankedBy = rnd() < (day === 1 || day === 2 ? 0.58 : 0.8) ? 'claude' : 'fallback'
      log.push(c)
    }
  })
  return log
}
