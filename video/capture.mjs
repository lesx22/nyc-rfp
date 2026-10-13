#!/usr/bin/env node
/**
 * Render the video's sources frame-by-frame at 30fps into H.264 files:
 *   out/film-a.mp4  placeholder intro, VO 0–21.2s (film.html s1/s2; beats 1–5 become PASSPort screen recordings)
 *   out/app.mp4     real app footage, VO 21.2–71.5s (beats 6–14, see BEATS.md), production build under a
 *                   virtual clock (see VIRTUAL_TIME)
 * Each frame advances time by exactly 1/30s, so motion stays smooth no matter how slow the renderer is.
 *   node video/capture.mjs [film|app|all]
 *   MAX_SECONDS=3 node video/capture.mjs app   # short test render (app seconds, from VO 21.2)
 * The app capture serves app/dist, so run `npm run build` in app/ first.
 *
 * The app is loaded with ?capture=1, which mounts a small capture-only handle (window.__cap, see
 * CaptureHook in app/src/components/Graph.tsx): the camera is set once per frame from the tweens
 * below, and hubs/nodes are clicked with real mouse events at their projected screen positions.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '../app/node_modules/playwright/index.mjs'

/**
 * Cues are written on the ORIGINAL voice-over clock (BEATS.md). If vo_edit.py has tightened the VO,
 * vo-map.json maps them onto the edited clock; a time inside a removed span lands where speech resumes.
 */
const MAP_FILE = join(dirname(fileURLToPath(import.meta.url)), 'vo-map.json')
const VO_MAP = existsSync(MAP_FILE) ? JSON.parse(readFileSync(MAP_FILE, 'utf8')) : null
const remap = (t) => {
  if (!VO_MAP) return t
  for (const [a, b, n] of VO_MAP.segments) {
    if (t < a) return n
    if (t <= b) return n + (t - a)
  }
  const [, b, n] = VO_MAP.segments.at(-1)
  return n + (b - VO_MAP.segments.at(-1)[0]) + (t - b)
}
/** app.mp4 frame 0 is this voice-over time (edited clock when vo-map.json exists). */
export const APP_START = remap(21.2)
export const APP_END = remap(71.5)
export const INTRO_END = APP_START // film-a.mp4 covers 0 → APP_START

/**
 * Cues in voice-over seconds. Pauses measured with ffmpeg silencedetect (−35 dB); each action starts
 * as its line starts. Cursor moves take ~0.45s, so the click lands ~0.5s after the cue.
 */
export const CUES = {
  // 6 · 21.2 "So on a Tuesday night…": cut from black, the graph forms, the orbit starts.
  form: 21.25,
  // 7 · 26.1 "This is the opportunity graph": wide, rotating, slow dolly in.
  dolly: 25.9,
  // 8 · 28.1 "every open opportunity, grouped by industry | and then by agency, | so you can see…"
  flyIndustry: 28.1,
  clickIndustry: 28.9, // cursor starts toward the industry hub
  clickAgency: 29.45, // "and then by agency" (29.43)
  clickNode: 31.55, // "so you can see where the work is" (31.69)
  pullBack: 33.1,
  // 9 · 34.5 "You can narrow it down to software buildouts, | or just describe what you do…" (36.6)
  aiOn: 34.5,
  type: 36.6,
  // 10 · 41.2 "and it finds work that fits your team."
  match: 41.2,
  zoomMatch: 42.3,
  // 11 · 43.5 "Here's that listing for rebuilding PASSPort. | The scope, deadline, and requirements…"
  openListing: 43.5,
  showRequirements: 46.4,
  // 12 · 51.0 "…start your response right here. Add your team… | and you get a first draft" (56.3)
  draft: 51.0,
  aboutYou: 52.1,
  draftStep: 54.9,
  writeDraft: 55.85,
  // 13 · 57.9 "The site's live on Vercel…": the app shrinks into a browser window with the live URL.
  live: 57.9,
  // 14 · 63.8 "Essentially, I just wanted…": back to the graph, slow pull-back, sign-off for the last 2s.
  outro: 63.8,
  signoff: 69.4,
  end: 71.5,
}
for (const k of Object.keys(CUES)) CUES[k] = remap(CUES[k])
export const APP_ORG = 'Example Studio LLC'
export const APP_PROMPT = 'software for NYC schools'
export const LISTING = '00225P0002'
export const INDUSTRY = 'Construction' // beat 8: the biggest industry cluster
export const LIVE_URL = 'nyc-rfp-app.vercel.app'

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
const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
// Servers are killed by the PID we spawned, never by pattern.
const serve = (args, cwd) => spawn(args[0], args.slice(1), { cwd, stdio: 'ignore', detached: true })
const stop = (srv) => { try { process.kill(-srv.pid, 'SIGTERM') } catch { srv.kill() } }

