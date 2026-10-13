# CLAUDE.md

## Project
Opportunity Graph is a 3D explorer and response builder for NYC PASSPort procurement. App in `app/` (Vite + React 19 + TS + r3f). Docs in `docs/`.

## Commands (run from `app/`)
- `npm run dev` · `npm run build` (runs `tsc -b`) · `npm run typecheck`
- `npm run scrape`: Playwright scraper → `public/data/rfps.json`
- `npm run validate`: check `public/data/rfps.json` (or a path; `--json`). Hard errors exit 1; run after any data change. Tests: `npm run test:validate`
- `node scripts/normalize-seed.mjs`: rebuild the dataset from `data-raw/` seed
- `node --experimental-strip-types scripts/rankings.ts` → `docs/RANKINGS.md`

## Skills (`.claude/skills/`, provenance in `SOURCES.md`)
- Visual/motion work: `frontend-design`, `emil-design-eng`, `animate`, `review-animations`, `animation-performance`
- 3D: `r3f-shaders`, `r3f-geometry`, `r3f-postprocessing`, `r3f-animation`, `r3f-interaction`
- QA: `web-design-guidelines` (pinned rules), `break-ui` (worst-case data), `prototype` (side-by-side variants)
- Review any new skill's files before installing; skills run with full permissions.

## Conventions
- Never invent data (values, EPINs, dates). Unknown = `null`; inferred = flagged (`industryInferred`, `confidence`).
- Render loop: mutate instance buffers in `useFrame`; read zustand via `useStore.getState()` inside frames; no per-node React state.
- Warm colours are reserved for heat. Cool palette for categories; `phosphor` is the single UI accent (see `docs/BRAND.md`).
- GLSL lives in `app/src/lib/hud.ts`; render-test shader changes (`npm run test:smoke` catches compile errors). No backticks in shader comments.
- Respect `prefers-reduced-motion`; every gesture needs a click/keyboard alternative.
- Keep `docs/ROADMAP.md` checkboxes current when finishing tasks.
- Before pushing: `npm run build` must pass.
