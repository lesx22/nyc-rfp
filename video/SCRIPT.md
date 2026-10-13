# Opportunity Graph: video script (final, version B)

**Length:** ~85–90s, cut to the recorded voice-over · **Format:** 1920×1080, 30fps · **Voice:** the user's own recording

Cues are approximate. Final cuts follow the recorded audio.

| Cue | Picture | Voice-over |
|---|---|---|
| 0:00 | Grid of real listings scrolling | Hey, I've had this idea for a long time and never got around to it. New York City posts all of its contract opportunities on PASSPort. If you're a small business building software, finding the right one and responding to it means a lot of manual work. |
| ~0:16 | The 00225P0002 listing card (PASSPort 2026) | Then I was pleasantly surprised to find this listing. The city was actually asking for help rebuilding PASSPort itself. So on a Tuesday night, in between cooking dinner and cleaning up, I started prototyping. |
| ~0:29 | App: the graph slowly rotating; AI-buildable filter on/off; prompt typed, graph turns | This is the opportunity graph: every open opportunity, grouped by industry and then by agency, so you can see where the work is and who's asking for it. You can narrow it down to software buildouts, or just describe what you do in plain language, and it finds work that fits your team. |
| ~0:50 | App: listing panel with scope, deadline, requirements; then the Response Studio drafts | Here's that listing for rebuilding PASSPort. The scope, deadline, and requirements are all pulled from the solicitation documents. When you're ready, you can start your response right here. Add your team and your experience, and you get a first draft shaped around exactly what the city asked for, that you can make your own. |
| ~1:12 | Graph pulls back; closing card | The site's live on Vercel, and a script pulls the newest opportunities from PASSPort every night, so it stays current. Essentially, I just wanted to make it easier for New York's small business owners to find work in their own city, and actually go after it. |

## What must be true on screen

- **Requirements:** the listing panel shows requirements pulled from the documents (`docs/solicitations/00225P0002/requirements.json`).
- **First draft:** the Response Studio produces a draft for 00225P0002 built from its real requirements. On the public demo this is a pre-written sample, clearly labelled, with the user's details as `[NEEDS INPUT]` gaps.
- **Nightly script:** "pulls … every night" is only true once the nightly scrape run passes. Otherwise, change the line to "is set up to pull".