/* ---------------- placeholder intro ---------------- */
async function film() {
  const port = await freePort()
  const srv = serve(['python3', '-m', 'http.server', String(port), '--bind', '127.0.0.1'], ROOT)
  try {
    await new Promise((r) => setTimeout(r, 1200))
    const p = await browser.newPage({ viewport: { width: W, height: H } })
    await p.goto(`http://127.0.0.1:${port}/video/film.html`, { waitUntil: 'networkidle' })
    await p.evaluate(async () => { await window.ready; await document.fonts.ready })
    const enc = encoder(join(OUT, 'film-a.mp4'))
    const n = Math.round(INTRO_END * FPS)
    for (let i = 0; i < n; i++) {
      await p.evaluate((t) => window.renderAt(t), i / FPS)
      await enc.write(await shot(p))
    }
    await enc.done()
    console.log(`✓ film-a.mp4 (${n} frames)`)
    await p.close()
  } finally {
    stop(srv)
  }
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

/** Capture-only overlays: drawn cursor, black open, browser frame (beat 13), sign-off (beat 14). */
const OVERLAY_CSS = `
#vc{position:fixed;left:0;top:0;width:22px;height:22px;z-index:99999;pointer-events:none;transform:translate(960px,700px)}
#vc svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))} #vc.down svg{transform:scale(.85)}
#blk{position:fixed;inset:0;background:#020405;z-index:99998;pointer-events:none}
#root{transform-origin:50% 50%}
#bf{position:fixed;left:0;top:0;z-index:99990;pointer-events:none;opacity:0;display:flex;align-items:center;gap:14px;padding:0 16px;box-sizing:border-box;height:44px;
  background:#0a1215;border:1px solid rgb(120 220 230 / .16);border-bottom:none;border-radius:10px 10px 0 0}
#bf i{width:11px;height:11px;border-radius:50%;background:rgb(216 238 240 / .18);display:block}
#bf .url{flex:1;display:flex;justify-content:center}
#bf .url span{display:flex;align-items:center;gap:9px;height:28px;padding:0 16px;border-radius:6px;background:rgb(255 255 255 / .05);
  font:500 15px "JetBrains Mono",ui-monospace,monospace;color:#d8eef0;letter-spacing:.01em}
#bf .url svg{opacity:.55}
#so{position:fixed;left:0;right:0;bottom:64px;z-index:99991;pointer-events:none;opacity:0;text-align:center;
  font:500 22px "JetBrains Mono",ui-monospace,monospace;letter-spacing:.04em;color:rgb(216 238 240 / .82)}
#so b{font-weight:600;color:#5ce1e6}
`

async function app() {
  // A fresh free port every run: a leftover server on a fixed port once served a stale build.
  const port = await freePort()
  const srv = serve(['npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], join(ROOT, 'app'))
  try {
    await new Promise((r) => setTimeout(r, 3000))
    await record(port)
  } finally {
    stop(srv)
  }
}

async function record(port) {
  const t0 = Date.now()
  const p = await browser.newPage({ viewport: { width: W, height: H } })
  await p.addInitScript(VIRTUAL_TIME, new Date('2026-10-13T15:00:00').getTime())
  await p.addInitScript(() => { try { localStorage.clear() } catch { /* fresh profile anyway */ } })
  p.on('pageerror', (e) => console.error('pageerror:', e.message))
  // Hold the dataset until frame 0, so the graph forms on camera (beat 6).
  let release
  const gate = new Promise((r) => (release = r))
  await p.route('**/data/rfps.json', async (route) => { await gate; await route.continue() })
  await p.goto(`http://127.0.0.1:${port}/?capture=1`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(() => document.fonts.ready)
  // Two rAF ticks per video frame: drei's PerformanceMonitor then measures 60fps and keeps the post
  // effects on (at 30 ticks/s it decides the GPU is struggling and drops the vignette mid-shot).
  const SUB = Number(process.env.SUBSTEPS ?? 2)
  let camNext = null // camera pose to apply before the next step
  const step = () => {
    const c = camNext
    camNext = null
    return p.evaluate(([ms, n, c]) => { if (c && window.__cap) window.__cap.lookAt(c.eye, c.target); return window.__step(ms, n) }, [1000 / FPS, SUB, c])
  }
  await p.addStyleTag({ content: OVERLAY_CSS })
  await p.evaluate((url) => {
    const add = (id, html) => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; document.body.appendChild(d); return d }
    add('vc', '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8.5-6.6 1.6L8.6 19z" fill="#fff" stroke="#020405" stroke-width="1.4" stroke-linejoin="round"/></svg>')
    add('blk', '')
    add('bf', `<i></i><i></i><i></i><div class="url"><span><svg width="12" height="14" viewBox="0 0 12 14"><rect x="1" y="6" width="10" height="7.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>${url}</span></div><i style="opacity:0"></i><i style="opacity:0"></i><i style="opacity:0"></i>`)
    add('so', `<b>Opportunity Graph</b> · ${url}`)
  }, LIVE_URL)
  // Warm up without data (the scene compiles its shaders, the post stack settles).
  for (let i = 0; i < 3 * FPS; i++) await step()
  if (!(await p.evaluate(() => !!window.__cap))) throw new Error('window.__cap missing: build the app first (npm run build) — capture hook not found')

  const enc = encoder(join(OUT, 'app.mp4'))
  let frame = 0
  let cur = { x: 1180, y: 760 }
  const vo = () => APP_START + frame / FPS
  const cap = (fn, arg) => p.evaluate(fn, arg)

  /* ----- camera: spherical tweens around a target, applied once per frame ----- */
  const sph = ({ eye, target }) => {
    const o = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]
    const dist = Math.hypot(...o)
    return { target, dist, az: Math.atan2(o[0], o[2]), el: Math.asin(o[1] / dist) }
  }
  const pose = ({ target, dist, az, el }) => ({
    target,
    eye: [target[0] + dist * Math.sin(az) * Math.cos(el), target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(az) * Math.cos(el)],
  })
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
  const easeOut = (k) => 1 - Math.pow(1 - k, 3)
  let drive = null
  const view = () => cap(() => window.__cap.view())
  /**
   * Move from wherever the camera is now to `to` ({target, dist, az | turn, el}) over `seconds`,
   * then keep orbiting at `drift` rad/s. Starting from the live pose keeps hand-offs from the app's
   * own fly-tos seamless.
   */
  const camTo = async (to, seconds, { drift = 0.035, curve = ease } = {}) => {
    const from = sph(await view())
    const az = to.az ?? from.az + (to.turn ?? 0)
    // Shortest way round when an absolute azimuth is given.
    let dAz = az - from.az
    if (to.az != null) dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz))
    drive = { from, to: { target: to.target ?? from.target, dist: to.dist ?? from.dist, el: to.el ?? from.el }, dAz, f0: frame, n: Math.max(1, Math.round(seconds * FPS)), drift, curve }
  }
  const camFree = () => (drive = null) // hand the camera to the app (its own fly-to on select)
  const camFrame = () => {
    if (!drive) return
    const { from, to, dAz, f0, n, drift, curve } = drive
    const j = frame - f0 + 1
    const k = curve(Math.min(1, j / n))
    const lerp = (a, b) => a + (b - a) * k
    camNext = pose({
      target: from.target.map((v, i) => lerp(v, to.target[i])),
      dist: from.dist * Math.pow(to.dist / from.dist, k),
      az: from.az + dAz * k + drift * (j / FPS),
      el: lerp(from.el, to.el),
    })
  }

  const tick = async () => {
    camFrame()
    await step()
    await enc.write(await shot(p))
    frame++
  }
  const LIMIT = Number(process.env.MAX_SECONDS ?? Infinity)
  const until = async (t) => {
    const f = Math.round(Math.min(t - APP_START, LIMIT) * FPS)
    while (frame < f) await tick()
    if (frame >= LIMIT * FPS) throw new Stop()
  }
  /** Advance app time without recording (inside a hard cut, so exit animations don't show). */
  const skip = async (seconds) => { for (let i = 0; i < seconds * FPS; i++) { camFrame(); await step() } }
  const setCursor = (x, y, down = false) => p.evaluate(([x, y, down]) => { const c = document.getElementById('vc'); c.style.transform = `translate(${x}px,${y}px)`; c.classList.toggle('down', down) }, [x, y, down])
  const css = (sel, style) => p.evaluate(([sel, style]) => { for (const el of document.querySelectorAll(sel)) Object.assign(el.style, style) }, [sel, style])

  // Locator waits poll requestAnimationFrame, which only advances when we step, so wait by stepping
  // frames ourselves (these frames are recorded, so keep waits short and cue them early).
  const present = async (locator, seconds = 4) => {
    for (let i = 0; i < seconds * FPS; i++) {
      if ((await locator.count()) > 0 && (await locator.first().isVisible())) return
      await tick()
    }
    throw new Error(`Timed out waiting for ${locator}`)
  }
  const centre = async (locator) => {
    await present(locator)
    const box = await locator.first().boundingBox()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  /** Glide the cursor to a point; `to` may be a function re-evaluated each frame (a moving node). */
  const glide = async (to, seconds = 0.45) => {
    const n = Math.round(seconds * FPS)
    const start = { ...cur }
    for (let i = 1; i <= n; i++) {
      const tgt = typeof to === 'function' ? await to() : to
      const k = easeOut(i / n)
      const x = start.x + (tgt.x - start.x) * k, y = start.y + (tgt.y - start.y) * k
      await setCursor(x, y)
      await p.mouse.move(x, y) // real hover states follow the drawn cursor
      await tick()
      cur = { x, y }
    }
  }
  // Clicks are raw CDP input at the cursor position: locator.click()'s actionability checks poll
  // requestAnimationFrame, which only advances when we step.
  const press = async () => {
    await setCursor(cur.x, cur.y, true)
    await p.mouse.down()
    await tick(); await tick()
    await p.mouse.up()
    await setCursor(cur.x, cur.y, false)
  }
  const click = async (locator, seconds) => { await glide(await centre(locator), seconds); await press() }
  const project = (id) => cap((id) => window.__cap.project(id), id)
  let clusterList = []
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  /**
   * Where to aim at a node. Points are picked within 0.9 world units of the ray, and a node in a
   * one-listing agency sits within ~1 unit of its agency hub, so aiming at the node's centre can pick
   * the hub instead. Aim just past the node, on the side away from its hub (as seen by the camera).
   */
  const aimPoint = async (id) => {
    const n = await cap((id) => window.__cap.pos(id), id)
    const hub = clusterList.find((c) => c.level === 2 && c.members.includes(id))
    if (!n || !hub) return n
    const h = await cap((id) => window.__cap.pos(id), hub.id)
    const { eye } = await view()
    const vd = sub3(n, eye), vl = Math.hypot(...vd)
    const d = sub3(n, h)
    const k = dot(d, vd) / (vl * vl)
    const perp = [d[0] - vd[0] * k, d[1] - vd[1] * k, d[2] - vd[2] * k]
    const pl = Math.hypot(...perp)
    if (Math.hypot(...d) > 2.5 || pl < 1e-3) return n
    return n.map((x, i) => x + (perp[i] / pl) * 0.7)
  }
  /** Click a hub or node in the graph where it is drawn; the app's own handler opens the panel. */
  const clickGraph = async (id, seconds = 0.45) => {
    const isNode = !id.includes(':')
    const where = async () => (isNode ? cap((w) => window.__cap.projectAt(w), await aimPoint(id)) : project(id))
    await glide(where, seconds)
    const at = await where()
    cur = { x: at.x, y: at.y }
    await setCursor(at.x, at.y)
    await p.mouse.move(at.x, at.y)
    camFree()
    await press()
    const sel = await cap(() => window.__cap.store.getState().selected)
    if (sel?.id !== id) console.warn(`! clicked ${id} at ${vo().toFixed(2)}s but selected = ${JSON.stringify(sel)}`)
  }
  const scrollPanel = async (seconds) => {
    const aside = p.locator('aside')
    await present(p.locator('aside section[aria-label^="Requirements"]'))
    const [from, to] = await aside.evaluate((el) => {
      const node = el.querySelector('section[aria-label^="Requirements"]')
      return [el.scrollTop, Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 24)]
    })
    const n = Math.round(seconds * FPS)
    for (let i = 1; i <= n; i++) {
      const k = 0.5 - Math.cos((Math.PI * i) / n) / 2
      await aside.evaluate((el, y) => (el.scrollTop = y), from + (to - from) * k)
      await tick()
    }
  }
  /** Beat 13: shrink the app into a browser window with the live URL (k = 0 → full screen, 1 → framed). */
  const browserFrame = (k) =>
    p.evaluate((k) => {
      const s = 1 - 0.2 * k
      const hc = 1080 * s, wc = 1920 * s
      const top = 540 - (hc + 44 * k) / 2 + 44 * k
      const root = document.getElementById('root')
      root.style.transform = k ? `translateY(${22 * k}px) scale(${s})` : ''
      root.style.borderRadius = k ? `0 0 ${10 * k}px ${10 * k}px` : ''
      root.style.overflow = k ? 'hidden' : ''
      root.style.outline = k ? `1px solid rgb(120 220 230 / ${0.16 * k})` : ''
      document.body.style.background = k ? `radial-gradient(ellipse at 50% 40%, #0c1a1e, #020405 70%)` : ''
      const bf = document.getElementById('bf')
      Object.assign(bf.style, { opacity: String(k), left: `${960 - wc / 2}px`, width: `${wc}px`, top: `${top - 44}px` })
    }, k)
  const hud = (o) =>
    p.evaluate((o) => {
      const app = document.querySelector('#root > div')
      for (const el of app.children) if (!el.querySelector('canvas')) el.style.opacity = String(o)
    }, o)

  const C = CUES
  try {
    /* 6 · cut from black, the graph forms */
    await camTo({ target: [0, 0, 0], dist: 70, az: 0.9, el: 0.32 }, 0.01, { drift: 0 })
    await until(C.form)
    release()
    for (let i = 0; i < 2 * FPS; i++) {
      if (await cap(() => window.__cap.store.getState().nodes.length > 0)) break
      await tick()
    }
    const H0 = await cap(() => window.__cap.homeDist())
    const clusters = await cap(() => window.__cap.clusters())
    clusterList = clusters
    const industry = clusters.find((c) => c.level === 1 && c.label === INDUSTRY) ?? clusters.find((c) => c.level === 1)
    const agency = clusters.filter((c) => c.level === 2 && c.id.startsWith(`2:${industry.label}/`)).sort((a, b) => b.members.length - a.members.length)[0]
    const node = agency.members[0]
    const P = (id) => cap((id) => window.__cap.pos(id), id)
    const hubPos = await P(industry.id)
    console.log(`industry ${industry.id} · agency ${agency.id} · node ${node} · homeDist ${H0}`)
    // The black lifts as the nodes burst out from the centre; the camera pulls back and orbits.
    for (let i = 0; i <= 12; i++) {
      if (i === 1) await camTo({ dist: H0 * 1.3, turn: 0.55, el: 0.22 }, C.dolly - vo(), { drift: 0.02, curve: easeOut })
      await css('#blk', { opacity: String(1 - i / 12) })
      await tick()
    }
    /* 7 · wide, rotating, slow dolly in */
    await until(C.dolly)
    await camTo({ dist: H0 * 1.0, turn: 0.22, el: 0.2 }, C.flyIndustry - C.dolly, { drift: 0.04 })
    /* 8 · fly into an industry cluster, click its hub, then an agency hub, then a node */
    await until(C.flyIndustry)
    const outAz = Math.atan2(hubPos[0], hubPos[2])
    await camTo({ target: hubPos, dist: 78, az: outAz + 0.35, el: 0.28 }, 1.1, { drift: 0.03 })
    await until(C.clickIndustry)
    await clickGraph(industry.id, 0.5)
    await until(C.clickAgency)
    await clickGraph(agency.id, 0.45)
    await until(C.clickNode)
    await clickGraph(node, 0.4)
    await until(C.pullBack)
    await p.keyboard.press('Escape')
    await camTo({ target: [0, 0, 0], dist: H0 * 1.05, turn: -0.5, el: 0.24 }, 1.3, { drift: 0.035 })
    await glide({ x: 1180, y: 300 }, 0.6)
    /* 9 · AI-buildable filter, then describe yourself */
    await until(C.aiOn)
    await click(p.getByRole('button', { name: 'AI-buildable' }))
    await until(C.type)
    await click(p.locator('input[aria-label^="Describe"]'))
    await p.keyboard.press('Control+A')
    // Human typing speed (~10 characters a second), not one character per frame.
    for (const ch of APP_PROMPT) {
      await p.keyboard.type(ch)
      for (let k = 0; k < 3; k++) await tick()
    }
    /* 10 · match: the graph turns to the matches, then a quick zoom onto the lit nodes */
    await until(C.match)
    await glide(await centre(p.getByRole('button', { name: 'Match' })))
    camFree()
    await press()
    await until(C.zoomMatch)
    const listingPos = await P(LISTING)
    const listingHub = await P(clusters.find((c) => c.level === 2 && c.members.includes(LISTING)).id)
    const v = sph(await view())
    // Look across the listing-to-hub offset (not along it) so the node and its agency hub separate on screen.
    const off = sub3(listingPos, listingHub)
    const side = Math.atan2(off[2], -off[0])
    const zAz = [side, side + Math.PI].sort((a, b) => Math.abs(Math.atan2(Math.sin(a - v.az), Math.cos(a - v.az))) - Math.abs(Math.atan2(Math.sin(b - v.az), Math.cos(b - v.az))))[0]
    await camTo({ target: listingPos, dist: 40, az: zAz, el: 0.15 }, 1.0, { drift: 0.01 })
    /* 11 · click the PASSPort listing in the graph, then show its requirements */
    await until(C.openListing)
    await clickGraph(LISTING, 0.45)
    await until(C.openListing + 1.6)
    await camTo({ turn: 0.18 }, C.draft - vo(), { drift: 0, curve: (k) => k })
    await until(C.showRequirements)
    await scrollPanel(1.2)
    /* 12 · Response Studio: About you → Draft → Write first draft */
    await until(C.draft)
    await click(p.getByRole('button', { name: 'Draft a response' }))
    await until(C.aboutYou)
    await click(p.getByRole('dialog').locator('nav button', { hasText: 'About you' }), 0.4)
    await click(p.getByLabel('Organization name'), 0.35)
    for (const ch of APP_ORG) {
      await p.keyboard.type(ch)
      await tick()
    }
    await until(C.draftStep)
    await click(p.getByRole('dialog').locator('nav button', { hasText: 'Draft' }), 0.4)
    await until(C.writeDraft)
    await click(p.getByRole('button', { name: 'Write first draft' }), 0.4)
    /* 13 · hard cut: clean graph, which then shrinks into a browser window with the live URL */
    await until(C.live)
    await p.mouse.move(1900, 20)
    await css('#vc', { opacity: '0' })
    await cap(() => { const s = window.__cap.store.getState(); s.openStudio(null); s.select(null); s.setFilters({ digitalOnly: false }) })
    await camTo({ target: [0, 0, 0], dist: H0 * 1.15, turn: 0.6, el: 0.2 }, 0.01, { drift: 0.04 })
    await skip(0.5)
    await camTo({ dist: H0 * 1.05, turn: 0.15 }, C.outro - C.live, { drift: 0.04, curve: (k) => k })
    for (let i = 1; i <= 18; i++) {
      await browserFrame(ease(i / 18))
      await tick()
    }
    /* 14 · hard cut back: close on a cluster, slow pull-back to the whole constellation */
    await until(C.outro)
    await browserFrame(0)
    const endHub = clusters.filter((c) => c.level === 1)[1] ?? industry
    const ep = await P(endHub.id)
    await camTo({ target: ep, dist: 26, az: Math.atan2(ep[0], ep[2]) + 0.5, el: 0.12 }, 0.01, { drift: 0 })
    await skip(0.1)
    await camTo({ target: [0, 0, 0], dist: H0 * 1.55, turn: 1.1, el: 0.3 }, C.signoff + 0.6 - C.outro, { drift: 0.025, curve: (k) => 1 - Math.pow(1 - k, 2.2) })
    for (let i = 1; i <= 30; i++) {
      await hud(1 - i / 30)
      await tick()
    }
    await until(C.signoff)
    for (let i = 1; i <= 21; i++) {
      await css('#so', { opacity: String(easeOut(i / 21)) })
      await tick()
    }
    await until(C.end)
  } catch (e) {
    if (!(e instanceof Stop)) throw e
    console.log(`MAX_SECONDS=${LIMIT}: stopped early (test run)`)
  }
  await enc.done()
  console.log(`✓ app.mp4 (${frame} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s wall)`)
  await p.close()
}

try {
  if (which === 'film' || which === 'all') await film()
  if (which === 'app' || which === 'all') await app()
} finally {
  await browser.close()
}
