# Video

A 72s walkthrough of Opportunity Graph, cut to the recorded voice-over.

- **Script:** [`SCRIPT.md`](./SCRIPT.md) (final, version B)
- **Title scenes:** [`film.html`](./film.html), rendered frame by frame through `window.renderAt(t)`
- **App footage:** [`capture.mjs`](./capture.mjs), the production build recorded under a stepped virtual clock at a steady 30fps. Cue times are in `APP_CUES`.
- **Assembly:** [`assemble.sh`](./assemble.sh) joins title A + app + title B and mixes in the voice-over

```bash
cd app && npm run build && cd ..
node video/capture.mjs all                 # film-a, app, film-b → video/out/
bash video/assemble.sh path/to/voiceover.mp3   # → video/out/opportunity-graph.mp4
```

The output files (`video/out/`) and the voice recording are not committed.
