import weights from './model/weights.json'
import type { Finding, FindingKind, Patient } from './types'

/**
 * Alert-noise ranking model (logistic regression).
 *
 * Predicts the probability that a nurse would dismiss a finding as noise.
 * It is used ONLY to order the non-decisive (deferred) findings, so the most
 * relevant ones sit at the top of the collapsed list. It never changes the
 * colour of the decision and never touches critical findings.
 *
 * Weights live in model/weights.json and are produced by
 * scripts/train_ranker.py from override data (simulated for the prototype,
 * real override logs in production).
 */

export interface OverrideEvent {
  kind: FindingKind
  drugId: string
  reason: string
}

interface ModelWeights {
  bias: number
  kind: Record<string, number>
  elderly: number
  overrideRate: number
}

const W = weights as ModelWeights

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** Share of past findings of this kind that nurses overrode (0..1). */
export function overrideRate(kind: FindingKind, log: OverrideEvent[]): number {
  if (log.length === 0) return 0
  return log.filter((e) => e.kind === kind).length / log.length
}

export function noiseScore(
  finding: Finding,
  patient: Patient,
  log: OverrideEvent[] = [],
): number {
  const z =
    W.bias +
    (W.kind[finding.kind] ?? 0) +
    (patient.age >= 65 ? W.elderly : 0) +
    W.overrideRate * overrideRate(finding.kind, log)
  return Math.round(sigmoid(z) * 100) / 100
}
