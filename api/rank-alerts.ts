/**
 * POST /api/rank-alerts
 * Body:    { alerts: RankAlert[] }   (non-critical alerts only, no patient identity)
 * Returns: { order: RankItem[] }      most important first
 *
 * Runs on Vercel so the Anthropic key never reaches the phone.
 * Set ANTHROPIC_API_KEY in the Vercel project settings.
 * Any failure returns an error status; the app then keeps its fixed fallback
 * order, so the bedside flow never blocks on this endpoint.
 * The exact-match guard (same alerts, no extra, no missing) runs again on the
 * client in applyRanking().
 */
import { buildRankPrompt, type RankAlert, type RankItem } from '../src/engine/alertRanker'

const MODEL = 'claude-haiku-4-5-20251001'

interface Req {
  method?: string
  body?: unknown
}
interface Res {
  status: (code: number) => Res
  json: (body: unknown) => void
}

function isAlerts(x: unknown): x is RankAlert[] {
  return (
    Array.isArray(x) &&
    x.length >= 2 &&
    x.length <= 20 &&
    x.every(
      (a) =>
        a &&
        typeof a.id === 'string' &&
        typeof a.title === 'string' &&
        typeof a.detail === 'string' &&
        (a.severity === 'warning' || a.severity === 'info') &&
        a.detail.length <= 600,
    )
  )
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(503).json({ error: 'Ranker not configured' })

  const alerts = (req.body as { alerts?: unknown })?.alerts
  // Critical alerts are never accepted here: they are not Claude's to order.
  if (!isAlerts(alerts)) return res.status(400).json({ error: 'Invalid alerts' })

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
        max_tokens: 500,
        temperature: 0,
        messages: [{ role: 'user', content: buildRankPrompt(alerts) }],
      }),
    })
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` })

    const data = (await r.json()) as { content?: { type: string; text?: string }[] }
    const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const parsed = JSON.parse(json) as { order?: unknown[] }

    const order: RankItem[] = (parsed.order ?? []).filter(
      (o): o is RankItem =>
        !!o && typeof (o as RankItem).id === 'string' && typeof (o as RankItem).reason === 'string',
    )
    return res.status(200).json({ order })
  } catch {
    return res.status(502).json({ error: 'Ranker failed' })
  }
}
