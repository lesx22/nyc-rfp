/**
 * Unit tests for the AI layer. No network, no API key: the Anthropic client is never called.
 *   npm test   (node --test with type stripping)
 */
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { DRAFT_SECTIONS, parseDraftBody, POST as draftPOST } from '../api/draft.ts'
import { corpusText, GET as matchGET, parseMatchBody, POST as matchPOST, validateMatches } from '../api/match.ts'
import { matchRemote, projectRfps, resetAiProbe, streamDraft, toRemoteMatch } from '../src/lib/ai.ts'
import { OUTLINE_SECTIONS, outline } from '../src/lib/outline.ts'
import type { RfpNode } from '../src/types.ts'

const node = (id: string, extra: Partial<RfpNode> = {}): RfpNode => ({
  id,
  title: `Title ${id}`,
  agency: 'DOITT',
  epin: id,
  industry: 'Professional Services - IT Related',
  program: null,
  status: 'Released',
  releaseDate: '2026-09-01',
  dueDate: '2026-12-01',
  mainCommodity: null,
  estValueUSD: 1_000_000,
  description: 'Build a portal. '.repeat(60),
  sourceUrl: 'https://example.invalid/not-sent',
  agencyNote: 'note',
  aiFit: 70,
  aiFitReasons: ['+22 Software'],
  daysLeft: 30,
  method: 'Competitive Sealed Proposal',
  fiscalYear: 2027,
  ...extra,
})

const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
/** Fake fetch: GET is the capability probe, POST is the real call. */
const fakeFetch = (probe: () => Response | Promise<Response>, post: () => Response | Promise<Response>) =>
  (async (_url: string | URL | Request, init?: RequestInit) => ((init?.method ?? 'GET') === 'GET' ? probe() : post())) as typeof fetch
const configured = () => jsonRes({ service: 'opportunity-graph-ai', configured: true })

beforeEach(() => {
  resetAiProbe()
  delete process.env.ANTHROPIC_API_KEY
})

/* ---------- match: id validation ---------- */

test('validateMatches drops unknown and duplicate ids, clamps scores, sorts', () => {
  const out = validateMatches(
    {
      matches: [
        { id: 'a', score: 0.4, reason: ' ok ' },
        { id: 'ghost', score: 0.99, reason: 'made up' },
        { id: 'b', score: 7, reason: 'too high' },
        { id: 'a', score: 0.9, reason: 'dupe' },
        { id: 'c', score: 'high', reason: 'bad score' },
        { id: 42, score: 0.5 },
        null,
      ],
      summary: '  Digital builds at city agencies.  ',
    },
    ['a', 'b', 'c'],
  )
  assert.deepEqual(
    out.matches.map((m) => [m.id, m.score]),
    [
      ['b', 1],
      ['a', 0.4],
    ],
  )
  assert.equal(out.matches[1].reason, 'ok')
  assert.equal(out.summary, 'Digital builds at city agencies.')
})

test('validateMatches tolerates garbage', () => {
  assert.deepEqual(validateMatches(null, ['a']), { matches: [], summary: '' })
  assert.deepEqual(validateMatches({ matches: 'nope' }, ['a']), { matches: [], summary: '' })
})

test('client toRemoteMatch also drops unknown ids and returns null when nothing is usable', () => {
  const r = toRemoteMatch({ matches: [{ id: 'x', score: 0.8, reason: 'r' }, { id: 'zz', score: 0.9 }], summary: 's' }, new Set(['x']))
  assert.ok(r)
  assert.deepEqual([...r.relevance], [['x', 0.8]])
  assert.equal(r.reasons.get('x'), 'r')
  assert.equal(toRemoteMatch({ matches: [{ id: 'zz', score: 1 }] }, new Set(['x'])), null)
  assert.equal(toRemoteMatch({ error: 'not_configured' }, new Set(['x'])), null)
})

/* ---------- request projection ---------- */

test('projectRfps sends only the compact fields, sorted by id, description trimmed', () => {
  const p = projectRfps([node('b'), node('a', { mainCommodity: undefined as unknown as null })])
  assert.deepEqual(
    p.map((x) => x.id),
    ['a', 'b'],
  )
  assert.deepEqual(Object.keys(p[0]).sort(), ['agency', 'aiFit', 'daysLeft', 'description', 'id', 'industry', 'mainCommodity', 'title'])
  assert.equal(p[0].mainCommodity, null)
  assert.ok(p[0].description!.length <= 400)
  assert.ok(!JSON.stringify(p).includes('not-sent'))
})

test('corpusText is deterministic regardless of input order (cache-stable)', () => {
  const rows = projectRfps([node('b'), node('a')])
  assert.equal(corpusText(rows), corpusText([...rows].reverse()))
})

test('parseMatchBody validates and dedupes', () => {
  assert.equal(typeof parseMatchBody({ profile: '', rfps: [] }), 'string')
  assert.equal(typeof parseMatchBody({ profile: 'x', rfps: [] }), 'string')
  const ok = parseMatchBody({ profile: ' design studio ', rfps: [{ id: 'a', title: 't' }, { id: 'a' }, { title: 'no id' }] })
  assert.ok(typeof ok !== 'string')
  assert.equal(ok.profile, 'design studio')
  assert.equal(ok.rfps.length, 1)
})

