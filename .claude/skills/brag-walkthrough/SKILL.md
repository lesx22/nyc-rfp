---
name: brag-walkthrough
description: Cut a 60–90 s voice-over-led product walkthrough in HyperFrames from a recorded voice-over, the user's screen recordings and deterministic captures of our own app. Adapted from latent-spaces/brag (brag-slim) for this project. Use for "make/re-cut the video", "walkthrough video", "/brag-walkthrough".
---

# /brag-walkthrough

brag makes 15–25 s launch videos with music carrying the edit. This variant keeps brag's laws (hook first, show the real thing, readable, every frame postable, sound mixed as one piece). What changes:

- **The voice-over is the spine.** The user's recorded VO sets the length (60–90 s) and every cut. Music is a bed under it, never the clock.
- **Real footage over rebuilt UI.** Use the user's screen recordings for third-party sites (PASSPort, City Record, GitHub). The sandbox can't reach NYC hosts, so never fake those screens. Use `video/capture.mjs` (virtual-clock Playwright capture) for our own app.
- **Graph time is the product.** Get to the graph as early as the VO allows. Keep it moving: camera pans and zooms, hub and node clicks with real mouse events.

## 1. Inspect

- **VO:** run `ffmpeg -i vo.mp3 -af silencedetect=n=-35dB:d=0.25 -f null -`. The pauses are the cut points. Map each phrase to its script line (`video/SCRIPT.md`). If a transcriber can run here, use word timings for mid-phrase hits.
- **Recordings:** make timestamped contact sheets (`fps=2,drawtext=%{pts\:hms},tile=5x6`). Log each usable range as `src in–out: what happens`.
- **Privacy pass:** in every range you plan to use, find personal data (contact names, emails, phone numbers, vendor names in worksheets). Pick ranges where it's out of frame, or blur it. The PASSPort listing page shows an agency contact's name and email in the Summary block.

## 2. Plan: `video/BEATS.md`

One row per VO phrase: VO in–out, line, picture, source range. Rules:

- Each cut lands within 0.3 s after a pause ends. Inside a long phrase, cut on stressed words, not mid-word.
- Shots are 1–2.5 s in "list" phrases (a run of quick cuts sells "manual work"). Hold 3–4 s only where the viewer must read.
- Every screen recording gets motion: a slow push (scale 1.0 → 1.08 over the shot), or a punch-in (0.2 s to 1.6–2.2×) onto the thing the VO names.
- **Ending:** back to the product, never a full-screen text card. A small wordmark and URL fade in during the last 2 s.

## 3. Compose in HyperFrames: `video/hf/`

Read the HyperFrames core/cli skills (github.com/heygen-com/hyperframes `skills/`) for the contract. Key rules:

- Standalone `index.html`, root `data-composition-id="main"`, `data-width=1920 data-height=1080 data-duration=<VO length>`.
- One paused GSAP timeline registered at `window.__timelines.main`. Vendor GSAP locally (`assets/gsap.min.js`).
- Each shot is a `<video>` with `data-start`, `data-duration`, `data-media-start` (and `data-playback-rate` for slow-mo) inside a `.inner` wrapper. Motion is tweened on `.inner`, never on the timed element.
- Pre-transcode recordings to 1920-wide, 30 fps, keyframe every 15 frames (`-g 15`), so seeks are exact.
- **Audio:** VO at volume 1. Music bed (if used) at about 0.12, fading in over 1 s and out over the last 2 s. UI clicks (CC0 Kenney SFX from brag) at about 0.25, only on on-screen clicks. Every `<audio>` needs an `id`.
- **Gate:** `npx hyperframes check` passes. Then `snapshot` at each beat midpoint and look at every still before `render`.

## 4. Deliver

- Render to `video/out/opportunity-graph.mp4`. Bake the strongest settled frame in as frame 0 (replace it, don't add one).
- Send it, with one line on what changed and the beat table.
- **Licensing:** brag's SFX are CC0. Its bundled music (ende.app "Happy Beats / Business Moves") has unverified terms. Flag that before the user posts publicly, or render with `--no-music`.
