/**
 * POST /api/match — rank opportunities against a free-text vendor profile with Claude.
 * GET  /api/match — capability probe: `{ service, configured }` (never calls the model).
 *
 * Vercel Node.js function using the Web signature (named `GET` / `POST` exports that take a
 * `Request` and return a `Response`). The Vite dev plugin in `vite.config.ts` serves the same
 * exports during `npm run dev`. See docs/AI.md.
 *
 * This file is self-contained on purpose (it imports only the SDK) so Vercel, Vite and
 * `node --experimental-strip-types` can all load it without a bundler-specific import scheme.
 */
import Anthropic from '@anthropic-ai/sdk'

export const SERVICE = 'opportunity-graph-ai'
/** Override with ANTHROPIC_MATCH_MODEL (see docs/AI.md, cost notes). */
export const DEFAULT_MATCH_MODEL = 'claude-opus-5-5'

const MAX_PROFILE = 2000
const MAX_RFPS = 600
const MAX_DESC = 600
const MAX_REASON = 280
const MAX_SUMMARY = 280

/** The compact projection the client sends. Everything else stays in the browser. */
export interface MatchRfp {
  id: string
  title: string
  agency: string
  industry: string
  mainCommodity: string | null
  description: string | null
  daysLeft: number | null
  aiFit: number
}

export interface Match {
  id: string
  score: number
  reason: string
}

export interface MatchResult {
  matches: Match[]
  summary: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

const str = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.slice(0, max) : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Validates and normalises the request body. Returns an error string when it is unusable. */
export function parseMatchBody(body: unknown): { profile: string; rfps: MatchRfp[] } | string {
  if (!body || typeof body !== 'object') return 'body must be a JSON object'
  const b = body as Record<string, unknown>
  const profile = typeof b.profile === 'string' ? b.profile.trim().slice(0, MAX_PROFILE) : ''
  if (!profile) return 'profile is required'
  if (!Array.isArray(b.rfps) || b.rfps.length === 0) return 'rfps must be a non-empty array'
  if (b.rfps.length > MAX_RFPS) return `at most ${MAX_RFPS} rfps per request`
  const seen = new Set<string>()
  const rfps: MatchRfp[] = []
  for (const raw of b.rfps) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const id = str(r.id, 64)
    if (!id || seen.has(id)) continue
    seen.add(id)
    rfps.push({
      id,
      title: str(r.title, 300) ?? '',
      agency: str(r.agency, 200) ?? '',
      industry: str(r.industry, 120) ?? '',
      mainCommodity: str(r.mainCommodity, 200),
      description: str(r.description, MAX_DESC),
      daysLeft: num(r.daysLeft),
      aiFit: num(r.aiFit) ?? 0,
    })
  }
  if (!rfps.length) return 'no rfps with a valid id'
  return { profile, rfps }
}

/**
 * Keeps only matches whose id was in the request, de-duplicates, clamps scores to 0..1,
 * trims reasons, and sorts by score. Anything malformed is dropped rather than repaired.
 */
export function validateMatches(raw: unknown, knownIds: Iterable<string>): MatchResult {
  const known = new Set(knownIds)
  const out: Match[] = []
  const seen = new Set<string>()
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const list = Array.isArray(r.matches) ? r.matches : []
  for (const m of list) {
    if (!m || typeof m !== 'object') continue
    const { id, score, reason } = m as Record<string, unknown>
    if (typeof id !== 'string' || !known.has(id) || seen.has(id)) continue
    if (typeof score !== 'number' || !Number.isFinite(score)) continue
    seen.add(id)
    out.push({ id, score: Math.max(0, Math.min(1, score)), reason: typeof reason === 'string' ? reason.trim().slice(0, MAX_REASON) : '' })
  }
  out.sort((a, b) => b.score - a.score)
  const summary = typeof r.summary === 'string' ? r.summary.trim().slice(0, MAX_SUMMARY) : ''
  return { matches: out, summary }
}