/* ---------- endpoints without a key ---------- */

test('endpoints return 503 not_configured without a key, and the probe says so', async () => {
  const req = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) })
  const m = await matchPOST(req({ profile: 'x', rfps: [{ id: 'a' }] }))
  assert.equal(m.status, 503)
  assert.deepEqual(await m.json(), { error: 'not_configured' })
  const d = await draftPOST(req({ rfp: { title: 't' }, intake: {}, files: [] }))
  assert.equal(d.status, 503)
  assert.deepEqual(await matchGET().json(), { service: 'opportunity-graph-ai', configured: false })
})

test('parseDraftBody refuses oversize files and unknown sections instead of truncating', () => {
  const base = { rfp: { title: 't' }, intake: { org: 'O', mwbe: 'yes' } }
  const big = parseDraftBody({ ...base, files: [{ name: 'big.txt', text: 'x'.repeat(200_001) }] })
  assert.ok('error' in big && big.status === 413)
  const bad = parseDraftBody({ ...base, files: [], section: '9. Made up' })
  assert.ok('error' in bad && bad.status === 400)
  const ok = parseDraftBody({ ...base, files: [{ name: 'a.md', text: 'hello' }, { name: 'empty.md', text: ' ' }], section: '7. Price proposal' })
  assert.ok(!('error' in ok))
  assert.equal(ok.files.length, 1)
  assert.equal(ok.intake.mwbe, false, 'only a literal true counts as M/WBE')
})

test('server draft sections match the template outline headings', () => {
  assert.deepEqual([...DRAFT_SECTIONS], [...OUTLINE_SECTIONS])
  const md = outline({ title: 'T', agency: 'A', epin: null, dueDate: null, description: null }, { org: '', team: '', capabilities: '', pastWork: '', mwbe: false, approach: '' }, [])
  for (const h of OUTLINE_SECTIONS) assert.ok(md.includes(`## ${h}\n`), h)
})

/* ---------- fallback path ---------- */

const nodes = [node('a'), node('b')]

test('matchRemote falls back (null) when the backend is missing, unconfigured, failing or offline', async () => {
  const cases: [string, typeof fetch][] = [
    ['static host 404', fakeFetch(() => new Response('nope', { status: 404 }), () => new Response('', { status: 404 }))],
    ['SPA fallback html', fakeFetch(() => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }), () => jsonRes({}))],
    ['not configured', fakeFetch(() => jsonRes({ service: 'opportunity-graph-ai', configured: false }), () => jsonRes({ error: 'not_configured' }, 503))],
    ['503 on POST', fakeFetch(configured, () => jsonRes({ error: 'not_configured' }, 503))],
    ['502 upstream', fakeFetch(configured, () => jsonRes({ error: 'upstream' }, 502))],
    ['network error', fakeFetch(() => Promise.reject(new TypeError('Failed to fetch')), () => Promise.reject(new TypeError('x')))],
    ['POST network error', fakeFetch(configured, () => Promise.reject(new TypeError('Failed to fetch')))],
    ['bad json', fakeFetch(configured, () => new Response('{oops', { headers: { 'content-type': 'application/json' } }))],
    ['only unknown ids', fakeFetch(configured, () => jsonRes({ matches: [{ id: 'ghost', score: 1, reason: '' }], summary: '' }))],
  ]
  for (const [name, f] of cases) {
    resetAiProbe()
    assert.equal(await matchRemote('ai studio', nodes, { fetchImpl: f }), null, name)
  }
})

test('matchRemote returns scores and reasons on success', async () => {
  const f = fakeFetch(configured, () => jsonRes({ matches: [{ id: 'b', score: 0.9, reason: 'portal build' }], summary: 'Portals.' }))
  const r = await matchRemote('ai studio', nodes, { fetchImpl: f })
  assert.ok(r)
  assert.equal(r.relevance.get('b'), 0.9)
  assert.equal(r.reasons.get('b'), 'portal build')
  assert.equal(r.summary, 'Portals.')
})

test('streamDraft reports unavailable / error without throwing, and streams on success', async () => {
  const rfp = { id: 'a', title: 't', agency: 'A', epin: null, industry: '', mainCommodity: null, description: null, releaseDate: null, dueDate: null, estValueUSD: null, status: null, sourceUrl: null }
  const body = { rfp, intake: { org: '', team: '', capabilities: '', pastWork: '', mwbe: false, approach: '' }, files: [] }
  assert.deepEqual(await streamDraft(body, () => {}, { fetchImpl: fakeFetch(() => new Response('', { status: 404 }), () => new Response('')) }), { ok: false, reason: 'unavailable', text: '' })
  resetAiProbe()
  assert.equal((await streamDraft(body, () => {}, { fetchImpl: fakeFetch(configured, () => jsonRes({ error: 'upstream' }, 502)) })).ok, false)
  resetAiProbe()
  const seen: string[] = []
  const out = await streamDraft(body, (t) => seen.push(t), {
    fetchImpl: fakeFetch(configured, () => new Response(new Blob(['# Proposal', ': T\n']).stream(), { headers: { 'content-type': 'text/markdown' } })),
  })
  assert.deepEqual(out, { ok: true, text: '# Proposal: T\n' })
  assert.equal(seen.at(-1), '# Proposal: T\n')
})
