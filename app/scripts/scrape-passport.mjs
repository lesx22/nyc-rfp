#!/usr/bin/env node
/**
 * Scrape NYC PASSPort "Browse Public Procurements" into public/data/rfps.json.
 *
 *   node scripts/scrape-passport.mjs            # headless
 *   HEADED=1 node scripts/scrape-passport.mjs   # watch it run
 *
 * PASSPort is an ASP.NET app with a client-rendered grid and postback paging,
 * so a real browser (Playwright) is used instead of raw HTTP. The scraper reads
 * the grid's own header row and maps columns by name, so column reordering won't break it.
 * Be polite: one page at a time, small delays, run at most a few times a day.
 */
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { formatReport, validate } from './validate-data.mjs'

const URL = 'https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public'
const OUT = new globalThis.URL('../public/data/rfps.json', import.meta.url)
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 60)

const COLS = {
  program: /program/i,
  industry: /industry/i,
  epin: /epin|code/i,
  title: /procurement name|title|label|name/i,
  agency: /agency|department|buyer/i,
  status: /status/i,
  releaseDate: /release|publish|begin/i,
  dueDate: /due|end date|closing/i,
  mainCommodity: /commodity/i,
}

const toIso = (s) => {
  if (!s) return null
  const d = new Date(s.trim())
  if (Number.isNaN(d.getTime())) return null
  // Use the parsed local calendar date: toISOString() converts to UTC and can shift
  // a late-evening due time ("11:00 PM") onto the next day.
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const browser = await chromium.launch({ headless: !process.env.HEADED, executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (opportunity-graph research scraper)' })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 90_000 })

// Some PASSPort views require pressing "Search" before the grid renders.
const search = page.getByRole('button', { name: /^search$/i })
if (await search.count()) await search.first().click().catch(() => {})
await page.waitForSelector('table tbody tr', { timeout: 60_000 })

const rows = []
for (let p = 1; p <= MAX_PAGES; p++) {
  const batch = await page.evaluate((colSrc) => {
    const cols = Object.fromEntries(Object.entries(colSrc).map(([k, v]) => [k, new RegExp(v, 'i')]))
    const table = [...document.querySelectorAll('table')].sort((a, b) => b.querySelectorAll('tbody tr').length - a.querySelectorAll('tbody tr').length)[0]
    if (!table) return []
    const heads = [...table.querySelectorAll('thead th, tr:first-child th')].map((th) => th.textContent.trim())
    const idx = {}
    for (const [k, re] of Object.entries(cols)) {
      const i = heads.findIndex((h, j) => re.test(h) && !Object.values(idx).includes(j))
      if (i >= 0) idx[k] = i
    }
    return [...table.querySelectorAll('tbody tr')].map((tr) => {
      const td = [...tr.querySelectorAll('td')]
      const get = (k) => (idx[k] != null ? td[idx[k]]?.textContent.trim() || null : null)
      const link = tr.querySelector('a[href*="request"], a[href*="rfp"]')
      return { ...Object.fromEntries(Object.keys(cols).map((k) => [k, get(k)])), sourceUrl: link ? new URL(link.getAttribute('href'), location.href).href : null, _heads: heads }
    })
  }, Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, v.source])))

  if (p === 1) console.log('Columns seen:', batch[0]?._heads)
  rows.push(...batch.filter((r) => r.title))
  console.log(`page ${p}: +${batch.length} (total ${rows.length})`)

  const next = page.locator('a[title*="Next" i], button[title*="Next" i], a:has-text("›"), a:has-text("Next")').first()
  if (!(await next.count()) || (await next.getAttribute('class'))?.match(/disabled/i)) break
  const before = await page.locator('table tbody tr').first().textContent()
  await next.click()
  await page.waitForFunction((b) => document.querySelector('table tbody tr')?.textContent !== b, before, { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(800)
}
await browser.close()

// Preserve hand-curated enrichment (estValueUSD, description) from the existing file, keyed by EPIN or title.
let prev = []
try {
  prev = JSON.parse(await readFile(OUT, 'utf8')).rfps ?? []
} catch {}
const key = (r) => (r.epin || r.title || '').toLowerCase()
const prevBy = new Map(prev.map((r) => [key(r), r]))

// Safety rail for unattended runs: a broken selector must never wipe good data.
if (prev.length && rows.length < prev.length * 0.5 && !process.env.FORCE) {
  console.error(`Refusing to write: scraped ${rows.length} rows vs ${prev.length} previously (<50%). Set FORCE=1 to override.`)
  process.exit(2)
}

// Paging can repeat a row (postback timing); EPINs are unique, so drop exact EPIN repeats.
const seenEpin = new Set()
const unique = rows.filter((r) => !r.epin || (!seenEpin.has(r.epin) && seenEpin.add(r.epin)))
if (unique.length !== rows.length) console.log(`Dropped ${rows.length - unique.length} repeated EPIN row(s) from paging.`)

const rfps = unique.map((r, i) => {
  const old = prevBy.get(key(r)) ?? {}
  return {
    id: r.epin || `pp-${i}`,
    title: r.title,
    agency: r.agency ?? 'Unknown agency',
    epin: r.epin,
    industry: r.industry ?? 'Unspecified',
    program: r.program,
    status: r.status,
    releaseDate: toIso(r.releaseDate),
    dueDate: toIso(r.dueDate),
    mainCommodity: r.mainCommodity,
    estValueUSD: old.estValueUSD ?? null,
    description: old.description ?? null,
    sourceUrl: r.sourceUrl ?? old.sourceUrl ?? null,
    confidence: 'high',
  }
})

const dataset = { meta: { source: 'NYC PASSPort public browse (scraped)', fetchedAt: new Date().toISOString(), count: rfps.length }, rfps }

// Second safety rail: run the same validator CI uses before touching the file.
const check = validate(dataset)
console.log(formatReport('scraped dataset (not yet written)', check))
if (!check.ok && !process.env.FORCE) {
  console.error('Refusing to write: scraped data failed validation (see errors above). Set FORCE=1 to override.')
  process.exit(3)
}

await mkdir(new globalThis.URL('.', OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(dataset, null, 2))
console.log(`Wrote ${rfps.length} rows → ${OUT.pathname}`)
