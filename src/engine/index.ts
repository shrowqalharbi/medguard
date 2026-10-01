import { checkAllergy, checkExpiry, checkInteractions, checkRenal, routineNotes } from './checks'
import { triage } from './triage'
import type { Decision, Drug, EngineInput, Finding, InteractionRule } from './types'

export * from './types'
export { parseScan } from './gs1'
export { applyRanking, buildRankPrompt, needsRanking, rankable, toRankPayload } from './alertRanker'
export type { RankAlert, RankItem } from './alertRanker'

export interface EngineContext {
  drugs: Drug[]
  interactions: InteractionRule[]
}

/**
 * Evaluate one administration: pilgrim + scanned drug → one decision.
 * Pure function: same input, same output. No network, no clock, no AI.
 * This is the part that works fully offline on the nurse's phone.
 */
export function evaluate(input: EngineInput, ctx: EngineContext): Decision {
  const { patient, drug, pack, today } = input
  const nameOf = (id: string) => ctx.drugs.find((d) => d.id === id)?.nameAr ?? id

  const findings: Finding[] = [
    ...checkAllergy(patient, drug),
    ...checkExpiry(pack, today),
    ...checkInteractions(patient, drug, ctx.interactions, nameOf),
    ...checkRenal(patient, drug),
    ...routineNotes(drug),
  ]

  const renalAdjust = findings.some((f) => f.kind === 'renal-adjust')
  return triage(findings, patient, renalAdjust ? drug.renal?.adjustedDose : undefined)
}
