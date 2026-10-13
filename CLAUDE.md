# CLAUDE.md

## Project
Opportunity Graph is a 3D explorer and response builder for NYC PASSPort procurement. App in `app/` (Vite + React 19 + TS + r3f). Docs in `docs/`.

## Commands (run from `app/`)
- `npm run dev` · `npm run build` (runs `tsc -b`) · `npm run typecheck`
- `npm run scrape`: Playwright scraper → `public/data/rfps.json`
- `node scripts/normalize-seed.mjs`: rebuild the dataset from `data-raw/` seed
- `node --experimental-strip-types scripts/rankings.ts` → `docs/RANKINGS.md`

## Conventions
- Never invent data (values, EPINs, dates). Unknown = `null`; inferred = flagged (`industryInferred`, `confidence`).
- Render loop: mutate instance buffers in `useFrame`; read zustand via `useStore.getState()` inside frames; no per-node React state.
- Warm colours are reserved for heat. Cool palette for categories (see `docs/BRAND.md`).
- Respect `prefers-reduced-motion`; every gesture needs a click/keyboard alternative.
- Keep `docs/ROADMAP.md` checkboxes current when finishing tasks.
- Before pushing: `npm run build` must pass.
