# Automation plan

**Rule of thumb:** use plain scheduled code for anything repeatable (cheap, predictable, testable). Use Claude agents only where judgment is needed: reading documents, fixing breakage, writing summaries.

## Running now

| Job | Runs on | When | What it does |
|---|---|---|---|
| **Nightly scrape** | GitHub Actions (`.github/workflows/scrape.yml`) | 05:17 New York daily, or on demand with "Run workflow" | Scrapes the PASSPort grid, validates the data, regenerates rankings, builds, and commits only if the data changed. Refuses to write if the row count drops by more than 50%, so a broken scraper can't wipe good data. |
| **Data validator** | Nightly scrape (after scraping, before commit), CI, and inside the scraper before it writes (`npm run validate`) | Every scrape, push and PR | Checks `public/data/rfps.json` (see below). Hard errors fail the job, so bad data never commits. |
| **CI** | GitHub Actions (`.github/workflows/ci.yml`) | Every push and pull request, all branches | `npm ci` → `npm run validate` → validator tests → `npm run build` → Chromium → `npm run test:smoke`. Smoke screenshots are uploaded as the `smoke-screenshots` artifact when the job fails. |
| **Smoke test** | Locally / CI (`npm run test:smoke`) | Before each push | Desktop + mobile: canvas renders, matching, node panel, studio, no console errors. |

### Data validator (`app/scripts/validate-data.mjs`)

Dependency-free Node script. `npm run validate` checks `public/data/rfps.json`; pass a path to check another file, `--json` for a machine-readable summary, `--today YYYY-MM-DD` to pin the closed-date check. Tests: `npm run test:validate` (`node --test`, fixtures in `app/scripts/__fixtures__/`).

- **Hard errors (exit 1):** not valid JSON; missing `meta` or `rfps`; zero rows; a row missing `id` or `title`; duplicate ids; `releaseDate`/`dueDate` not a real ISO `YYYY-MM-DD` date or `null`; `estValueUSD` not `null` or a positive number; `confidence` not `high`/`medium`/`low`.
- **Warnings (exit 0):** % of rows with unknown `dueDate`/`industry`/`agency`/`mainCommodity` (placeholders such as "Unknown agency" and "Unspecified" count as unknown); % with `industryInferred`; EPINs not matching `^\d{3}\d{2}[A-Z]\d{4}$`; due dates already past; suspected duplicates by normalized title + agency; titles under 6 characters; `meta.count` not matching the row count.

The validator never edits data. Fix the scraper or the source, not the numbers: unknown stays `null`, inferred stays flagged.

**Safety rails in the scraper:** it refuses to write if the row count drops by more than 50% (exit 2), and it runs the validator on the scraped rows before writing and refuses on hard errors (exit 3). `FORCE=1` overrides both. It also drops rows whose EPIN repeats (paging overlap) and keeps due dates on the calendar day PASSPort shows.

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
