# Video

A 71.5s walkthrough of Opportunity Graph, cut to the recorded voice-over (71s).

- **Beat sheet (v2, the spec):** [`BEATS.md`](./BEATS.md). Cue times are voice-over seconds, cut on its measured pauses
- **Script:** [`SCRIPT.md`](./SCRIPT.md) (final, version B)
- **Intro, beats 1–5 (VO 0–21.2):** PASSPort screen recordings, still to come. Until then `film.html` scenes s1/s2 stand in (`out/film-a.mp4`)
- **App footage, beats 6–14 (VO 21.2–71.5):** [`capture.mjs`](./capture.mjs) records the production build under a stepped virtual clock at a steady 30fps. Frame 0 of `out/app.mp4` is VO 21.2 (`APP_START`); every cue in `CUES` is in VO seconds. The app is loaded with `?capture=1`, which exposes `window.__cap` (camera pose + screen projection, see `CaptureHook` in `app/src/components/Graph.tsx`), so camera moves are deterministic and hubs/nodes are clicked with real mouse events where they are drawn. The browser-window frame (beat 13) and the sign-off line (beat 14) are overlays drawn in the captured page.
- **Assembly:** [`assemble.sh`](./assemble.sh) joins intro + app and mixes in the voice-over

```bash
cd app && npm run build && cd ..
node video/capture.mjs all                       # film-a (placeholder intro) + app → video/out/
bash video/assemble.sh video/out/voiceover.mp3   # → video/out/opportunity-graph.mp4
INTRO=path/to/recordings-cut.mp4 bash video/assemble.sh video/out/voiceover.mp3   # with the real beats 1–5
MAX_SECONDS=5 node video/capture.mjs app         # quick test of the first 5s of app footage
```

The optional nightly-scrape clip (R4) belongs over VO ~61.9–63.3, inside beat 13.

The output files (`video/out/`) and the voice recording are not committed.
