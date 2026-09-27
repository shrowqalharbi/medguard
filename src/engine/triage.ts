import { noiseScore, type OverrideEvent } from './ranker'
import { SEVERITY_RANK, type Decision, type Finding, type Level, type Patient } from './types'

/**
 * Triage: turns N findings into ONE signal.
 *
 * 1. The most severe finding decides the colour. Severity comes from the rules
 *    (and from AI note findings, which are always critical). Nothing here can
 *    lower it.
 * 2. Everything else is deferred: shown collapsed under the result, ordered by
 *    severity, then by the ranking model (least likely to be noise first).
 */

const LEVEL_OF: Record<Finding['severity'], Level> = {
  critical: 'critical',
  interaction: 'interaction',
  renal: 'renal',
  info: 'safe',
}

function compare(a: Finding, b: Finding): number {
  const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  if (bySeverity !== 0) return bySeverity
  // Within the same severity, rule findings come before AI ones...
  if (a.source !== b.source) return a.source === 'rule' ? -1 : 1
  // ...then the model's ranking (lower noise first).
  return (a.noiseScore ?? 0) - (b.noiseScore ?? 0)
}

function explain(primary: Finding | null, deferredCount: number): string {
  if (!primary) {
    return deferredCount > 0
      ? `لا شيء يستدعي مقاطعتك. ${deferredCount} ملاحظة للعلم فقط.`
      : 'لا توجد حساسيات أو تعارضات، والجرعة مناسبة.'
  }
  switch (primary.kind) {
    case 'allergy':
    case 'expired':
    case 'renal-contraindicated':
      return 'منع مطلق: يتقدم على أي تنبيه آخر لأنه يهدد سلامة المريض.'
    case 'allergy-from-note':
      return 'الذكاء وجد دليلاً في ملاحظة سريرية. يرفع الخطر فقط ولا يخفّضه، والتأكيد للطبيب.'
    case 'interaction':
      return 'أعلى خطر في هذا الفحص تعارض دوائي يحتاج تأكيدك وسبب المتابعة.'
    default:
      return 'أعلى خطر في هذا الفحص يتعلق بوظائف الكلى، وتم اقتراح جرعة معدلة.'
  }
}

export function triage(
  findings: Finding[],
  patient: Patient,
  overrideLog: OverrideEvent[] = [],
  adjustedDose?: string,
): Decision {
  const scored = findings.map((f) =>
    f.severity === 'critical' ? f : { ...f, noiseScore: noiseScore(f, patient, overrideLog) },
  )
  const sorted = [...scored].sort(compare)

  const top = sorted[0]
  const decisive = top && top.severity !== 'info' ? top : null
  const deferred = decisive ? sorted.slice(1) : sorted
  const level: Level = decisive ? LEVEL_OF[decisive.severity] : 'safe'

  return {
    level,
    primary: decisive,
    deferred,
    explanation: explain(decisive, deferred.length),
    adjustedDose: level === 'renal' ? adjustedDose : undefined,
    all: sorted,
  }
}
