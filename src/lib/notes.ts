import { lexiconAnalyze, signalsToFindings, type Drug, type Finding, type NoteSignal, type Patient } from '../engine'
import { drugs } from '../data'

/**
 * Runs the clinical-note analyzer for a patient.
 * Tries the language model through our server function first; if there is no
 * network, no API key, or it is slow, falls back to the offline matcher so the
 * bedside flow never waits on the internet.
 *
 * Only note text, date and author are sent. No name, wristband or record id.
 */

const TIMEOUT_MS = 5000
const cache = new Map<string, { signals: NoteSignal[]; via: 'llm' | 'lexicon' }>()

async function fetchSignals(patient: Patient): Promise<{ signals: NoteSignal[]; via: 'llm' | 'lexicon' }> {
  const hit = cache.get(patient.id)
  if (hit) return hit

  let result: { signals: NoteSignal[]; via: 'llm' | 'lexicon' }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch('/api/analyze-notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        notes: patient.clinicalNotes.map(({ date, author, text }) => ({ date, author, text })),
      }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { signals?: NoteSignal[] }
    result = { signals: Array.isArray(data.signals) ? data.signals : [], via: 'llm' }
  } catch {
    result = { signals: lexiconAnalyze(patient.clinicalNotes, drugs), via: 'lexicon' }
  }
  cache.set(patient.id, result)
  return result
}

export async function analyzeNotes(patient: Patient, drug: Drug): Promise<Finding[]> {
  if (patient.clinicalNotes.length === 0) return []
  const { signals, via } = await fetchSignals(patient)
  return signalsToFindings(signals, patient.clinicalNotes, drug, via)
}

/** Signals for the patient regardless of drug, used to highlight notes in the profile. */
export async function patientSignals(patient: Patient): Promise<NoteSignal[]> {
  if (patient.clinicalNotes.length === 0) return []
  const quotes = patient.clinicalNotes.map((n) => n.text)
  return (await fetchSignals(patient)).signals.filter((s) => quotes.some((q) => q.includes(s.quote.trim())))
}

/** Warm the cache as soon as the wristband is scanned. */
export function prefetchNotes(patient: Patient) {
  void fetchSignals(patient)
}
