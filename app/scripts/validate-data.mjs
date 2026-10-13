#!/usr/bin/env node
/**
 * Validate the procurement dataset before it ships.
 *
 *   node scripts/validate-data.mjs                       # public/data/rfps.json
 *   node scripts/validate-data.mjs path/to/file.json
 *   node scripts/validate-data.mjs --json                # machine-readable summary on stdout
 *   node scripts/validate-data.mjs --today 2026-10-13    # pin "today" for the closed-date check
 *
 * Exit 1 on any hard error (bad data must never commit); warnings print but exit 0.
 * Dependency-free on purpose so it runs anywhere Node 22 does. The validator never edits data:
 * per project rules, unknown values stay null and inferred values stay flagged.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const EPIN = /^\d{3}\d{2}[A-Z]\d{4}$/
export const CONFIDENCE = new Set(['high', 'medium', 'low'])
const DATE_FIELDS = ['releaseDate', 'dueDate']
/** Placeholders the scraper / seed normalizer write when the source had no value. Counted as unknown. */
const PLACEHOLDER = new Set(['unknown', 'unknown agency', 'unspecified'])
const MAX_LISTED = 10

const isRealIsoDate = (s) => {
  if (!ISO_DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}
const isBlank = (v) => v == null || (typeof v === 'string' && (v.trim() === '' || PLACEHOLDER.has(v.trim().toLowerCase())))
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const label = (r, i) => `row ${i}${r && typeof r === 'object' && r.id != null ? ` (id ${JSON.stringify(r.id)})` : ''}`
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0)

/**
 * Validate a parsed dataset. Pure function: returns { ok, errors, warnings, stats }.
 * @param {unknown} data
 * @param {{ today?: string }} [opts]
 */
