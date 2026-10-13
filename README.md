# Opportunity Graph (NYC)

![Landing](docs/img/landing.png)

A 3D, motion-designed way to explore NYC procurement opportunities from [PASSPort](https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public), get matched to the ones that fit you, and draft a response.

- **Proposal:** [`docs/PROPOSAL.md`](docs/PROPOSAL.md) restates the brief, with the decisions and stack
- **Roadmap / task list:** [`docs/ROADMAP.md`](docs/ROADMAP.md) gives the phases, validation gates and build order
- **Rankings:** [`docs/RANKINGS.md`](docs/RANKINGS.md) lists open solicitations ranked by AI-buildable fit and by value
- **Research:** [`docs/RESEARCH.md`](docs/RESEARCH.md) surveys libraries and repos, plus Vercel's guidelines
- **Brand:** [`docs/BRAND.md`](docs/BRAND.md)

## Run it

```bash
cd app
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
npm run scrape       # refresh public/data/rfps.json from live PASSPort (needs network access to the site)
node --experimental-strip-types scripts/rankings.ts   # regenerate docs/RANKINGS.md
```

## What's in v0

- A WebGL "neural network" (three.js + react-three-fiber) with bloom, idle orbit, travelling pulses, drag-to-orbit and trackpad zoom
- A hierarchy of Industry → Agency → solicitation, remappable live (Agency → Industry, Commodity…)
- A prompt bar ("tell me about you") that rotates the graph to your matches and re-highlights them
- Click a cluster for stats and a ranked list; click a node for details, an explained AI-fit score and a PASSPort link
- Filters for industry, agency, commodity, due window and AI-buildable status, plus a deadline-heat toggle
- Response Studio: brief → about you → documents → outline (.md) → submission checklist
- Runs entirely in the frontend; data is static JSON

## Data note

The current dataset is a **54-row seed** collected from public, search-indexed copies of PASSPort, the Databook mirror and City Record, because this build environment's network policy blocks `passport.cityofnewyork.us`. Inferred fields are flagged in the data and in the UI. Run `npm run scrape` from a normal network to load the full live grid.
