/**
 * POST /api/analyze-notes
 * Body: { notes: { date, author, text }[] }   (no names or record ids)
 * Returns: { signals: NoteSignal[] }
 *
 * Runs on Vercel so the Anthropic key never reaches the browser.
 * Set ANTHROPIC_API_KEY in the Vercel project settings.
 * Any failure returns an error status; the app then falls back to the
 * offline matcher, so the bedside flow never blocks on this endpoint.
 */
import { buildNotePrompt, type NoteSignal } from '../src/engine/noteAnalyzer'
import type { ClinicalNote } from '../src/engine/types'

const MODEL = 'claude-haiku-4-5-20251001'
const FAMILIES = new Set(['penicillin', 'cephalosporin', 'nsaid', 'sulfonamide'])

interface Req {
  method?: string
  body?: unknown
}
interface Res {
  status: (code: number) => Res
  json: (body: unknown) => void
}

function isNotes(x: unknown): x is ClinicalNote[] {
  return (
    Array.isArray(x) &&
    x.length <= 50 &&
    x.every((n) => n && typeof n.text === 'string' && n.text.length <= 2000)
  )
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(503).json({ error: 'Analyzer not configured' })

  const notes = (req.body as { notes?: unknown })?.notes
  if (!isNotes(notes)) return res.status(400).json({ error: 'Invalid notes' })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        temperature: 0,
        messages: [{ role: 'user', content: buildNotePrompt(notes) }],
      }),
    })
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` })

    const data = (await r.json()) as { content?: { type: string; text?: string }[] }
    const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const parsed = JSON.parse(json) as { signals?: unknown[] }

    // Shape check here; grounding (quote must exist in the notes) is enforced
    // again on the client by signalsToFindings().
    const signals: NoteSignal[] = (parsed.signals ?? []).filter(
      (s): s is NoteSignal =>
        !!s &&
        typeof s === 'object' &&
        FAMILIES.has((s as NoteSignal).family) &&
        typeof (s as NoteSignal).quote === 'string' &&
        typeof (s as NoteSignal).product === 'string',
    )
    return res.status(200).json({ signals })
  } catch {
    return res.status(502).json({ error: 'Analyzer failed' })
  }
}
