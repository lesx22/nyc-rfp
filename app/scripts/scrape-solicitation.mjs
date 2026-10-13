#!/usr/bin/env node
/**
 * Capture ONE PASSPort solicitation detail page and every document linked from it.
 *
 *   node scripts/scrape-solicitation.mjs <passport-detail-url> [--id 00225P0002]
 *   HEADED=1 node scripts/scrape-solicitation.mjs https://passport.cityofnewyork.us/page.aspx/en/bpm/process_manage_extranet/26900 --id 00225P0002
 *
 * Writes to ../data-raw/solicitations/<id>/ (relative to app/):
 *   page.html, page.txt, page.png      the detail page as rendered
 *   files/<n>-<name>                   each linked document (PDF, DOCX, XLSX, ...)
 *   index.json                         every link found, what was saved, sizes, sha256, failures
 *
 * PASSPort is an ASP.NET app: some attachments are plain links, others start a download from a
 * button or postback. Both paths are tried. Anything that can't be fetched is recorded in
 * index.json with the reason (e.g. login required) instead of being silently skipped.
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const url = args.find((a) => a.startsWith('http'))
if (!url) {
  console.error('Usage: node scripts/scrape-solicitation.mjs <passport-detail-url> [--id EPIN]')
  process.exit(1)
}
const idArg = args.indexOf('--id')
const DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt|rtf)(\?|$)|download|attachment|document|getfile|file\.aspx/i

const browser = await chromium.launch({ headless: !process.env.HEADED, executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ acceptDownloads: true, userAgent: 'Mozilla/5.0 (opportunity-graph research scraper)' })
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
await page.waitForTimeout(1500)

const text = await page.evaluate(() => document.body.innerText)
const epin = idArg >= 0 ? args[idArg + 1] : (text.match(/\b\d{3}\d{2}[A-Z]\d{4}\b/) ?? [])[0] ?? 'unknown'
const dir = join(process.cwd(), '..', 'data-raw', 'solicitations', epin)
await mkdir(join(dir, 'files'), { recursive: true })

await writeFile(join(dir, 'page.html'), await page.content())
await writeFile(join(dir, 'page.txt'), text)
await page.screenshot({ path: join(dir, 'page.png'), fullPage: true })

// Every link and clickable element, with enough context to tell documents apart.
const links = await page.evaluate(() =>
  [...document.querySelectorAll('a, button, [onclick]')].map((el, i) => ({
    i,
    tag: el.tagName.toLowerCase(),
    text: (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || '').trim().slice(0, 200),
    href: el.getAttribute('href') ? new URL(el.getAttribute('href'), location.href).href : null,
    onclick: el.getAttribute('onclick')?.slice(0, 200) ?? null,
  })),
)

const safe = (s) => s.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'file'
const results = []
let n = 0
for (const l of links) {
  const looksLikeDoc = DOC_RE.test(`${l.href ?? ''} ${l.text} ${l.onclick ?? ''}`)
  if (!looksLikeDoc) {
    results.push({ ...l, kind: 'link' })
    continue
  }
  n++
  const entry = { ...l, kind: 'document' }
  try {
    let body, name, type
    if (l.href && /^https?:/.test(l.href) && !/javascript:/i.test(l.href)) {
      // Plain link: fetch with the page's cookies.
      const res = await ctx.request.get(l.href, { timeout: 60_000 })
      if (!res.ok()) throw new Error(`HTTP ${res.status()}`)
      type = res.headers()['content-type'] ?? ''
      if (type.includes('text/html')) throw new Error('returned an HTML page (maybe a login or viewer page), not a file')
      body = await res.body()
      const cd = res.headers()['content-disposition'] ?? ''
      name = decodeURIComponent((cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i) ?? [])[1] ?? '') || l.text || new URL(l.href).pathname.split('/').pop()
    } else {
      // Button / postback: click and wait for the browser download.
      const el = page.locator('a, button, [onclick]').nth(l.i)
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), el.click()])
      name = dl.suggestedFilename()
      const path = await dl.path()
      body = await (await import('node:fs/promises')).readFile(path)
      type = ''
    }
    const file = `${String(n).padStart(2, '0')}-${safe(name)}`
    await writeFile(join(dir, 'files', file), body)
    Object.assign(entry, { savedAs: `files/${file}`, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), contentType: type })
    console.log(`✓ ${file} (${Math.round(body.length / 1024)} KB)`)
  } catch (e) {
    entry.error = String(e.message ?? e)
    console.log(`✗ ${l.text || l.href}: ${entry.error}`)
  }
  results.push(entry)
}

const docs = results.filter((r) => r.kind === 'document')
await writeFile(
  join(dir, 'index.json'),
  JSON.stringify({ epin, url, fetchedAt: new Date().toISOString(), title: await page.title(), documents: docs, otherLinks: results.filter((r) => r.kind === 'link' && r.href) }, null, 2),
)
console.log(`\n${docs.filter((d) => d.savedAs).length}/${docs.length} documents saved → data-raw/solicitations/${epin}/`)
await browser.close()
