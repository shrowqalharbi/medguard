import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './rank-alerts'

const alerts = [
  { id: 'interaction:ibuprofen:warfarin', kind: 'interaction', severity: 'warning', title: 'تعارض', detail: 'نزيف' },
  { id: 'renal:avoid:ibuprofen', kind: 'renal-avoid', severity: 'warning', title: 'كلى', detail: 'تجنب' },
]

function call(body: unknown) {
  let status = 0
  let json: unknown
  const res = {
    status: (c: number) => ((status = c), res),
    json: (b: unknown) => void (json = b),
  }
  return handler({ method: 'POST', body }, res).then(() => ({ status, json }))
}

describe('POST /api/rank-alerts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('503 without an API key (the app then keeps its fallback order)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect((await call({ alerts })).status).toBe(503)
  })

  it('refuses critical alerts: they are never Claude’s to order', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'k')
    const r = await call({ alerts: [...alerts, { ...alerts[0], id: 'allergy:penicillin', severity: 'critical' }] })
    expect(r.status).toBe(400)
  })

  it('parses Claude’s JSON reply into an order', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'k')
    const reply = { order: [{ id: alerts[1].id, reason: 'الحر يضعف الكلى' }, { id: alerts[0].id, reason: 'مراقبة INR' }] }
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: `Here:\n${JSON.stringify(reply)}` }] })),
    )
    vi.stubGlobal('fetch', fetch)
    const r = await call({ alerts })
    expect(r).toEqual({ status: 200, json: reply })
    const sent = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(sent.model).toBe('claude-haiku-4-5-20251001')
    expect(sent.temperature).toBe(0)
  })

  it('502 when the upstream fails', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'k')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    expect((await call({ alerts })).status).toBe(502)
  })
})
