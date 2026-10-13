# Roadmap & task list

Phases ship in order. Each phase ends with an explicit **validation gate**. Don't start the next phase until the gate passes. ✅ = done in this repo, ◻︎ = to do.

---

## Phase 0: Foundations & research (½ day)

**Why first:** everything downstream depends on the data shape and on choosing a renderer we won't regret.

- ✅ Restate the brief as a proposal → [`PROPOSAL.md`](./PROPOSAL.md)
- ✅ Survey graph, WebGL, motion, UI and realtime libraries (stars, licenses, maintenance) → [`RESEARCH.md`](./RESEARCH.md)
- ✅ Choose the stack (TypeScript · Vite/React · r3f + drei + postprocessing · Tailwind v4 · zustand)
- ✅ Define the data schema (`app/src/types.ts`), mirroring PASSPort's columns plus enrichment fields
- ✅ Write the PASSPort scraper (`app/scripts/scrape-passport.mjs`, Playwright, header-driven column mapping)
- ✅ Seed dataset: 54 real solicitations found through public, search-indexed sources (PASSPort index, Databook mirror, City Record) → `app/public/data/rfps.json`. Provenance flags included; no invented values
- ✅ AI-fit ranking + value ranking → [`RANKINGS.md`](./RANKINGS.md). Values are unpublished for every row, so value enrichment is a Phase 2 task
- ◻︎ **Run the scraper from a network that can reach PASSPort** and commit the full dataset (this sandbox's egress policy blocks the host)
- ◻︎ Confirm PASSPort terms of use and scraping cadence; check NYC Open Data for an official feed
- ◻︎ Brand kit v1: logo mark, type scale, colour tokens → [`BRAND.md`](./BRAND.md) (v0 done)

**Gate:** the full dataset loads with zero schema errors, and every PASSPort column maps to a field.

---

## Phase 1: Graph scaffold (v0 → v0.5, 2–4 days) ← *build complete; usability gate pending*

**Why this order:** prove the hero interaction first, because it's the riskiest and most differentiating part. UI chrome comes after the canvas feels right.

1. ✅ Canvas shell: black background, fog, `CameraControls` (drag to orbit, trackpad to dolly), idle auto-orbit as the cover state
2. ✅ Deterministic hierarchical layout: root → Industry → Agency → solicitation
3. ✅ Instanced nodes (one draw call), hub spheres, edges merged into one `LineSegments`
4. ✅ Motion design: bloom, traveling "neural" pulses, eased lerps on remap, reduced-motion fallback
5. ✅ Hover labels (L1 always, L2 on hover or parent selection)
6. ✅ Click a cluster → camera fly-to + cluster panel; click a node → fly-to + detail panel
7. ✅ Prompt bar: local relevance → rotate the camera to the matches and re-highlight; "Picked for you" on load; ⌘K
8. ✅ Filter bar: Industry · Agency · Commodity · Due window · AI-buildable; hierarchy remap; heat toggle
9. ✅ Response Studio v0: brief → about you → documents → outline (.md download) → submission checklist
10. ✅ Keyboard (arrows, +/−, 0, Esc; S saves the selected listing, Phase 2) and button alternatives to orbit and zoom
11. ✅ Mobile: side panel becomes a bottom sheet under 640px; 40px camera buttons
12. ✅ `AdaptiveDpr` + `PerformanceMonitor` (drops bloom on weak GPUs); render loop pauses when the tab is hidden
13. ✅ Playwright smoke test, desktop + mobile (`npm run test:smoke`)
14. ✅ Legend (cluster colours, heat scale, data source) + in-app build-progress drawer
15. ✅ Live prototype published as a claude.ai artifact
16. ✅ Scale pass: all cluster hubs in one draw call, low-poly nodes, layout + camera scale with row count, EPIN → procurement type + Type filter; tested with a synthetic 1,500-row set (`scripts/stress-data.mjs`, never shipped)
17. ✅ **Visual direction C, Instrument Panel**: SDF ring nodes (value/confidence/match encodings), signal-packet edges, polar grid + radar sweep with urgency pings, one-time boot sweep, HUD readout + crosshair tag, mono/expanded type, bracketed chrome (see [`BRAND.md`](./BRAND.md))
18. ✅ Agent skills installed and reviewed: `.claude/skills/` (see `SOURCES.md`)
19. ✅ v1.1 "Quiet Instrument" after review: radar removed, shaded sphere dots, focus dimming (75%→10% opacity), less text. Reviewed step by step before shipping

**Gate (usability test with 5 target users):**
- 4 of 5 can find a relevant opportunity in under 60 seconds without help
- At least 55 fps on an M1 Air and at least 30 fps on a mid-range Android with 1,000 nodes
- "Would you rather use this or PASSPort to browse?" → 4 of 5 pick this

**Key decisions to confirm here:** D1 hierarchy order; label density; whether 2D "map mode" is needed for accessibility.

---

## Phase 2: Real data pipeline & deploy (v1, 2–3 days)

**Why now:** an MVP on a stale snapshot misleads people. Make the data fresh before adding AI.

- ✅ GitHub Action: nightly scrape → rankings → build → commit if changed, with a >50% row-drop guard (see [`AUTOMATION.md`](./AUTOMATION.md)). Cron activates once merged to the default branch.
- ✅ Data validator (`npm run validate`): schema hard errors fail the nightly job before commit; coverage, EPIN, closed-date and duplicate warnings in the job summary. Also runs inside the scraper before it writes
- ✅ CI on every push and PR (`.github/workflows/ci.yml`): validate → validator tests → build → smoke test, screenshots uploaded on failure
- ✅ Shareable deep links: selecting a listing sets a bare `#EPIN` hash (falls back to the row id; unreserved characters only so it survives claude.ai artifact hosting), loading a hash opens and flies to that listing, closing clears it (`history.replaceState`, no history spam); unknown hashes show a notice. "Copy link" in the panel with a read-only fallback field
- ✅ Shortlist: Save toggle (bookmark) in the panel and **S** on the selected listing; ids in `localStorage` (`og.saved`, guarded, works without storage); "Saved" filter chip with count; saved count in the Legend; `saved: Set<string>` exposed in the store for a future visual mark
- ✅ Calendar export: "Add deadline to calendar" downloads an RFC 5545 `.ics` (all-day on the due date, 3-day reminder; disabled when no due date is published). `buildIcs` in `app/src/lib/ics.ts`, tested by `npm run test:unit`
- ◻︎ Claude Routines: morning data review, scraper self-heal, detail enrichment (see `AUTOMATION.md`)
- ◻︎ Detail-page scraper: description, pre-proposal date, documents list, contact, procurement method
- ◻︎ Contract value enrichment: parse "estimated amount" from solicitation documents and City Record notices; keep values null when unknown
- ◻︎ Migrate to **Next.js App Router on Vercel** with `/o/[epin]` listing pages (shareable, SEO-friendly, OG images)
- ◻︎ Analytics events (`view_node`, `open_studio`, `click_passport`) for later heat and funnel analysis

**Gate:** data is under 24 hours old; shareable links work; Lighthouse ≥ 90 on listing pages.

---

## Phase 2.5: End-to-end demo on a real listing (00225P0002)

**Why:** prove the whole loop (discover → understand → respond → check → export) on one real solicitation: [00225P0002 City-wide E-Procurement Performance Optimization (PASSPort 2026)](./solicitations/00225P0002/README.md). It's the listing that sparked the project, and it's the story of the demo video.

- ✅ Single-solicitation scraper (`npm run scrape:solicitation`): detail page + every linked document + index with hashes and failures
- ✅ Documents captured (5 provided by the user): proposal template, Addendum #3, special case memo, M/WBE worksheet, Appendix A
- ◻︎ Still needed: main RFS (evaluation weights), Appendix F, Attachment E/PRC/SCY, addenda #1, #2 and later
- ✅ 81 requirements, 5 evaluation areas, key dates, M/WBE goal and the submission checklist extracted into `requirements.json`, each with a verified PDF page (`build_requirements.py`)
- ✅ Appendix A: 60 contract obligations with article and page (`appendix-a-obligations.json`); proposal-relevant ones summarised in the listing README
- ◻︎ Side panel: show requirement counts and key dates from `requirements.json` when present
- ◻︎ Response Studio: load the listing's real checklist and evaluation criteria; draft each required section against its requirement; compliance matrix
- ◻︎ Export a submission package (narrative .docx/.md, forms list, attachments index)
- ◻︎ Video: re-cut the response segment with the real requirements on screen

**Gate:** every requirement in `requirements.json` cites its source, and the draft shows each required section mapped to a requirement or marked `[NEEDS INPUT]`.

---

## Phase 3: AI layer (v1.5, 1–2 weeks)

**Why after data:** the AI is only as good as the corpus it reasons over.

- ◻︎ `/api/match`: Claude via AI SDK `generateObject` → `{ highlightIds, filters, rationale }`; prompt-cache the corpus; stream rationale into the prompt bar
- ◻︎ LLM AI-fit classifier: score each solicitation from its full text; keep reasons; cache by EPIN + hash
- ◻︎ Response Studio agent: chat UI (AI Elements or assistant-ui), PDF/DOCX ingestion of the RFP plus user documents, requirement extraction into a compliance matrix, section drafting, missing-info prompts, export to DOCX/PDF
- ◻︎ Accounts (Clerk or Supabase Auth) and saved drafts (Postgres)
- ◻︎ Guardrails: cite RFP sections, flag unverifiable claims, never auto-submit

**Gate:** 3 pilot vendors produce a draft they'd actually submit; at least 80% of extracted requirements are correct against a hand-labelled set.

---

## Phase 4: Live heat & collaboration (v2)

- ◻︎ Page-view counter per node via Durable Objects (PartyServer) or Supabase Realtime; 1–2 Hz throttled deltas
- ◻︎ Heat layer v2: warm overlay = views over the last 24 hours/7 days; toggle between "Deadline" and "Traffic"; "Quiet bids" filter (high fit, low heat)
- ◻︎ Presence: anonymous "N people exploring this cluster"; optional shared sessions for teams
- ◻︎ Privacy review: aggregate only, with no per-user tracking shown publicly

**Gate:** heat updates within 2 seconds; no PII in realtime payloads; users report the "quiet bids" view as useful.

---

## Phase 5: Polish & growth

- Alerts ("new software RFPs from DOE"), weekly digest email
- Saved profiles and team workspaces
- WebGPU renderer, custom shaders (fresnel nodes, curved edges), sound design (opt-in)
- Partnerships: MOCS, SBS, NYC small-business programs

---

## Build order inside the UI (why this sequence)

1. **Canvas + camera**: if orbit and zoom don't feel great, nothing else matters
2. **Layout + nodes**: validates the information architecture visually
3. **Click → panel**: proves the graph is useful, not only pretty
4. **Prompt bar**: the "for me" moment; depends on 1–3
5. **Filters**: the familiar escape hatch for power users
6. **Heat**: an extra layer; only meaningful once there's data and traffic
7. **Response Studio**: the conversion path; needs a selected opportunity, so it comes last

## Engineering practices

- TypeScript strict; `npm run typecheck` and `npm run build` must pass before every push
- No per-node React state in the render loop; mutate instance buffers in `useFrame`
- Accessibility: focus rings, `aria-label`s, reduced motion, keyboard alternatives
- Claude Code: work in plan mode per phase; `/code-review` before merge; subagents for research and scraping; keep `CLAUDE.md` current
