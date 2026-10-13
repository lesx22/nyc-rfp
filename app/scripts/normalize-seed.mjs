#!/usr/bin/env node
/**
 * Normalize the web-search seed (data-raw/*.json) into public/data/rfps.json.
 * Only used until scrape-passport.mjs can run against the live site.
 * Never invents values: anything inferred is flagged (industryInferred) and raw notes are kept.
 */
import { readFile, writeFile } from 'node:fs/promises'

const [, , input = 'data-raw/seed-websearch-2026-10-13.json', output = 'public/data/rfps.json'] = process.argv
const raw = JSON.parse(await readFile(input, 'utf8'))

// Coarse mapping onto PASSPort's real Industry taxonomy, used only when the source omitted it.
const INFER = [
  [/construct|reconstruct|hvac|seawall|elevator|scaffold|sidewalk shed|mechanical equipment|abatement|bioswale|litter|idf\/mdf|plumb|roof|renovat|sewer|paving/i, 'Construction'],
  [/software|platform|technology|fingerprint|payroll|communications system|\bdata\b|digital/i, 'Professional Services - IT Related'],
  [/housing|shelter|guardian|protective|victim|youth|clinical|jobs|benefits|supportive|postsecondary|navigator|threat assessment/i, 'Human/Client Service'],
  [/engineer|design services|architect|survey work/i, 'Professional Services - Architecture/Engineering'],
  [/consult|planning|investigation|examination|risk control|program management/i, 'Professional Services'],
  [/supply|purchase|vehicle|equipment|goods|furnish/i, 'Goods'],
]

const clean = (s) => s?.replace(/\s*\(.*\)\s*$/, '').trim() || null
const note = (s) => s?.match(/\((.*)\)\s*$/)?.[1] ?? null

const rfps = raw.map((r) => {
  let industry = r.industry
  let industryInferred = false
  if (!industry) {
    const text = `${r.title} ${r.description ?? ''}`
    industry = INFER.find(([re]) => re.test(text))?.[1] ?? 'Other'
    industryInferred = true
  }
  const due = r.dueDate?.slice(0, 10) ?? null
  const status = (r.status ?? '').toLowerCase()
  return {
    id: r.epin || r.id,
    title: r.title,
    agency: clean(r.agency) ?? 'Unknown',
    agencyNote: note(r.agency),
    epin: r.epin ?? null,
    industry,
    industryInferred,
    program: r.program ?? null,
    status: status.startsWith('closed') ? 'Closed' : status.startsWith('planned') ? 'Planned' : 'Released',
    statusNote: note(r.status) ?? (status.includes('possibly') ? 'possibly open' : null),
    onPassport: !/not passport|iSupplier/i.test(`${r.agency} ${r.status}`),
    releaseDate: r.releaseDate?.slice(0, 10) ?? null,
    dueDate: due && due.startsWith('2099') ? null : due,
    mainCommodity: r.mainCommodity ?? null,
    estValueUSD: r.estValueUSD ?? null,
    description: r.description ?? null,
    sourceUrl: r.sourceUrl ?? null,
    confidence: r.confidence ?? 'low',
    isDigitalBuild: !!r.isDigitalBuild,
  }
})

await writeFile(
  output,
  JSON.stringify(
    {
      meta: {
        source: 'Seed: public web sources (PASSPort index, Databook mirror, City Record) — run `npm run scrape` for live data',
        fetchedAt: '2026-10-13T00:00:00.000Z',
        count: rfps.length,
      },
      rfps,
    },
    null,
    2,
  ) + '\n',
)
console.log(`Wrote ${rfps.length} → ${output}`)
