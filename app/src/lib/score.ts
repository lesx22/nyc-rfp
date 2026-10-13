import type { Rfp, RfpNode } from '../types'
import { parseEpin } from './epin.ts'

/**
 * AI-fit heuristic. Transparent, keyword-weighted, and explainable on purpose:
 * every point added carries a human-readable reason that the side panel shows.
 * Phase 3 replaces/augments this with an LLM classifier (see docs/ROADMAP.md).
 */
const POSITIVE: [RegExp, number, string][] = [
  [/\b(software|application|app|platform|portal|web ?site|website|saas)\b/i, 22, 'Software / web build'],
  [/\b(develop(ment)?|build|implementation|moderniz|re-?platform|migration)\b/i, 12, 'Build or modernization scope'],
  [/\b(data|analytics|dashboard|database|etl|warehouse|gis|mapping)\b/i, 14, 'Data / analytics work'],
  [/\b(ai|artificial intelligence|machine learning|ml|chatbot|automation|nlp)\b/i, 16, 'AI / automation in scope'],
  [/\b(digital|online|cloud|api|integration|crm|case management|salesforce)\b/i, 10, 'Digital service / integration'],
  [/\b(ux|ui|user experience|design system|accessibility|wcag)\b/i, 8, 'UX / accessibility'],
  [/\b(it |information technology|technology|cyber|devops|qa|testing)\b/i, 8, 'IT services'],
  [/\b(consult|research|evaluation|study|report|translation|content)\b/i, 5, 'Knowledge work (partially automatable)'],
]
const NEGATIVE: [RegExp, number, string][] = [
  [/\b(construct|renovat|repair|install(ation)? of|hvac|roof|plumb|paving|demolition|elevator)\b/i, -35, 'Physical construction'],
  [/\b(food|meals|vehicle|truck|fuel|uniform|furniture|equipment purchase|supplies|goods)\b/i, -25, 'Physical goods / supply'],
  [/\b(shelter|housing|case ?work|counsel|outreach|youth|senior|child ?care|health care|clinical|residential)\b/i, -22, 'In-person human services'],
  [/\b(security guard|janitorial|custodial|cleaning|snow|towing|maintenance services)\b/i, -25, 'On-site labor'],
  [/\b(hardware|devices|laptops|radios|license renewal|subscription)\b/i, -8, 'Hardware / license resale'],
  [/\b(ground-scanning|sensor|radar|fingerprint|biometric|signal priority|equipment rooms?)\b/i, -10, 'Physical sensing / field hardware'],
  [/\b(rfi|request for information|concept paper)\b/i, -10, 'Information request, not a contract yet'],
  [/\b(subrecipient|grant|concession)\b/i, -15, 'Grant / concession, not a services contract'],
]

/** Priors keyed on PASSPort's actual Industry taxonomy (confirmed from the browse filter list). */
const INDUSTRY_PRIOR: Record<string, number> = {
  'Professional Services - IT Related': 14,
  'Standard Services - IT Related': 10,
  'Goods - IT Related': -4,
  'Professional Services': 6,
  'Professional Services - Investigative/Confidential': 0,
  'Professional Services - Architecture/Engineering': -6,
  'Professional Services- Construction Related': -12,
  'Standard Services': -4,
  'Standard Services - Construction Related': -15,
  'Human/Client Service': -12,
  Goods: -14,
  'Goods - Construction Related': -18,
  Construction: -20,
}

export function scoreAiFit(r: Rfp): { score: number; reasons: string[] } {
  const text = [r.title, r.description, r.mainCommodity].filter(Boolean).join(' ')
  let score = 35
  const reasons: string[] = []
  for (const [re, w, why] of [...POSITIVE, ...NEGATIVE]) {
    if (re.test(text)) {
      score += w
      reasons.push(`${w > 0 ? '+' : ''}${w} ${why}`)
    }
  }
  const prior = INDUSTRY_PRIOR[r.industry] ?? 0
  if (prior) {
    score += prior
    reasons.push(`${prior > 0 ? '+' : ''}${prior} Industry: ${r.industry}`)
  }
  if (r.isDigitalBuild) {
    score += 10
    reasons.push('+10 Flagged as fully digital deliverable')
  }
  return { score: Math.max(0, Math.min(100, score)), reasons }
}

export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso + 'T23:59:59')
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000)
}

export function enrich(rows: Rfp[]): RfpNode[] {
  return rows.map((r) => {
    const { score, reasons } = scoreAiFit(r)
    const ep = parseEpin(r.epin)
    return { ...r, aiFit: score, aiFitReasons: reasons, daysLeft: daysUntil(r.dueDate), method: ep?.method ?? 'Unknown', fiscalYear: ep?.fiscalYear ?? null }
  })
}

/* ---------- Prompt-bar relevance (local, no network) ---------- */

const SYNONYMS: Record<string, string[]> = {
  ai: ['ai', 'artificial', 'machine', 'automation', 'chatbot', 'nlp', 'data'],
  software: ['software', 'app', 'application', 'platform', 'web', 'website', 'portal', 'digital', 'development'],
  design: ['design', 'ux', 'ui', 'website', 'brand', 'accessibility', 'content'],
  data: ['data', 'analytics', 'dashboard', 'database', 'gis', 'research', 'evaluation'],
  youth: ['youth', 'young', 'student', 'school', 'education', 'children'],
  climate: ['climate', 'energy', 'solar', 'sustainab', 'environment', 'green', 'resilien'],
  health: ['health', 'mental', 'clinical', 'hospital', 'medical'],
  housing: ['housing', 'shelter', 'homeless', 'tenant'],
  small: ['small', 'mwbe', 'm/wbe', 'micro', 'minority'],
}
const STOP = new Set('i im a an the and or of to for in on at with my me we our is am are be do want looking build make that this who about like work'.split(' '))

export function tokenize(q: string): string[] {
  const words = q.toLowerCase().split(/[^a-z0-9/]+/).filter((w) => w.length > 1 && !STOP.has(w))
  const out = new Set<string>()
  for (const w of words) {
    out.add(w)
    for (const [k, syn] of Object.entries(SYNONYMS)) if (w.startsWith(k) || syn.some((s) => w.startsWith(s))) syn.forEach((s) => out.add(s))
  }
  return [...out]
}

/** Returns 0–1 relevance per id. Blends keyword overlap with AI-fit so "builders" float up. */
export function relevance(nodes: RfpNode[], query: string): Map<string, number> {
  const toks = tokenize(query)
  const m = new Map<string, number>()
  if (!toks.length) return m
  const wantsBuild = toks.some((t) => ['software', 'ai', 'digital', 'development', 'app', 'web'].includes(t))
  let max = 0
  for (const n of nodes) {
    const hay = [n.title, n.description, n.mainCommodity, n.agency, n.industry, n.program].filter(Boolean).join(' ').toLowerCase()
    let s = 0
    for (const t of toks) if (hay.includes(t)) s += t.length > 4 ? 1.5 : 1
    if (wantsBuild) s += n.aiFit / 40
    if (n.daysLeft != null && n.daysLeft < 0) s *= 0.3
    m.set(n.id, s)
    max = Math.max(max, s)
  }
  if (max > 0) for (const [k, v] of m) m.set(k, v / max)
  return m
}
