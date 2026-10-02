import { explain } from './triage'
import type { Decision, Finding } from './types'

/**
 * AI alert ranking — the only AI in MEDGUARD.
 *
 * The rules have already found every alert and fixed the colour. Claude only
 * decides the ORDER of the non-critical alerts: which one is worth
 * interrupting the nurse with, and which can wait in the deferred list.
 *
 * Safety guarantees, all enforced here in pure code:
 *   1. Critical findings are never sent to Claude and never reordered.
 *   2. Claude cannot change the colour: it orders alerts inside their own
 *      severity band only (orange stays above "for information").
 *   3. The reply must contain exactly the alerts that were sent: no extra, no
 *      missing, no duplicates. Anything else is rejected and the fixed
 *      fallback order is kept.
 *   4. No patient identity and no patient measurement is sent. Kidney alerts go
 *      out as fixed generic text (no eGFR value, no age, no condition). What
 *      does leave the device: the alert kind, its severity band, and the name
 *      of a current medicine when the alert is an interaction with it.
 */

/** What is sent to Claude for one alert. No name, ID, age, record number or lab value. */
export interface RankAlert {
  id: string
  kind: Finding['kind']
  severity: 'warning' | 'info'
  title: string
  detail: string
}

/** What Claude must return for each alert, most important first. */
export interface RankItem {
  id: string
  reason: string
}

const MAX_REASON = 160

/**
 * Orange alerts that always come first and never go to Claude: a pack
 * dispensed for another patient. Its text names that patient, and no ranking
 * may push it below another alert.
 */
const PINNED: Finding['kind'][] = ['wrong-patient']
const isPinned = (f: Finding) => PINNED.includes(f.kind)

/** The alerts Claude is allowed to see: everything except critical and pinned findings. */
export function rankable(d: Decision): Finding[] {
  return d.all.filter((f) => f.severity !== 'critical' && !isPinned(f))
}

/**
 * Kidney alerts normally carry the pilgrim's own numbers and reasons ("eGFR 38",
 * "age 65 or more", "kidney disease on record"). Claude does not need them to
 * order the alert, so these kinds are replaced by fixed generic text.
 * Interaction and routine texts come from the drug tables, not from the patient.
 */
const GENERIC_DETAIL: Partial<Record<Finding['kind'], string>> = {
  'renal-adjust': 'جرعة هذا الدواء تحتاج تعديلاً عند ضعف وظائف الكلى.',
  'renal-avoid': 'هذا الدواء قد يضعف وظائف الكلى ويُفضّل تجنبه عند ضعفها.',
  'renal-near-threshold': 'وظائف الكلى قريبة من الحد الذي تُعدَّل عنده جرعة هذا الدواء.',
  'renal-unknown': 'جرعة هذا الدواء تعتمد على وظائف الكلى ولا توجد قراءة كلى حديثة.',
}

export function toRankPayload(findings: Finding[]): RankAlert[] {
  return findings.map(({ id, kind, severity, title, detail }) => ({
    id,
    kind,
    severity: severity as RankAlert['severity'],
    title,
    detail: GENERIC_DETAIL[kind] ?? detail,
  }))
}

/** Only worth a network call when there is more than one alert to order. */
export const needsRanking = (d: Decision) => rankable(d).length >= 2

/**
 * Applies Claude's order to a decision. Returns null (keep the fallback) when
 * the reply does not match the alerts that were sent.
 */
export function applyRanking(d: Decision, order: unknown): Decision | null {
  const pool = rankable(d)
  if (pool.length < 2 || !Array.isArray(order) || order.length !== pool.length) return null

  const ids = new Set(pool.map((f) => f.id))
  const seen = new Set<string>()
  for (const item of order as Partial<RankItem>[]) {
    if (!item || typeof item.id !== 'string' || typeof item.reason !== 'string') return null
    if (!ids.has(item.id) || seen.has(item.id)) return null
    seen.add(item.id)
  }

  const items = order as RankItem[]
  const pos = new Map(items.map((it, i) => [it.id, i]))
  const reason = new Map(items.map((it) => [it.id, it.reason.trim().slice(0, MAX_REASON)]))
  const byClaude = (a: Finding, b: Finding) => pos.get(a.id)! - pos.get(b.id)!
  const withReason = (f: Finding): Finding => ({ ...f, rankReason: reason.get(f.id) || undefined })

  // Critical findings keep their rule order and are never touched.
  const critical = d.all.filter((f) => f.severity === 'critical')
  const pinned = d.all.filter((f) => f.severity !== 'critical' && isPinned(f))
  const warning = pool.filter((f) => f.severity === 'warning').sort(byClaude).map(withReason)
  const info = pool.filter((f) => f.severity === 'info').sort(byClaude).map(withReason)

  let primary: Finding | null
  let deferred: Finding[]
  if (d.level === 'critical') {
    primary = d.primary
    deferred = [...critical.filter((f) => f.id !== primary?.id), ...pinned, ...warning, ...info]
  } else if (d.level === 'warning') {
    // Same colour, but Claude picks which orange alert is shown first.
    const orange = [...pinned, ...warning]
    primary = orange[0]
    deferred = [...orange.slice(1), ...info]
  } else {
    primary = null
    deferred = info
  }

  return {
    ...d,
    primary,
    deferred,
    explanation: explain(primary, deferred.length),
    rankedBy: 'claude',
    all: primary ? [primary, ...deferred] : deferred,
  }
}

export function buildRankPrompt(alerts: RankAlert[]): string {
  return `You are an experienced emergency nurse working in the Hajj emergency units in Mina and Arafat.
A medication-safety app has already run deterministic clinical rules and produced the alerts below for ONE drug administration. The colour of the decision is already fixed by those rules and you cannot change it. Life-threatening alerts were handled separately and are not in this list.

Your only job: order these alerts from MOST to LEAST worth interrupting a busy nurse at the bedside, based on what the alert-fatigue literature and nursing practice say about which alerts nurses act on and which they routinely override as noise. Consider: bleeding risk, kidney harm in hot, dehydrating conditions, whether the alert asks for an action now, and whether it is routine information.

Alerts (JSON):
${JSON.stringify(alerts, null, 2)}

Reply with JSON only, no prose, in exactly this shape:
{"order":[{"id":"<alert id>","reason":"<one short sentence in Arabic, max 20 words, why it is in this position>"}]}

Rules: include every alert id exactly once, use the ids exactly as given, add nothing else.`
}
