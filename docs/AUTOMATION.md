# Automation plan

**Rule of thumb:** use plain scheduled code for anything repeatable (cheap, predictable, testable). Use Claude agents only where judgment is needed: reading documents, fixing breakage, writing summaries.

## Running now

| Job | Runs on | When | What it does |
|---|---|---|---|
| **Nightly scrape** | GitHub Actions (`.github/workflows/scrape.yml`) | 05:17 New York daily, or on demand with "Run workflow" | Scrapes the PASSPort grid, regenerates rankings, builds, and commits only if the data changed. Refuses to write if the row count drops by more than 50%, so a broken scraper can't wipe good data. |
| **Smoke test** | Locally / CI (`npm run test:smoke`) | Before each push | Desktop + mobile: canvas renders, matching, node panel, studio, no console errors. |

The scrape runs on GitHub's runners rather than in a Claude cloud session because the Claude environment's network policy currently blocks `passport.cityofnewyork.us`, and GitHub's runners can reach it.

## Agents to add next (Claude Routines, run overnight)

| Agent | Trigger | Job | Needs |
|---|---|---|---|
| **Morning data review** | Daily, after the scrape | Diffs yesterday's vs today's data: new listings, closed listings, deadline changes. Flags anomalies such as a column suddenly empty. Updates the live prototype. Posts a short summary. | Nothing new |
| **Scraper self-heal** | When the nightly Action fails | Reads the failure log, compares it against the live page structure, patches the selectors, runs the scraper, and opens a PR for review. Never pushes data directly. | PASSPort allowed in the Claude environment's network settings |
| **Detail enrichment** | Nightly, new EPINs only | Opens each new listing's detail page and solicitation PDF. Extracts description, contract value, pre-proposal date, M/WBE goals and the requirements list. Writes them with source citations, and leaves fields `null` when the documents don't state them. | Network access + the detail-page scraper (Phase 2) |
| **AI-fit classifier** | After enrichment | Scores each new listing from its full text using Claude structured output, with reasons. Keeps the keyword heuristic as a fallback. | Anthropic API key as a secret |
| **Weekly digest** | Mondays | Summarizes "new this week for builders", what's closing soon, and quiet bids. Publishes it as a page or email. | Phase 3 accounts for per-user digests |

## Later (Phase 4)

- **Traffic heat aggregation:** a Durable Object counts views per listing, and a nightly job rolls them up into 24-hour and 7-day heat.
- **Alerts:** "new software RFPs from DOE" notifications from saved profiles.
