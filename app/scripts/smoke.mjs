#!/usr/bin/env node
/**
 * Smoke test: build must exist (npm run build). Serves dist/, loads the app in Chromium,
 * and checks the core loop: canvas renders, prompt highlights, a node opens the panel,
 * the Response Studio opens, no console errors. Screenshots go to SHOTS_DIR (default ./.shots).
 *   npm run test:smoke
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const PORT = Number(process.env.SMOKE_PORT) || 4179 // override when another preview server holds the port
const out = process.env.SHOTS_DIR ?? '.shots'
await mkdir(out, { recursive: true })
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const fail = (m) => {
  console.error('✗', m)
  server.kill()
  process.exit(1)
}
const ok = (m) => console.log('✓', m)

try {
  await new Promise((r) => setTimeout(r, 2500))
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const errors = []
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 400, height: 860 }]]) {
    const p = await browser.newPage({ viewport })
    p.on('pageerror', (e) => errors.push(String(e)))
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' })
    await p.waitForSelector('canvas', { timeout: 20_000 })
    await p.waitForTimeout(9000)
    await p.screenshot({ path: `${out}/${name}-1-landing.png` })
    ok(`${name}: canvas rendered`)

    await p.fill('input[aria-label^="Describe"]', 'small AI design studio, software and data platforms')
    await p.keyboard.press('Enter')
    await p.waitForTimeout(3500)
    const chip = p.locator('button[data-match]').first()
    if (!(await chip.count())) fail(`${name}: prompt produced no matches`)
    await p.screenshot({ path: `${out}/${name}-2-prompt.png` })
    ok(`${name}: prompt bar highlights matches`)

    await chip.click()
    await p.waitForSelector('text=Draft a response', { timeout: 5000 }).catch(() => fail(`${name}: node panel did not open`))
    await p.waitForTimeout(3000)
    await p.screenshot({ path: `${out}/${name}-3-node.png` })
    ok(`${name}: node panel opens`)

    await p.click('text=Draft a response')
    await p.waitForSelector('[aria-label="Response studio"]', { timeout: 5000 }).catch(() => fail(`${name}: studio did not open`))
    await p.screenshot({ path: `${out}/${name}-4-studio.png` })
    ok(`${name}: Response Studio opens`)
    await p.keyboard.press('Escape')
    await p.close()
  }

  // Deep link + shortlist: /#EPIN opens that listing; Save toggles (button and S key);
  // closing the panel clears the hash.
  {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    p.on('pageerror', (e) => errors.push(String(e)))
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await p.goto(`http://localhost:${PORT}/#05626P0001`, { waitUntil: 'networkidle' })
    await p.waitForSelector('canvas', { timeout: 20_000 })
    await p
      .waitForSelector('aside h2:has-text("Paid Detail Application")', { timeout: 10_000 })
      .catch((e) => fail(`deep link: /#05626P0001 did not open its panel (${e.message.split('\n')[0]})`))
    if ((await p.evaluate(() => location.hash)) !== '#05626P0001') fail('deep link: hash not kept')
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/desktop-5-deeplink.png` })
    ok('deep link: /#05626P0001 opens its panel')

    const save = p.locator('button[aria-label="Save listing"]')
    const pressed = () => save.getAttribute('aria-pressed')
    if ((await pressed()) !== 'false') fail('save: should start unsaved')
    await save.click()
    if ((await pressed()) !== 'true') fail('save: click did not save')
    const stored = await p.evaluate(() => localStorage.getItem('og.saved'))
    if (!stored?.includes('05626P0001')) fail('save: not persisted to localStorage')
    const chip = (await p.locator('header button', { hasText: 'Saved' }).textContent()) ?? ''
    if (!/Saved\s*1/.test(chip)) fail(`save: Saved chip count did not update (${chip})`)
    await p.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
    await p.keyboard.press('s')
    if ((await pressed()) !== 'false') fail('save: S key did not toggle')
    ok('save toggles (button + S key) and persists')

    await p.keyboard.press('Escape')
    await p.waitForTimeout(300)
    if (await p.evaluate(() => location.hash)) fail('deep link: closing the panel did not clear the hash')
    ok('closing the panel clears the hash')

    await p.goto(`http://localhost:${PORT}/#not-a-real-listing`, { waitUntil: 'networkidle' })
    await p.waitForSelector('[role="status"]:has-text("not in this dataset")', { timeout: 15_000 }).catch(() => fail('deep link: unknown hash not handled'))
    ok('unknown hash is handled')
    await p.close()
  }
  await browser.close()
  if (errors.length) fail(`console errors:\n  ${errors.slice(0, 5).join('\n  ')}`)
  ok('no console errors')
} finally {
  server.kill()
}
