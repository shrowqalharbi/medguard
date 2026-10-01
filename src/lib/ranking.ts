import { applyRanking, needsRanking, rankable, toRankPayload, type Decision } from '../engine'

/**
 * Asks Claude (through our server function) to order the non-critical alerts.
 *
 * The decision passed in is already complete and safe: colour fixed by the
 * rules, alerts in the fixed fallback order. This only tries to improve the
 * order. If there is no network, no API key, a bad reply, or no answer
 * within TIMEOUT_MS, the fallback decision is returned unchanged.
 *
 * Only alert text is sent. No name, ID, age or record number.
 */

export const TIMEOUT_MS = 2000
/** Claude's order per alert set. Only the order is cached, never a decision. */
const cache = new Map<string, unknown>()

export async function rankWithClaude(decision: Decision): Promise<Decision> {
  if (!needsRanking(decision)) return decision
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return decision

  const alerts = toRankPayload(rankable(decision))
  const key = JSON.stringify(alerts)
  const hit = cache.get(key)
  if (hit) return applyRanking(decision, hit) ?? decision

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/rank-alerts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alerts }),
      signal: ctrl.signal,
    })
    if (!res.ok) return decision
    const data = (await res.json()) as { order?: unknown }
    const ranked = applyRanking(decision, data.order)
    if (!ranked) return decision
    cache.set(key, data.order)
    return ranked
  } catch {
    return decision
  } finally {
    clearTimeout(timer)
  }
}
