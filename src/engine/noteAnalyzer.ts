import { familyLabel } from './checks'
import type { ClinicalNote, Drug, Finding } from './types'

/**
 * Clinical-note analyzer.
 *
 * Reads free-text notes and extracts drug reactions that were never entered
 * in the structured allergy field. Two interchangeable back-ends produce the
 * same shape (NoteSignal[]):
 *   - 'llm':     Claude, via the server function in api/analyze-notes.ts
 *   - 'lexicon': an offline matcher used when there is no network
 *
 * Whatever the back-end says, signalsToFindings() applies two guards:
 *   1. The quoted evidence must appear verbatim in the patient's notes,
 *      otherwise the signal is discarded (protects against hallucination).
 *   2. Signals can only ADD critical findings. There is no output that can
 *      clear, lower or override a rule-based finding.
 */

export interface NoteSignal {
  /** Drug family the reaction implicates, e.g. "penicillin". */
  family: string
  /** Product named in the note, e.g. "Augmentin". */
  product: string
  reaction: string
  /** Exact quote from the note. */
  quote: string
}

const REACTION_TERMS = [
  'طفح',
  'حكة',
  'تورم',
  'ضيق تنفس',
  'صدمة',
  'تحسس',
  'حساسية',
  'rash',
  'hives',
  'itch',
  'swelling',
  'anaphylaxis',
  'allergic',
]

/** Offline fallback: product name + reaction word in the same note. */
export function lexiconAnalyze(notes: ClinicalNote[], catalog: Drug[]): NoteSignal[] {
  const signals: NoteSignal[] = []
  for (const note of notes) {
    const text = note.text.toLowerCase()
    const reaction = REACTION_TERMS.find((t) => text.includes(t.toLowerCase()))
    if (!reaction) continue
    for (const drug of catalog) {
      const names = [drug.nameAr, drug.nameEn, ...drug.brandNames]
      const hit = names.find((n) => text.includes(n.toLowerCase()))
      if (!hit) continue
      for (const family of drug.families) {
        signals.push({ family, product: hit, reaction, quote: note.text })
      }
    }
  }
  return signals
}

export function signalsToFindings(
  signals: NoteSignal[],
  notes: ClinicalNote[],
  drug: Drug,
  detectedBy: 'llm' | 'lexicon',
): Finding[] {
  const corpus = notes.map((n) => n.text)
  const seen = new Set<string>()
  const findings: Finding[] = []

  for (const s of signals) {
    const grounded = s.quote.trim().length > 0 && corpus.some((t) => t.includes(s.quote.trim()))
    if (!grounded) continue
    if (!drug.families.includes(s.family)) continue
    if (seen.has(s.family)) continue
    seen.add(s.family)

    const source = notes.find((n) => n.text.includes(s.quote.trim()))
    findings.push({
      id: `note-allergy:${s.family}`,
      kind: 'allergy-from-note',
      severity: 'critical',
      source: 'ai',
      detectedBy,
      title: 'حساسية محتملة اكتشفها الذكاء',
      detail: `${s.product} من عائلة ${familyLabel(s.family)}، وهي نفس عائلة ${drug.nameAr}. غير مسجلة في خانة الحساسية.`,
      evidence: source ? `${source.date} — ${source.author}: ${source.text}` : s.quote,
    })
  }
  return findings
}

/** Prompt used by the server function. Kept here so it is versioned with the guards. */
export function buildNotePrompt(notes: ClinicalNote[]): string {
  const body = notes.map((n, i) => `[${i + 1}] ${n.date} — ${n.author}: ${n.text}`).join('\n')
  return [
    'You review hospital clinical notes for undocumented drug reactions.',
    'Return JSON only: {"signals":[{"family","product","reaction","quote"}]}.',
    'family must be one of: penicillin, cephalosporin, nsaid, sulfonamide.',
    'quote must be copied EXACTLY from a note. Do not paraphrase.',
    'Only report reactions attributed to a medication. If none, return {"signals":[]}.',
    '',
    'Notes:',
    body,
  ].join('\n')
}