/**
 * Deterministic corpus text: sorted by id, fixed key order, so the cached prefix is
 * byte-identical across requests with the same dataset.
 */
export function corpusText(rfps: MatchRfp[]): string {
  const rows = [...rfps]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) =>
      JSON.stringify({
        id: r.id,
        title: r.title,
        agency: r.agency,
        industry: r.industry,
        mainCommodity: r.mainCommodity,
        description: r.description,
        daysLeft: r.daysLeft,
        aiFit: r.aiFit,
      }),
    )
  return `<opportunities count="${rows.length}">\n${rows.join('\n')}\n</opportunities>`
}

export const MATCH_SYSTEM = `You rank New York City public procurement opportunities (from PASSPort) for a vendor who has described themselves in a sentence or two.

Each opportunity is one JSON line with: id, title, agency, industry, mainCommodity, description, daysLeft (days until the proposal is due; negative means closed; null means unknown) and aiFit (0-100, a keyword heuristic for how much of the delivery an AI-assisted digital team could do).

How to rank:
- Judge fit between the vendor's stated capabilities and the scope described. Use only what the listing says; do not assume scope that is not written.
- Prefer opportunities that are still open. A closed opportunity can appear only if it is an unusually strong fit, and its reason must say it is closed.
- aiFit is a weak hint, not a verdict.
- Return between 3 and 12 matches, strongest first, and only ids that appear in the list. Leave out anything that is not a real fit.
- score is 0 to 1: 0.85 and above is a strong fit, 0.6 to 0.85 is plausible, below 0.6 is a stretch.
- reason is one plain sentence (under 200 characters) that names the concrete overlap. Do not invent facts about the vendor or the opportunity, and do not mention dollar values or dates that are not in the listing.
- summary is one sentence (under 160 characters) describing the overall pattern of what fits, in sentence case, with no preamble.`

export const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, score: { type: 'number' }, reason: { type: 'string' } },
        required: ['id', 'score', 'reason'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string' },
  },
  required: ['matches', 'summary'],
  additionalProperties: false,
} as const

/** Server-side refusal fallback is supported on these model families only. */
export const supportsDefaultFallback = (model: string) => /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model)

export function GET(): Response {
  return json({ service: SERVICE, configured: Boolean(process.env.ANTHROPIC_API_KEY) })
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return json({ error: 'not_configured' }, 503)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_request', detail: 'invalid JSON' }, 400)
  }
  const parsed = parseMatchBody(body)
  if (typeof parsed === 'string') return json({ error: 'bad_request', detail: parsed }, 400)

  const model = process.env.ANTHROPIC_MATCH_MODEL || DEFAULT_MATCH_MODEL
  const client = new Anthropic({ apiKey })
  try {
    const msg = await client.beta.messages.create(
      {
        model,
        max_tokens: 8000,
        system: MATCH_SYSTEM,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: MATCH_SCHEMA } },
        ...(supportsDefaultFallback(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        messages: [
          {
            role: 'user',
            content: [
              // Stable corpus first, cached; the varying profile comes after the breakpoint.
              { type: 'text', text: corpusText(parsed.rfps), cache_control: { type: 'ephemeral' } },
              { type: 'text', text: `<vendor_profile>\n${parsed.profile}\n</vendor_profile>\n\nRank the opportunities for this vendor.` },
            ],
          },
        ],
      },
      { signal: request.signal },
    )
    if (msg.stop_reason === 'refusal') return json({ error: 'refusal' }, 502)
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return json({ error: 'bad_output' }, 502)
    }
    return json(validateMatches(raw, parsed.rfps.map((r) => r.id)))
  } catch (err) {
    return upstreamError(err)
  }
}

function upstreamError(err: unknown): Response {
  if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429)
  if (err instanceof Anthropic.AuthenticationError) return json({ error: 'not_configured' }, 503)
  if (err instanceof Anthropic.APIUserAbortError) return json({ error: 'aborted' }, 499)
  if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status ?? null }, 502)
  return json({ error: 'upstream' }, 502)
}
