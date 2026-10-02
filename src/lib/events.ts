import type { FindingKind, Level, RankedBy } from '../engine'

/**
 * Administration log. Every scan decision and what the nurse did with it.
 * The audit trail: every reason a nurse gave to continue past an orange alert.
 *
 * Storage: localStorage on the nurse's phone (wrapped: private mode can throw).
 * A shared backend replaces it when the team enables real-time sync.
 */

export type Outcome = 'given' | 'given-adjusted' | 'given-with-reason' | 'blocked' | 'escalated' | 'cancelled'

export interface AdminEvent {
  id: string
  at: string
  nurse: string
  patientId: string
  patientName: string
  drugId: string
  drugName: string
  level: Level
  title: string
  deferredCount: number
  /** Who ordered the non-critical alerts for this check. */
  rankedBy: RankedBy
  outcome: Outcome
  overrideReason?: string
  overrideKind?: FindingKind
}

const KEY = 'medguard.events.v1'

export function loadEvents(): AdminEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AdminEvent[]) : []
  } catch {
    return []
  }
}

let memory: AdminEvent[] | null = null

export function recordEvent(e: Omit<AdminEvent, 'id' | 'at'>): AdminEvent {
  const event: AdminEvent = { ...e, id: crypto.randomUUID(), at: new Date().toISOString() }
  memory = [event, ...(memory ?? loadEvents())].slice(0, 500)
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    /* storage unavailable: keep in memory */
  }
  return event
}
