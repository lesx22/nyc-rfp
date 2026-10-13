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
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { formatReport, validate } from './validate-data.mjs'

const URL = 'https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public'
const OUT = new globalThis.URL('../public/data/rfps.json', import.meta.url)
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 200)

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

// On any failure, leave the page behind for diagnosis (CI uploads scrape-debug/ as an artifact).
async function saveDebug(reason) {
  try {
    const dir = new globalThis.URL('../scrape-debug/', import.meta.url)
    await mkdir(dir, { recursive: true })
    await writeFile(new globalThis.URL('page.html', dir), await page.content())
    await page.screenshot({ path: new globalThis.URL('page.png', dir).pathname, fullPage: true })
    await writeFile(new globalThis.URL('reason.txt', dir), String(reason))
    console.error(`Saved debug snapshot to scrape-debug/ (${reason})`)
  } catch (e) {
    console.error('Could not save debug snapshot:', e)
  }
}

// Wait for the table that actually holds listings (rows with EPIN-shaped codes). The page also has
// hidden layout tables, so "first visible row" is not a safe signal.
const EPIN = '\\b\\d{3}\\d{2}[A-Z]\\d{4}\\b'
try {
  await page.waitForFunction(
    (re) => [...document.querySelectorAll('table')].some((t) => (t.innerText.match(new RegExp(re, 'g')) ?? []).length >= 3),
    EPIN,
    { timeout: 90_000 },
  )
} catch (e) {
  await saveDebug('No table with EPIN-shaped rows appeared within 90s')
  await browser.close()
  throw e
}

// Always keep a snapshot of the first page (uploaded as a CI artifact) so the grid and pager can be inspected.
await saveDebug('first page snapshot (saved on every run)')

// How many listings does the page say there are? ("1 - 15 of 432", "432 results", ...)
const expected = await page.evaluate(() => {
  const t = document.body.innerText
  const m = t.match(/\bof\s+([\d,]{2,})\b/i) ?? t.match(/([\d,]{2,})\s+(?:results?|records|items|rows)\b/i)
  // "More than 150 Results" is a lower bound, not a total: don't stop paging at it.
  if (!m || /more than\s*$/i.test(t.slice(0, m.index + m[0].indexOf(m[1])))) return null
  return Number(m[1].replace(/,/g, ''))
})
console.log('Listings the page reports:', expected ?? 'unknown')

// Prefer one big page: pick the largest page-size option if the grid offers one.
await page.evaluate(() => {
  for (const sel of document.querySelectorAll('select')) {
    const opts = [...sel.options].map((o) => Number(o.value || o.text)).filter((n) => n >= 10 && n <= 1000)
    if (opts.length >= 2 && opts.includes(Number(sel.value || sel.options[sel.selectedIndex]?.text))) {
      const max = Math.max(...opts)
      sel.value = String([...sel.options].find((o) => Number(o.value || o.text) === max).value)
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
  }
  return false
}).then(async (changed) => {
  if (changed) {
    console.log('Switched the grid to its largest page size')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
  }
})

const rows = []
for (let p = 1; p <= MAX_PAGES; p++) {
  const batch = await page.evaluate((colSrc) => {
    const cols = Object.fromEntries(Object.entries(colSrc).map(([k, v]) => [k, new RegExp(v, 'i')]))
    // The listings table is the one with the most EPIN-shaped codes (not merely the most rows).
    const epins = (t) => (t.innerText.match(/\b\d{3}\d{2}[A-Z]\d{4}\b/g) ?? []).length
    const table = [...document.querySelectorAll('table')].sort((a, b) => epins(b) - epins(a) || b.querySelectorAll('tbody tr').length - a.querySelectorAll('tbody tr').length)[0]
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

  if (expected && rows.length >= expected) break
  // Find the pager: prefer the next page number (PASSPort shows "1 2 3 … 7"), then a "next" control.
  // Only look below the listings table so filter-form widgets can't match.
  const handle = await page.evaluateHandle((target) => {
    const epins = (t) => (t.innerText.match(/\b\d{3}\d{2}[A-Z]\d{4}\b/g) ?? []).length
    const grid = [...document.querySelectorAll('table')].sort((a, b) => epins(b) - epins(a))[0]
    const below = (el) => !grid || !!(grid.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && !grid.contains(el)
    const disabled = (el) => el.disabled || /disabled|active|current|selected/i.test(el.className) || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-current') != null || /disabled/i.test(el.parentElement?.className ?? '')
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    const clickable = [...document.querySelectorAll('a, button, [role="button"], li[onclick], span[onclick]')].filter((el) => visible(el) && below(el))
    const byNumber = clickable.find((el) => el.textContent?.trim() === String(target) && !disabled(el))
    if (byNumber) return byNumber
    const label = (el) => `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''} ${el.textContent ?? ''}`.trim()
    return clickable.find((el) => /^(next( page)?|›|»|>)$/i.test(label(el)) && !disabled(el)) ?? null
  }, p + 1)
  const next = handle.asElement()
  if (!next) {
    console.log(`No next-page control found after page ${p}.`)
    if (p === 1) console.log('Controls after the grid:', await page.evaluate(() => [...document.querySelectorAll('a, button')].slice(-40).map((el) => el.outerHTML.slice(0, 160))))
    break
  }
  if (p === 1) console.log('Pager control:', await next.evaluate((el) => el.outerHTML.slice(0, 300)))
  // Compare the listing table's EPINs, not every table: the page's layout tables never change.
  const gridEpins = () => {
    const epins = (t) => t.innerText.match(/\b\d{3}\d{2}[A-Z]\d{4}\b/g) ?? []
    const grid = [...document.querySelectorAll('table')].sort((a, b) => epins(b).length - epins(a).length)[0]
    return grid ? epins(grid).join(',') : ''
  }
  const before = await page.evaluate(gridEpins)
  await next.click()
  const changed = await page
    .waitForFunction((b) => {
      const epins = (t) => t.innerText.match(/\b\d{3}\d{2}[A-Z]\d{4}\b/g) ?? []
      const grid = [...document.querySelectorAll('table')].sort((x, y) => epins(y).length - epins(x).length)[0]
      return (grid ? epins(grid).join(',') : '') !== b
    }, before, { timeout: 30_000 })
    .then(() => true)
    .catch(() => false)
  if (!changed) {
    console.log(`Clicking next didn't change the grid after page ${p}.`)
    if (p === 1) await saveDebug('grid unchanged after clicking the pager')
    break
  }
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

// PASSPort prints the EPIN as a prefix of the procurement name ("00225P0002-City-wide …").
// When there's no EPIN column, take it from there and keep the clean title.
for (const r of rows) {
  const m = r.title?.match(/^\s*(\d{3}\d{2}[A-Z]\d{4})\s*[-–:]?\s*(.*)$/)
  if (m) {
    r.epin ||= m[1]
    if (m[2]) r.title = m[2]
  }
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

// Listings we've documented (docs/solicitations/<EPIN>/) stay in the dataset after they close and drop off
// PASSPort's default grid: the app's requirements, sample draft and deep links depend on them.
const pinned = new Set(await readdir(new globalThis.URL('../../docs/solicitations/', import.meta.url)).catch(() => []))
const seen = new Set(rfps.map((r) => r.epin))
const kept = prev.filter((r) => r.epin && pinned.has(r.epin) && !seen.has(r.epin))
if (kept.length) console.log(`Kept ${kept.length} documented listing(s) not in today's grid: ${kept.map((r) => r.epin).join(', ')}`)
rfps.push(...kept)

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
