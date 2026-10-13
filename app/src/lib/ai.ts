/**
 * Client side of the AI layer (docs/AI.md). Every call here is optional: when the backend is
 * missing (static hosting, the claude.ai artifact), unconfigured (503) or failing, callers get
 * `null` and keep the local heuristics. Nothing here throws to the UI except an aborted draft.
 *
 * Imports are type-only or `.ts`-suffixed so `node --experimental-strip-types` can run the tests.
 */
import type { RfpNode } from '../types.ts'
import type { Intake } from './outline.ts'

type Fetch = typeof fetch

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
/** Where the API lives. Same origin by default; set VITE_API_BASE to point elsewhere. */
export const API_BASE = (env?.VITE_API_BASE ?? '').replace(/\/$/, '')
/**
 * AI is OFF unless the build sets VITE_AI_ENABLED=true. Off means the client never contacts /api:
 * no token spend, no 404 noise on static hosts. The public demo ships with it off.
 */
export const AI_ENABLED = env?.VITE_AI_ENABLED === 'true'
const SERVICE = 'opportunity-graph-ai'
const DESC_MAX = 400

/** The compact record /api/match receives: no URLs, notes or provenance, description trimmed. */
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

export interface RemoteMatch {
  relevance: Map<string, number>
  reasons: Map<string, string>
  summary: string
}

/** Sorted by id so the server-side cached corpus prefix is identical between requests. */
export function projectRfps(nodes: RfpNode[]): MatchRfp[] {
  return [...nodes]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((n) => ({
      id: n.id,
      title: n.title,
      agency: n.agency,
      industry: n.industry,
      mainCommodity: n.mainCommodity ?? null,
      description: n.description ? n.description.slice(0, DESC_MAX) : null,
      daysLeft: n.daysLeft,
      aiFit: n.aiFit,
    }))
}

/**
 * Turns an /api/match response into store-ready maps. Drops ids we don't have and anything
 * malformed (the server already does this; the client doesn't trust the wire either).
 * Returns null when nothing usable came back, so callers keep the local result.
 */
export function toRemoteMatch(data: unknown, knownIds: Set<string>): RemoteMatch | null {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { matches?: unknown }).matches)) return null
  const d = data as { matches: unknown[]; summary?: unknown }
  const relevance = new Map<string, number>()
  const reasons = new Map<string, string>()
  for (const m of d.matches) {
    if (!m || typeof m !== 'object') continue
    const { id, score, reason } = m as Record<string, unknown>
    if (typeof id !== 'string' || !knownIds.has(id) || relevance.has(id)) continue
    if (typeof score !== 'number' || !Number.isFinite(score)) continue
    relevance.set(id, Math.max(0, Math.min(1, score)))
    if (typeof reason === 'string' && reason.trim()) reasons.set(id, reason.trim())
  }
  if (!relevance.size) return null
  return { relevance, reasons, summary: typeof d.summary === 'string' ? d.summary.trim() : '' }
}

let probe: Promise<boolean> | null = null

/**
 * One GET per session to see whether a configured backend exists. A GET (rather than a POST
 * that 404s/503s) keeps static hosts quiet: SPA fallbacks answer with HTML, which reads as "no".
 */
export function aiAvailable(fetchImpl: Fetch = fetch): Promise<boolean> {
  if (!AI_ENABLED && fetchImpl === fetch) return Promise.resolve(false)
  probe ??= fetchImpl(`${API_BASE}/api/match`, { headers: { accept: 'application/json' } })
    .then(async (r) => {
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/json')) return false
      const j = (await r.json()) as { service?: unknown; configured?: unknown }
      return j.service === SERVICE && j.configured === true
    })
    .catch(() => false)
  return probe
}

/** Test hook. */
export function resetAiProbe() {
  probe = null
}

