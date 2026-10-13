#!/usr/bin/env node
/**
 * Render the video's two sources frame-by-frame at 30fps into H.264 files:
 *   out/film-a.mp4  title scenes 0–30s       (film.html, deterministic renderAt(t))
 *   out/app.mp4     real app footage, 32s     (production build under a virtual clock, see VIRTUAL_TIME)
 *   out/film-b.mp4  title scenes 62–82s
 * Each frame advances time by exactly 1/30s, so motion stays smooth no matter how slow the renderer is.
 *   node video/capture.mjs [film|app|all]
 *   MAX_SECONDS=3 node video/capture.mjs app   # short test render
 * The app capture serves app/dist, so run `npm run build` in app/ first.
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '../app/node_modules/playwright/index.mjs'

/**
 * App timeline, in seconds from the start of app.mp4. Each cue is when the cursor starts moving
 * toward that control (the move takes ~0.7s, then the click). Re-time these to the voice-over.
 */
export const APP_CUES = {
  // Timed to the voice-over: the app segment plays from 0:26.1 to 0:57.8 of the final video.
  aiOn: 7.7, // "You can narrow it down to software buildouts" (0:34.5)
  aiOff: 10.0,
  type: 10.4, // "or just describe what you do in plain language"
  match: 14.0, // graph turns toward the match (0:40.8)
  openListing: 15.6, // "Here's that listing for rebuilding PASSPort" (0:42.4)
  showRequirements: 18.4, // scroll the panel to the requirements (0:44.5)
  draft: 21.4, // "When you're ready, you can start your response right here" (0:48.2)
  aboutYou: 23.0, // "Add your team and your experience"
  draftStep: 25.6,
  writeDraft: 26.8, // "you get a first draft shaped around exactly what the city asked for" (0:53.6)
  end: 31.7, // last frame
}
export const APP_ORG = 'Example Studio LLC'
export const APP_PROMPT = 'PASSPort e-procurement performance optimization'

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
// CDP capture of the composited page, JPEG straight into the encoder.
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
  for (const [name, a, b] of [['film-a', 0, 26.1], ['film-b', 57.8, 72.5]]) {
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

/**
 * Injected before any app code runs (page.addInitScript). Replaces the page's clocks with a
 * virtual one that only moves when the capture calls window.__step(ms):
 *   performance.now, Date / Date.now, requestAnimationFrame, setTimeout / setInterval,
 *   and every Web Animation (CSS transitions and keyframes, motion's WAAPI animations), which
 *   are paused on first sight and then seeked by exactly the step.
 * The browser's own rAF and compositor keep running in real time (saved on window.__real), so
 * screenshots and input dispatch work normally; the app just sees exactly `ms` pass per step.
 * Unlike page.clock.install(), nothing Playwright or CDP waits on is frozen.
 */
function VIRTUAL_TIME(epoch) {
  const real = {
    now: performance.now.bind(performance),
    raf: window.requestAnimationFrame.bind(window),
    setTimeout: window.setTimeout.bind(window),
    Date: window.Date,
  }
  window.__real = real
  let now = real.now()
  const dateOffset = epoch - now

  performance.now = () => now
  class VDate extends real.Date {
    constructor(...a) { a.length ? super(...a) : super(now + dateOffset) }
    static now() { return Math.floor(now + dateOffset) }
  }
  window.Date = VDate

  let rafId = 0
  let raf = new Map()
  window.requestAnimationFrame = (cb) => { raf.set(++rafId, cb); return rafId }
  window.cancelAnimationFrame = (id) => { raf.delete(id) }

  let timerId = 0
  const timers = new Map()
  const add = (fn, ms, args, every) => {
    const id = ++timerId
    const d = Math.max(0, Number(ms) || 0)
    timers.set(id, { fn, at: now + d, every: every ? Math.max(1, d) : 0, args })
    return id
  }
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, false)
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, true)
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id) }
  const run = (fn, args) => { try { typeof fn === 'function' ? fn(...args) : (0, eval)(fn) } catch (e) { console.error(e) } }

  const seen = new WeakSet()
  const tickAnimations = (ms) => {
    for (const a of document.getAnimations()) {
      if (!seen.has(a)) { seen.add(a); a.pause(); continue } // new since last step: holds at t=0 this frame
      if (a.playState === 'finished') continue
      a.currentTime = (a.currentTime ?? 0) + ms
    }
  }

  const sub = (ms) => {
    const end = now + ms
    // Due timers fire in order, each seeing its own due time.
    for (let guard = 0; guard < 10000; guard++) {
      let next = null
      for (const entry of timers) if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry
      if (!next) break
      const [id, t] = next
      now = Math.max(now, t.at)
      if (t.every) t.at += t.every
      else timers.delete(id)
      run(t.fn, t.args)
    }
    now = end
    tickAnimations(ms)
    const q = raf
    raf = new Map()
    for (const cb of q.values()) { try { cb(now) } catch (e) { console.error(e) } }
  }
  /** Advance virtual time by `ms` in `n` equal rAF ticks; resolves once queued React work has run. */
  window.__step = (ms, n = 1) => {
    for (let i = 0; i < n; i++) sub(ms / n)
    return new Promise((r) => real.setTimeout(r, 0))
  }
}
class Stop extends Error {}

