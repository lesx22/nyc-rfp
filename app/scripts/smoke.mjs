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

const PORT = 4179
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
  await browser.close()
  if (errors.length) fail(`console errors:\n  ${errors.slice(0, 5).join('\n  ')}`)
  ok('no console errors')
} finally {
  server.kill()
}
