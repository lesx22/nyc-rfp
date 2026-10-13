# Opportunity Graph: proposal

> A new way to browse NYC procurement. It opens on a 3D, motion-designed "neural network" of every open City solicitation. You tell it who you are, it turns toward the opportunities that fit you, and it walks you from a listing to a draft proposal you can submit.

*Status: v0 prototype in `/app`. Prepared 2026-10-13.*

---

## 1. The problem

[NYC PASSPort](https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public) lists every open City solicitation. It works as a system of record but is hard to browse:

- **A flat, paginated grid.** The grid shows Procurement Name (prefixed with its EPIN), Agency, RFx Status, Release Date, Due Date, Industry, Main Commodity and Procurement Method. Program only appears on detail pages. Nothing shows the shape of the market: which agencies are buying, what they're buying, or where the gaps are.
- **No personal relevance.** A three-person design and AI studio in Brooklyn sees the same wall of rows as a construction firm.
- **A steep path from "interesting" to "submitted".** Vendor enrollment, solicitation PDFs, M/WBE plans and forms all have to be worked out alone. That shuts out exactly the young, small and first-time vendors the City says it wants.

## 2. Who it's for

Millennial and Gen Z builders (freelancers, studios, nonprofits, early-stage companies) who want to contribute to the NYC economy and have never bid on a City contract. They expect consumer-grade software: beautiful, fast, exploratory and honest.

## 3. The experience

| Moment | What happens |
|---|---|
| **Land** | A black canvas shows a slowly orbiting 3D network of glowing clusters. Light pulses travel along the edges like signals in a neural net, and a few nodes glow brighter, labelled "Picked for you". |
| **Explore** | Click and drag empty space to orbit, and pinch or scroll to fly in and out. Hover a cluster to see its label; click it to fly there. |
| **Tell it about you** | Type into the bottom prompt bar, e.g. *"I'm a 3-person AI + design studio, love civic data"*. The graph rotates to face your best matches and re-highlights them; everything else dims. |
| **Cluster** | Clicking a cluster opens a side panel with the count, average AI fit, known contract value, next deadline, sub-clusters, and its opportunities ranked by fit. |
| **Node** | Clicking a node opens the full listing: dates, countdown, EPIN, commodity, value, an explained AI-fit score, and a link to the real PASSPort listing. |
| **Respond** | "Generate RFP response" opens the **Response Studio**: brief, then about you, then documents, then draft, then submission checklist. Later phases add a Claude agent that chats with you, reads your documents and the RFP PDF, and drafts a compliant, submittable response. |
| **Filter** | A traditional top bar filters by Industry, Agency, Main Commodity, due window and "AI-buildable" status, and lets you remap the hierarchy (Industry → Agency, or Agency → Industry, Commodity, Program). |
| **Heat** | Warm colours (amber → orange → rose) mark heat; the rest of the graph stays cool. v0 heat is deadline urgency. Later, heat is **live page-view traffic**, so you can see where competition is gathering and find quieter bids. |

## 4. Information architecture

```
root (NYC)
 └─ L1 cluster: Industry        (14 PASSPort values, e.g. Construction · Goods · Human/Client Service · Professional Services - IT Related · Standard Services)
     └─ L2 cluster: Agency       (≈40 agencies)
         └─ leaf: Solicitation   (EPIN)
             attributes → Program, Main Commodity, Release/Due date, Status, value, AI-fit
```

**Decision: Industry first, then Agency.** Industry is a small, stable set (14 values, and only about 6 to 8 are populated at a time), so the top level reads at a glance as a few big constellations. Agency has about 40 values and makes a good second ring. Industry also correlates most with "can AI build this?", so the first split already separates software work from shelters and paving. You can remap this at any time; nodes animate to their new positions rather than jumping.

## 5. Ranking: what "AI could automate end to end" means

Each solicitation gets an **AI-fit score (0–100)** that says how much of the delivery could be produced end to end by an AI-assisted team. Software and web builds, data platforms, dashboards, content and digital services score high. Physical construction, goods supply and in-person human services score low. v0 uses a transparent keyword-and-industry heuristic, and every point it adds is shown in the UI. Phase 3 replaces it with an LLM classifier run over the full solicitation text.

The second ranking is **contract value**. PASSPort's browse grid does **not** expose dollar values, so values come from solicitation documents, award notices or the City Record, and stay empty when unknown. See [`RANKINGS.md`](./RANKINGS.md) for the current ranked list.