async function app() {
  const srv = serve(['npx', 'vite', 'preview', '--port', '4301', '--strictPort'], join(ROOT, 'app'))
  await new Promise((r) => setTimeout(r, 3000))
  const t0 = Date.now()
  const p = await browser.newPage({ viewport: { width: W, height: H } })
  await p.addInitScript(VIRTUAL_TIME, new Date('2026-10-13T15:00:00').getTime())
  p.on('pageerror', (e) => console.error('pageerror:', e.message))
  await p.goto('http://127.0.0.1:4301/', { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  // Two rAF ticks per video frame: drei's PerformanceMonitor then measures 60fps and keeps the post
  // effects on (at 30 ticks/s it decides the GPU is struggling and drops the vignette mid-shot).
  const SUB = Number(process.env.SUBSTEPS ?? 2)
  const step = () => p.evaluate(([ms, n]) => window.__step(ms, n), [1000 / FPS, SUB])
  // A drawn cursor, since headless screenshots don't include the OS pointer.
  await p.addStyleTag({ content: `#vc{position:fixed;left:0;top:0;width:22px;height:22px;z-index:99999;pointer-events:none;transform:translate(960px,700px)} #vc svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))} #vc.down svg{transform:scale(.85)}` })
  await p.evaluate(() => {
    const d = document.createElement('div')
    d.id = 'vc'
    d.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8.5-6.6 1.6L8.6 19z" fill="#fff" stroke="#020405" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    document.body.appendChild(d)
  })
  // Warm up: let the scene settle before recording. 4s of app time also passes the Rig's 3.5s
  // idle wait, so the camera is already drifting on frame 0.
  for (let i = 0; i < 4 * FPS; i++) await step()

  const enc = encoder(join(OUT, 'app.mp4'))
  let frame = 0
  let cur = { x: 960, y: 700 }
  const tick = async () => {
    await step()
    await enc.write(await shot(p))
    frame++
  }
  const LIMIT = Number(process.env.MAX_SECONDS ?? Infinity)
  const until = async (sec) => {
    while (frame < Math.round(Math.min(sec, LIMIT) * FPS)) await tick()
    if (frame >= LIMIT * FPS) throw new Stop()
  }
  const setCursor = (x, y, down = false) => p.evaluate(([x, y, down]) => { const c = document.getElementById('vc'); c.style.transform = `translate(${x}px,${y}px)`; c.classList.toggle('down', down) }, [x, y, down])
  const centre = async (locator) => {
    await locator.waitFor({ state: 'visible', timeout: 10000 })
    const box = await locator.boundingBox()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const moveTo = async (locator, seconds = 0.7) => {
    const to = await centre(locator)
    const n = Math.round(seconds * FPS)
    for (let i = 1; i <= n; i++) {
      const k = 1 - Math.pow(1 - i / n, 3)
      const x = cur.x + (to.x - cur.x) * k, y = cur.y + (to.y - cur.y) * k
      await setCursor(x, y)
      await p.mouse.move(x, y) // real hover states follow the drawn cursor
      await tick()
    }
    cur = to
  }
  // Clicks are raw CDP input at the cursor position: locator.click()'s actionability checks poll
  // requestAnimationFrame, which only advances when we step.
  const click = async (locator) => {
    await moveTo(locator)
    await setCursor(cur.x, cur.y, true)
    await p.mouse.down()
    await tick(); await tick()
    await p.mouse.up()
    await setCursor(cur.x, cur.y, false)
  }

  // Smoothly scroll a container so a target sits near its top, over the given seconds.
  const scrollInto = async (container, target, seconds) => {
    await target.waitFor({ state: 'attached', timeout: 10000 })
    const [from, to] = await container.evaluate((el, t) => {
      const node = el.querySelector(t)
      return [el.scrollTop, Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 24)]
    }, 'section[aria-label^="Requirements"]')
    const n = Math.round(seconds * FPS)
    for (let i = 1; i <= n; i++) {
      const k = 0.5 - Math.cos((Math.PI * i) / n) / 2
      await container.evaluate((el, y) => (el.scrollTop = y), from + (to - from) * k)
      await tick()
    }
  }

  const C = APP_CUES
  try {
    // 0–12s: the network drifts; AI-buildable filter on, then off.
    await until(C.aiOn)
    await click(p.getByRole('button', { name: 'AI-buildable' }))
    await until(C.aiOff)
    await click(p.getByRole('button', { name: 'AI-buildable' }))
    // 12–20s: describe what you do; the graph turns toward the match.
    await until(C.type)
    await click(p.locator('input[aria-label^="Describe"]'))
    for (const ch of APP_PROMPT) {
      await p.keyboard.type(ch)
      await tick(); await tick()
    }
    await until(C.match)
    await click(p.getByRole('button', { name: 'Match' }))
    // Open the listing, show its requirements, then start a response and write the first draft.
    await until(C.openListing)
    await click(p.locator('button[data-match]', { hasText: 'E-Procurement' }).first())
    await until(C.showRequirements)
    await scrollInto(p.locator('aside'), p.locator('aside section[aria-label^="Requirements"]'), 1.2)
    await until(C.draft)
    await click(p.getByRole('button', { name: 'Draft a response' }))
    await until(C.aboutYou)
    await click(p.getByRole('dialog').locator('nav button', { hasText: 'About you' }))
    await click(p.getByLabel('Organization name'))
    for (const ch of APP_ORG) {
      await p.keyboard.type(ch)
      await tick()
    }
    await until(C.draftStep)
    await click(p.getByRole('dialog').locator('nav button', { hasText: 'Draft' }))
    await until(C.writeDraft)
    await click(p.getByRole('button', { name: 'Write first draft' }))
    await until(C.end)
  } catch (e) {
    if (!(e instanceof Stop)) throw e
    console.log(`MAX_SECONDS=${LIMIT}: stopped early (test run)`)
  }
  await enc.done()
  console.log(`✓ app.mp4 (${frame} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s wall)`)
  await p.close()
  srv.kill()
}

try {
  if (which === 'film' || which === 'all') await film()
  if (which === 'app' || which === 'all') await app()
} finally {
  await browser.close()
}
