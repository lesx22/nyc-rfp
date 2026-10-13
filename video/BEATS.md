# Video v2: beat sheet

> **v3 edit (current):** `vo_edit.py` tightens the voice-over from 71.0 s to 54.7 s. It drops three lines: "Hey, I've had this idea…", "So on a Tuesday night, in between cooking dinner and cleaning up," and "…and a script pulls the newest opportunities… every night, so it stays current. Essentially,". It also shrinks every long pause to 0.24 s. Times below are still on the **original** clock. `vo-map.json` maps them onto the edit, and both `capture.mjs` and `hf/build.py` read it. Intro shots crossfade (0.3 s) with eased moves. The prompt bar types "software for NYC schools"; 00225P0002 is opened from its node, not the prompt.

Cuts land on the voice-over's pauses (measured with ffmpeg `silencedetect`, −35 dB, ≥0.25 s).
Times are in the 71 s voice-over. Line text is the version B script; the split points are the real pauses.

| # | VO time | Line | Picture | Source |
|---|---|---|---|---|
| 1 | 0.0–4.2 | Hey, I've had this idea for a long time and never got around to it. | PASSPort browse page loads; slow push-in on the grid | **R1** |
| 2 | 4.7–8.0 | New York City posts all of its contract opportunities on PASSPort. | Scroll down the grid, rows streaming past | **R1** |
| 3 | 8.4–13.9 | If you're a small business building software, finding the right one and responding to it means a lot of manual work. | 3–4 fast cuts (~1.4 s each): open a filter dropdown, page 2 → 3, open a listing, its document list / a PDF | **R1, R2** |
| 4 | 14.4–17.0 | Then I was pleasantly surprised to find this listing. | Search "00225P0002" / the listing row; click it | **R2** |
| 5 | 17.3–20.7 | The city was actually asking for help rebuilding PASSPort itself. | The listing page; punch-in on "PASSPort 2026" / "City-wide E-Procurement…" | **R2** (or City Record page, **R3**) |
| 6 | 21.2–25.6 | So on a Tuesday night, in between cooking dinner and cleaning up, I started prototyping. | Hard cut to black → the graph forms (nodes fade in), camera starts its orbit | App |
| 7 | 26.1–27.7 | This is the opportunity graph: | Wide, rotating; slow dolly in | App |
| 8 | 28.1–34.2 | every open opportunity, grouped by industry and then by agency, so you can see where the work is and who's asking for it. | Fly into an industry cluster (~2 s), click its hub → cluster panel; swing to an agency cluster, click a node → panel opens; pull back | App |
| 9 | 34.5–40.7 | You can narrow it down to software buildouts, or just describe what you do in plain language, | Click the AI-buildable filter at the top (graph dims to matches); then prompt bar, typing | App (kept) |
| 10 | 41.2–43.1 | and it finds work that fits your team. | Graph turns to the matches; quick zoom onto the lit nodes | App |
| 11 | 43.5–50.5 | Here's that listing for rebuilding PASSPort. The scope, deadline, and requirements… | Click the 00225P0002 node directly in the graph → panel; scroll to Requirements | App |
| 12 | 51.0–57.5 | …start your response right here. Add your team and your experience, and you get a first draft… | Response Studio: About you → Write first draft, text streaming | App (tighter) |
| 13 | 57.9–63.3 | The site's live on Vercel, and a script pulls the newest opportunities from PASSPort every night, so it stays current. | Browser frame with nyc-rfp-app.vercel.app over the graph, then a quick cut to the green nightly scrape run | App + **R4** |
| 14 | 63.8–71.0 | Essentially, I just wanted to make it easier for New York's small business owners to find work in their own city, and actually go after it. | Back to the graph: slow pull-back through clusters to the full constellation; small "Opportunity Graph · nyc-rfp-app.vercel.app" fades in for the last 2 s | App |

The video gets to the graph at 0:21 instead of 0:26. The closing text cards are gone; it ends on the graph.

## Screen recordings needed from you

Record at 1920×1080 if you can (full-screen browser, 100% zoom, hide bookmarks bar). Move the mouse slowly and pause ~1 s before each click. Takes can run long; I'll cut them.

- **R1: PASSPort browse.** Open https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public, wait for the grid, scroll slowly down and back up, open one or two filter dropdowns, click to page 2 and 3. About 40 s.
- **R2: Our listing.** On the same page, search or filter to 00225P0002, click into it, scroll its page slowly, and open the documents/attachments area. About 30 s.
- **R3 (optional): City Record.** https://a856-cityrecord.nyc.gov/RequestDetail/20241224032, scroll slowly. About 15 s.
- **R4 (optional): Nightly scrape.** GitHub → Actions → the green "Nightly PASSPort scrape" run once it passes. About 8 s.