## 6. Recommended stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** | One language across the UI, scraper, edge functions and AI tool schemas. |
| App | **Vite + React 19** (v0) → **Next.js App Router** on Vercel (Phase 2+) | Vite gives the fastest loop for a canvas-first single-page app. Move to Next when server routes are needed (AI, auth, realtime) and for SEO on listing pages. |
| 3D | **three.js + @react-three/fiber + drei + @react-three/postprocessing** | It's WebGL, which is the right call: the "infinite canvas" is a 3D scene with orbit and dolly camera controls. r3f lets us use instancing (one draw call for every node), custom motion and bloom. WebGPU (three's `WebGPURenderer`) is a later drop-in once Safari support is reliable. |
| Not chosen (yet) | `react-force-graph-3d` | The fastest demo, but harder to art-direct. Sigma.js and Cosmos are 2D only and built for 10k–1M nodes, far more than we need at 200–2,000. |
| Layout | Deterministic hierarchical layout (Fibonacci spheres, hash-seeded) | It's stable between visits, needs no simulation jitter and makes remaps animate cleanly. `d3-force-3d` in a worker is the upgrade path. |
| UI | **Tailwind v4**, Geist, `motion`, then shadcn/ui + Radix + cmdk | The Vercel/Linear look. Accessible primitives. ⌘K for the prompt bar. |
| State | **zustand** | Per-frame reads without React re-renders, as the pmndrs ecosystem recommends. |
| AI | **Claude API** through the **Vercel AI SDK** (`generateObject` / tool use) | Turns the prompt bar into `{highlightIds, filters, rationale}`. Response Studio runs as an agent with document tools. |
| Data | Static JSON (v0), then **Postgres (Supabase or Neon)** with a scheduled scraper | v0 runs entirely in the browser, with no backend. |
| Realtime heat | **Cloudflare Durable Objects (PartyServer)** or **Supabase Realtime** | Aggregates page-view counts per node and pushes throttled deltas at 1–2 Hz. |

**Can it be all frontend?** Yes, for v0 and v1. The data is public and small, so it ships as static JSON, refreshed by a scheduled scraper (GitHub Action). A backend is only needed for (a) server-side LLM calls, to keep API keys private, (b) accounts and saved drafts, and (c) live traffic heat.

## 7. Claude tooling and working practices

- **Claude Code** to build: `CLAUDE.md` holds project conventions, **plan mode** for each phase, **subagents** for parallel research and scraping, **`/code-review`** and **`/security-review`** before merges, a **SessionStart hook** so cloud sessions install dependencies automatically, and **Playwright** for screenshot QA of the canvas.
- **Claude API** inside the product: prompt-bar matching and Response Studio. Use structured outputs for highlight IDs, prompt caching for the RFP corpus, and Files and PDF support for solicitation documents.
- **Vercel agent skill `web-design-guidelines`** (from `vercel-labs/agent-skills`) as a design lint during reviews.
- **Claude Agent SDK** if the Response Studio becomes a long-running drafting agent with file tools.

## 8. Key decisions (made, or still to make)

| # | Decision | Default taken | Revisit when |
|---|---|---|---|
| D1 | Hierarchy order | Industry → Agency (user can remap) | User testing |
| D2 | Renderer | r3f + custom instancing | If node count exceeds 20k |
| D3 | Backend in v0 | None: static JSON | Phase 2 (AI) |
| D4 | AI-fit scoring | Explainable heuristic | Phase 3 LLM classifier |
| D5 | Value data source | Manual or document-derived; null if unknown | When a reliable source is found |
| D6 | Heat semantics | Deadline urgency → live page views | Phase 4 |
| D7 | Submission | Hand off to PASSPort (no direct submission API) | If MOCS offers an API |
| **Open** | Data licensing / terms of use for scraping PASSPort | Polite, low-frequency scraping of public pages | Confirm with MOCS / NYC Open Data |
| **Open** | Accounts and auth provider | — | Phase 3 |

## 9. Risks

- **Data access:** PASSPort has no public API. The scraper can break when the UI changes. Mitigate with a header-driven column mapping, a nightly CI run, and alerts. Also check whether NYC Open Data publishes an equivalent feed.
- **Accuracy:** AI-fit and matching are advisory. Always link through to the source of truth.
- **Over-motion:** respect `prefers-reduced-motion`, and offer keyboard and button alternatives to drag and pinch.
- **Responsible drafting:** responses are drafts. The vendor reviews, signs and submits in PASSPort.

See [`ROADMAP.md`](./ROADMAP.md) for the phased task list and [`RESEARCH.md`](./RESEARCH.md) for the library survey.