export function validate(data, opts = {}) {
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const errors = []
  const warnings = []
  const stats = { rows: 0 }
  const result = () => ({ ok: errors.length === 0, errors, warnings, stats })

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('Top level must be an object with "meta" and "rfps".')
    return result()
  }
  if (!data.meta || typeof data.meta !== 'object') errors.push('Missing "meta" object.')
  if (!Array.isArray(data.rfps)) {
    errors.push('Missing "rfps" array.')
    return result()
  }

  const rows = data.rfps
  stats.rows = rows.length
  if (rows.length === 0) errors.push('Row count is 0: "rfps" is empty.')
  if (data.meta && typeof data.meta.count === 'number' && data.meta.count !== rows.length) {
    warnings.push(`meta.count is ${data.meta.count} but "rfps" has ${rows.length} rows.`)
  }

  const seen = new Map()
  const nulls = { dueDate: 0, industry: 0, agency: 0, mainCommodity: 0 }
  let inferred = 0
  const badEpins = []
  const closed = []
  const shortTitles = []
  const byTitleAgency = new Map()

  rows.forEach((r, i) => {
    const at = label(r, i)
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      errors.push(`${at}: row is not an object.`)
      return
    }
    // Required identity fields
    if (typeof r.id !== 'string' || !r.id.trim()) errors.push(`${at}: missing "id" (must be a non-empty string).`)
    else if (seen.has(r.id)) errors.push(`${at}: duplicate id ${JSON.stringify(r.id)} (first seen at row ${seen.get(r.id)}).`)
    else seen.set(r.id, i)
    if (typeof r.title !== 'string' || !r.title.trim()) errors.push(`${at}: missing "title" (must be a non-empty string).`)

    for (const f of DATE_FIELDS) {
      const v = r[f]
      if (v === null || v === undefined) continue
      if (typeof v !== 'string' || !isRealIsoDate(v)) errors.push(`${at}: ${f} must be ISO YYYY-MM-DD or null, got ${JSON.stringify(v)}.`)
    }
    if (r.estValueUSD !== null && r.estValueUSD !== undefined) {
      const v = r.estValueUSD
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) errors.push(`${at}: estValueUSD must be null or a positive number, got ${JSON.stringify(v)}.`)
    }
    if (r.confidence !== undefined && !CONFIDENCE.has(r.confidence)) {
      errors.push(`${at}: unknown confidence ${JSON.stringify(r.confidence)} (expected high | medium | low).`)
    }

    // Coverage / quality (warnings)
    for (const f of Object.keys(nulls)) if (isBlank(r[f])) nulls[f]++
    if (r.industryInferred === true) inferred++
    if (typeof r.epin === 'string' && r.epin && !EPIN.test(r.epin)) badEpins.push(r.id === r.epin ? r.epin : `${r.epin} (id ${r.id ?? `row ${i}`})`)
    if (typeof r.dueDate === 'string' && isRealIsoDate(r.dueDate) && r.dueDate < today) closed.push(`${r.id ?? `row ${i}`} (due ${r.dueDate})`)
    if (typeof r.title === 'string' && r.title.trim() && r.title.trim().length < 6) shortTitles.push(`${r.id ?? `row ${i}`}: ${JSON.stringify(r.title)}`)
    if (typeof r.title === 'string' && r.title.trim()) {
      const k = `${norm(r.title)}|${norm(r.agency)}`
      byTitleAgency.set(k, [...(byTitleAgency.get(k) ?? []), r.id ?? `row ${i}`])
    }
  })

  const n = rows.length
  stats.nullPct = Object.fromEntries(Object.entries(nulls).map(([k, v]) => [k, pct(v, n)]))
  stats.inferredIndustryPct = pct(inferred, n)
  stats.nonStandardEpins = badEpins.length
  stats.pastDue = closed.length
  stats.suspectedDuplicates = 0
  stats.shortTitles = shortTitles.length

  const list = (xs) => xs.slice(0, MAX_LISTED).join('; ') + (xs.length > MAX_LISTED ? `; …and ${xs.length - MAX_LISTED} more` : '')
  for (const [k, v] of Object.entries(nulls)) if (v) warnings.push(`${k}: ${v}/${n} rows (${pct(v, n)}%) unknown.`)
  if (inferred) warnings.push(`industry inferred (industryInferred: true) on ${inferred}/${n} rows (${pct(inferred, n)}%).`)
  if (badEpins.length) warnings.push(`${badEpins.length} EPIN(s) don't match the PASSPort pattern ${EPIN.source}: ${list(badEpins)}.`)
  if (closed.length) warnings.push(`${closed.length} row(s) have a due date before ${today} (closed): ${list(closed)}.`)
  const dups = [...byTitleAgency.values()].filter((ids) => ids.length > 1)
  stats.suspectedDuplicates = dups.length
  if (dups.length) warnings.push(`${dups.length} suspected duplicate group(s) by normalized title + agency: ${list(dups.map((ids) => `[${ids.join(', ')}]`))}.`)
  if (shortTitles.length) warnings.push(`${shortTitles.length} title(s) under 6 characters: ${list(shortTitles)}.`)

  return result()
}

/** Read + parse + validate a file. JSON syntax errors become hard errors instead of throwing. */
export async function validateFile(path, opts) {
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (e) {
    return { ok: false, errors: [`Cannot read ${path}: ${e.message}`], warnings: [], stats: { rows: 0 } }
  }
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${e.message}`], warnings: [], stats: { rows: 0 } }
  }
  return validate(data, opts)
}

export function formatReport(file, res) {
  const out = [`Validating ${file}`, `  rows: ${res.stats.rows}`]
  if (res.errors.length) {
    out.push(`\n✗ ${res.errors.length} error(s):`)
    for (const e of res.errors) out.push(`  - ${e}`)
  }
  if (res.warnings.length) {
    out.push(`\n! ${res.warnings.length} warning(s):`)
    for (const w of res.warnings) out.push(`  - ${w}`)
  }
  out.push(res.ok ? `\n✓ OK${res.warnings.length ? ' (with warnings)' : ''}` : '\n✗ FAILED: fix the errors above before committing data.')
  return out.join('\n')
}

// CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const ti = args.indexOf('--today')
  const today = ti >= 0 ? args[ti + 1] : undefined
  const file = args.find((a, i) => !a.startsWith('--') && (ti < 0 || i !== ti + 1)) ?? fileURLToPath(new URL('../public/data/rfps.json', import.meta.url))
  const res = await validateFile(file, { today })
  if (json) console.log(JSON.stringify({ file, ...res }, null, 2))
  else console.log(formatReport(file, res))
  process.exit(res.ok ? 0 : 1)
}
