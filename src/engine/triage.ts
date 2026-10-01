import { SEVERITY_RANK, type Decision, type Finding, type FindingKind, type Level, type Patient } from './types'

/**
 * Triage: turns N findings into ONE signal.
 *
 * 1. The most severe finding decides the colour. Severity comes only from the
 *    clinical rules. Nothing here, and nothing after it, can lower it.
 * 2. Everything else is deferred: shown collapsed under the result.
 *
 * The order produced here is the FALLBACK order: fixed, offline, always
 * available. When the network is up, Claude may reorder the non-critical
 * alerts afterwards (see alertRanker.ts).
 */

/** Fixed priority used when Claude is unavailable, most important first. */
export const FALLBACK_ORDER: FindingKind[] = [
  'allergy',
  'renal-contraindicated',
  'expired',
  'interaction',
  'renal-adjust',
  'renal-unknown',
  'renal-avoid',
  'renal-near-threshold',
  'routine',
]

const LEVEL_OF: Record<Finding['severity'], Level> = {
  critical: 'critical',
  warning: 'warning',
  info: 'safe',
}

export function fallbackCompare(a: Finding, b: Finding): number {
  const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  if (bySeverity !== 0) return bySeverity
  return FALLBACK_ORDER.indexOf(a.kind) - FALLBACK_ORDER.indexOf(b.kind)
}

export function explain(primary: Finding | null, deferredCount: number): string {
  if (!primary) {
    return deferredCount > 0
      ? `لا شيء يستدعي مقاطعتك. ${deferredCount} ملاحظة للعلم فقط.`
      : 'لا توجد حساسيات أو تعارضات، والجرعة مناسبة.'
  }
  switch (primary.kind) {
    case 'allergy':
    case 'expired':
    case 'renal-contraindicated':
      return 'منع مطلق: خطر على حياة الحاج، يتقدم على أي تنبيه آخر ولا يمكن تجاوزه.'
    case 'renal-unknown':
      return 'الدواء يحتاج قراءة كلى لتحديد الجرعة، ولا توجد قراءة في ملف الحاج.'
    case 'interaction':
      return 'أعلى خطر في هذا الفحص تعارض دوائي يحتاج تأكيدك وسبب المتابعة.'
    default:
      return 'أعلى خطر في هذا الفحص يتعلق بوظائف الكلى، ويحتاج تأكيدك وسبب المتابعة.'
  }
}

export function triage(findings: Finding[], patient: Patient, adjustedDose?: string): Decision {
  const sorted = [...findings].sort(fallbackCompare)

  const top = sorted[0]
  const decisive = top && top.severity !== 'info' ? top : null
  const deferred = decisive ? sorted.slice(1) : sorted
  const level: Level = decisive ? LEVEL_OF[decisive.severity] : 'safe'

  return {
    level,
    primary: decisive,
    deferred,
    explanation: explain(decisive, deferred.length),
    adjustedDose,
    renalMissing: !patient.egfr,
    rankedBy: 'fallback',
    all: sorted,
  }
}
