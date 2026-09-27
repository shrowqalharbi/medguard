import type { FindingKind, Level } from '../engine'
import type { OverrideEvent } from '../engine'

/**
 * Administration log. Every scan decision and what the nurse did with it.
 * Feeds the supervisor dashboard and the ranking model's override history.
 *
 * Storage: localStorage for the prototype (wrapped: private mode can throw),
 * BroadcastChannel so a dashboard tab on the same device updates live.
 * A shared backend replaces both when the team enables real-time sync.
 */

export type Outcome = 'given' | 'given-adjusted' | 'given-with-reason' | 'blocked' | 'escalated' | 'cancelled'

export interface AdminEvent {
  id: string
  at: string
  nurse: string
  device: string
  patientId: string
  patientName: string
  room: string
  drugId: string
  drugName: string
  level: Level
  title: string
  deferredCount: number
  /** Did the AI note analyzer contribute the decisive finding? */
  aiDetected: boolean
  outcome: Outcome
  overrideReason?: string
  overrideKind?: FindingKind
}

const KEY = 'medguard.events.v1'
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('medguard') : null

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
  channel?.postMessage({ type: 'event', event })
  return event
}

export function subscribe(fn: (e: AdminEvent) => void): () => void {
  if (!channel) return () => {}
  const handler = (m: MessageEvent) => m.data?.type === 'event' && fn(m.data.event)
  channel.addEventListener('message', handler)
  return () => channel.removeEventListener('message', handler)
}

/** Override history in the shape the ranking model consumes. */
export function overrideLog(): OverrideEvent[] {
  return (memory ?? loadEvents())
    .filter((e) => e.outcome === 'given-with-reason' && e.overrideKind)
    .map((e) => ({ kind: e.overrideKind!, drugId: e.drugId, reason: e.overrideReason ?? '' }))
}
