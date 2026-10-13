#!/usr/bin/env node
/**
 * Render the video's two sources frame-by-frame at 30fps into H.264 files:
 *   out/film-a.mp4  title scenes 0–30s       (film.html, deterministic renderAt(t))
 *   out/app.mp4     real app footage, 32s     (production build under a fake clock)
 *   out/film-b.mp4  title scenes 62–82s
 * Each frame advances time by exactly 1/30s, so motion stays smooth no matter how slow the renderer is.
 *   node video/capture.mjs [film|app|all]
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '../app/node_modules/playwright/index.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'video', 'out')
const FPS = 30
const W = 1920, H = 1080
mkdirSync(OUT, { recursive: true })
const which = process.argv[2] ?? 'all'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
})

function encoder(file) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] })
  return {
    async write(buf) {
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    },
    done: () => new Promise((r) => { ff.on('close', r); ff.stdin.end() }),
  }
}
// CDP capture: Playwright's screenshot waits for an animation frame, which never arrives under a fake clock.
const cdpCache = new WeakMap()
async function shot(p) {
  let cdp = cdpCache.get(p)
  if (!cdp) cdpCache.set(p, (cdp = await p.context().newCDPSession(p)))
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
  return Buffer.from(data, 'base64')
}
const serve = (args, cwd) => spawn(args[0], args.slice(1), { cwd, stdio: 'ignore' })

/* ---------------- title scenes ---------------- */
async function film() {
  const srv = serve(['python3', '-m', 'http.server', '4300', '--bind', '127.0.0.1'], ROOT)
  await new Promise((r) => setTimeout(r, 1200))
  const p = await browser.newPage({ viewport: { width: W, height: H } })
  await p.goto('http://127.0.0.1:4300/video/film.html', { waitUntil: 'networkidle' })
  await p.evaluate(async () => { await window.ready; await document.fonts.ready })
  for (const [name, a, b] of [['film-a', 0, 30], ['film-b', 62, 82]]) {
    const enc = encoder(join(OUT, `${name}.mp4`))
    const n = Math.round((b - a) * FPS)
    for (let i = 0; i < n; i++) {
      await p.evaluate((t) => window.renderAt(t), a + i / FPS)
      await enc.write(await shot(p))
    }
    await enc.done()
    console.log(`✓ ${name}.mp4 (${n} frames)`)
  }
  await p.close()
  srv.kill()
}

/* ---------------- app footage ---------------- */
async function app() {
  const srv = serve(['npx', 'vite', 'preview', '--port', '4301', '--strictPort'], join(ROOT, 'app'))
  await new Promise((r) => setTimeout(r, 3000))
  const p = await browser.newPage({ viewport: { width: W, height: H } })
  await p.clock.install({ time: new Date('2026-10-13T15:00:00') })
  await p.goto('http://127.0.0.1:4301/', { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  // A drawn cursor, since headless screenshots don't include the OS pointer.
  await p.addStyleTag({ content: `#vc{position:fixed;left:0;top:0;width:22px;height:22px;z-index:99999;pointer-events:none;transform:translate(960px,700px)} #vc svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))} #vc.down svg{transform:scale(.85)}` })
  await p.evaluate(() => {
    const d = document.createElement('div')
    d.id = 'vc'
    d.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8.5-6.6 1.6L8.6 19z" fill="#fff" stroke="#020405" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    document.body.appendChild(d)
  })
  // Warm up: let the scene settle before recording.
  for (let i = 0; i < 90; i++) await p.clock.runFor(1000 / FPS)

  const enc = encoder(join(OUT, 'app.mp4'))
  let frame = 0
  let cur = { x: 960, y: 700 }
  const tick = async () => {
    await p.clock.runFor(1000 / FPS)
    await enc.write(await shot(p))
    frame++
  }
  const LIMIT = Number(process.env.MAX_SECONDS ?? Infinity)
  const until = async (sec) => { while (frame < Math.round(Math.min(sec, LIMIT) * FPS)) await tick(); if (frame >= LIMIT * FPS) throw new Error('MAX_SECONDS reached (test run)') }
  const setCursor = (x, y, down = false) => p.evaluate(([x, y, down]) => { const c = document.getElementById('vc'); c.style.transform = `translate(${x}px,${y}px)`; c.classList.toggle('down', down) }, [x, y, down])
  const moveTo = async (locator, seconds = 0.7) => {
    const box = await locator.boundingBox()
    const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const n = Math.round(seconds * FPS)
    for (let i = 1; i <= n; i++) {
      const k = 1 - Math.pow(1 - i / n, 3)
      await setCursor(cur.x + (to.x - cur.x) * k, cur.y + (to.y - cur.y) * k)
      await tick()
    }
    cur = to
  }
  const click = async (locator) => {
    await moveTo(locator)
    await setCursor(cur.x, cur.y, true)
    await tick(); await tick()
    await locator.click({ noWaitAfter: true })
    await setCursor(cur.x, cur.y, false)
  }

  // 0–12s: the network drifts; AI-buildable filter on, then off.
  await until(4.2)
  await click(p.getByRole('button', { name: 'AI-buildable' }))
  await until(9.3)
  await click(p.getByRole('button', { name: 'AI-buildable' }))
  // 12–20s: describe what you do; the graph turns toward the match.
  await until(11.2)
  const input = p.locator('input[aria-label^="Describe"]')
  await click(input)
  for (const ch of 'PASSPort e-procurement performance optimization') {
    await p.keyboard.type(ch)
    await tick(); await tick()
  }
  await until(15.6)
  await click(p.getByRole('button', { name: 'Match' }))
  // 20–32s: open the listing, then start a response.
  await until(20)
  await click(p.locator('button[data-match]', { hasText: 'E-Procurement' }).first())
  await until(25.6)
  await click(p.getByRole('button', { name: 'Draft a response' }))
  await until(28.2)
  await click(p.getByRole('dialog').getByRole('button', { name: 'Draft', exact: false }).filter({ hasText: /^4?Draft$/ }).first())
  await until(32)
  await enc.done()
  console.log(`✓ app.mp4 (${frame} frames)`)
  await p.close()
  srv.kill()
}

try {
  if (which === 'film' || which === 'all') await film()
  if (which === 'app' || which === 'all') await app()
} finally {
  await browser.close()
}
