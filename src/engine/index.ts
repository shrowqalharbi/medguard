import {
  checkAllergy,
  checkExpiry,
  checkInteractions,
  checkRenal,
  routineNotes,
} from './checks'
import type { OverrideEvent } from './ranker'
import { triage } from './triage'
import type { Decision, Drug, EngineInput, Finding, InteractionRule } from './types'

export * from './types'
export { parseScan } from './gs1'
export { lexiconAnalyze, signalsToFindings, buildNotePrompt } from './noteAnalyzer'
export type { NoteSignal } from './noteAnalyzer'
export type { OverrideEvent } from './ranker'

export interface EngineContext {
  drugs: Drug[]
  interactions: InteractionRule[]
  overrideLog?: OverrideEvent[]
}

/**
 * Evaluate one administration: patient + scanned drug → one decision.
 * Pure function: same input, same output. No network, no clock.
 */
export function evaluate(input: EngineInput, ctx: EngineContext): Decision {
  const { patient, drug, pack, aiFindings = [], today } = input
  const nameOf = (id: string) => ctx.drugs.find((d) => d.id === id)?.nameAr ?? id

  const ruleFindings: Finding[] = [
    ...checkAllergy(patient, drug),
    ...checkExpiry(pack, today),
    ...checkInteractions(patient, drug, ctx.interactions, nameOf),
    ...checkRenal(patient, drug),
    ...routineNotes(drug),
  ]

  // AI findings are additive. Drop any AI finding that duplicates a documented
  // allergy of the same family: the structured record already covers it.
  const documented = new Set(patient.allergies.map((a) => a.family))
  const extra = aiFindings.filter(
    (f) => f.severity === 'critical' && !documented.has(f.id.split(':')[1] ?? ''),
  )

  const renalAdjust = ruleFindings.some((f) => f.kind === 'renal-adjust')
  return triage(
    [...ruleFindings, ...extra],
    patient,
    ctx.overrideLog,
    renalAdjust ? drug.renal?.adjustedDose : undefined,
  )
}