/** Claude-ranked matches, or null on any failure (caller keeps local relevance). */
export async function matchRemote(profile: string, nodes: RfpNode[], opts: { signal?: AbortSignal; fetchImpl?: Fetch } = {}): Promise<RemoteMatch | null> {
  const f = opts.fetchImpl ?? fetch
  if (!profile.trim() || !nodes.length) return null
  try {
    if (!(await aiAvailable(f))) return null
    const r = await f(`${API_BASE}/api/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile, rfps: projectRfps(nodes) }),
      signal: opts.signal,
    })
    if (!r.ok) return null
    return toRemoteMatch(await r.json(), new Set(nodes.map((n) => n.id)))
  } catch {
    return null
  }
}

/** The RFP fields /api/draft receives. */
export function projectDraftRfp(n: RfpNode) {
  return {
    id: n.id,
    title: n.title,
    agency: n.agency,
    epin: n.epin,
    industry: n.industry,
    mainCommodity: n.mainCommodity,
    description: n.description,
    releaseDate: n.releaseDate,
    dueDate: n.dueDate,
    estValueUSD: n.estValueUSD,
    status: n.status,
    sourceUrl: n.sourceUrl,
  }
}

export type DraftOutcome = { ok: true; text: string } | { ok: false; reason: 'unavailable' | 'error' | 'too_large' | 'aborted'; text: string }

/**
 * Streams a draft, calling onText with the accumulated markdown. Never throws: failures resolve
 * to `{ ok: false }` with whatever text arrived, and the studio keeps the template.
 */
export async function streamDraft(
  body: { rfp: ReturnType<typeof projectDraftRfp>; intake: Intake; files: { name: string; text: string }[]; section?: string },
  onText: (all: string) => void,
  opts: { signal?: AbortSignal; fetchImpl?: Fetch } = {},
): Promise<DraftOutcome> {
  const f = opts.fetchImpl ?? fetch
  let text = ''
  try {
    if (!(await aiAvailable(f))) return { ok: false, reason: 'unavailable', text }
    const r = await f(`${API_BASE}/api/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
    if (r.status === 413) return { ok: false, reason: 'too_large', text }
    if (r.status === 503 || r.status === 404) return { ok: false, reason: 'unavailable', text }
    if (!r.ok || !r.body) return { ok: false, reason: 'error', text }
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += value
      onText(text)
    }
    return text.trim() ? { ok: true, text } : { ok: false, reason: 'error', text }
  } catch (e) {
    const aborted = opts.signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')
    return { ok: false, reason: aborted ? 'aborted' : 'error', text }
  }
}

/** Extensions read as text in the browser. PDF/DOCX are listed but not parsed yet. */
export const TEXT_EXT = /\.(txt|md|markdown|csv)$/i
export const MAX_TEXT_FILE = 200_000 // characters, mirrors the server limit per file

/**
 * Reads uploaded files that are plain text. Returns the texts plus the names that were skipped.
 * TODO(phase 3): PDF and DOCX extraction. Options: send the PDF to Claude as a base64 `document`
 * block server-side (no client dep), and a small DOCX-to-text step server-side. Avoid adding
 * heavy client parsers (pdf.js, mammoth) to the bundle.
 */
export async function readTextFiles(files: File[]): Promise<{ texts: { name: string; text: string }[]; skipped: { name: string; why: string }[] }> {
  const texts: { name: string; text: string }[] = []
  const skipped: { name: string; why: string }[] = []
  for (const file of files) {
    if (!TEXT_EXT.test(file.name) && !file.type.startsWith('text/')) {
      skipped.push({ name: file.name, why: 'not read yet (PDF/DOCX parsing is coming)' })
      continue
    }
    const text = await file.text().catch(() => '')
    if (!text.trim()) skipped.push({ name: file.name, why: 'empty or unreadable' })
    else if (text.length > MAX_TEXT_FILE) skipped.push({ name: file.name, why: 'too long to send' })
    else texts.push({ name: file.name, text })
  }
  return { texts, skipped }
}
