# 00225P0002: City-wide E-Procurement Performance Optimization (PASSPort 2026)

The worked example for the end-to-end demo: we take this listing from discovery to a complete, submission-ready response inside Opportunity Graph, and that becomes the story of the video.

| Field | Value | Source |
|---|---|---|
| EPIN | 00225P0002 | City Record, Databook |
| Agency | Mayor's Office of Contract Services (MOCS) | City Record |
| Method | Competitive sealed proposals | City Record |
| Industry | Professional Services - IT Related | Databook |
| City Record notice | Request 20241224032, dated 1/7/2025, with a pre-bid conference listed on 1/13/2025 | [City Record](https://a856-cityrecord.nyc.gov/RequestDetail/20241224032) |
| PASSPort page | process_manage_extranet/26900 | [PASSPort](https://passport.cityofnewyork.us/page.aspx/en/bpm/process_manage_extranet/26900) |
| Release / due (PASSPort mirror) | 10/3/2025 / 2/27/2026, 2:00 PM | [Databook](https://databook.nyc/procurement/solicitation/00225P0002) |
| Status | Due date passed. Award not known | — |
| Estimated value | Not published in any source we've read | — |

> **Open conflict:** the City Record notice (Jan 2025) and the Databook release date (Oct 2025) disagree. The PASSPort page and its addenda should settle it.

## Scope (from the City Record notice)

- **Goal:** improve the performance, efficiency, reliability and scalability of the City's e-procurement system (PASSPort) as users and transaction volume grow.
- **Category 1:** system enhancement or optimization of the existing software environment.
- **Category 2:** software enhancement or replacement, up to and including a complete system replacement.
- **Background:** PASSPort launched in 2016, replacing APT and Vendex. In 2024, MOCS retired HHS Accelerator and folded those services into PASSPort.

## Solicitation documents

**Status: not yet captured.** The PASSPort page and its attachments are blocked from the cloud build environment. To capture them, run from a normal network:

```bash
cd nyc-rfp/app
npx playwright install chromium   # one-time
HEADED=1 npm run scrape:solicitation -- https://passport.cityofnewyork.us/page.aspx/en/bpm/process_manage_extranet/26900 --id 00225P0002
git add ../data-raw/solicitations/00225P0002 && git commit -m "Capture 00225P0002 documents" && git push
```

That writes `data-raw/solicitations/00225P0002/`:
- `page.html`, `page.txt`, `page.png`
- `files/` with every linked document
- `index.json`, which records failures too (for example, documents that need a vendor login)

## Requirements: to extract from the documents

Once the files land, each requirement is extracted into [`requirements.json`](./requirements.json) with a citation (file + page), and summarised here.

- [ ] **Scope of services:** deliverables per category, current-state constraints, integrations, environments
- [ ] **Technical requirements:** performance/SLA targets, security (NYC Cyber Command), accessibility, hosting, data migration
- [ ] **Proposal format:** required sections, page limits, file types, forms
- [ ] **Evaluation criteria and weights:** e.g. experience, approach, organization, price
- [ ] **Submission requirements:** PASSPort vendor enrollment, Doing Business Data forms, M/WBE utilization plan, insurance, certifications
- [ ] **Key dates:** questions deadline, addenda, pre-proposal conference, due date
- [ ] **Addenda and Q&A:** every change since release

## End-to-end demo plan

1. **Discover:** the listing appears in the graph. Prompt: "PASSPort e-procurement performance optimization".
2. **Understand:** the side panel shows scope, dates and requirement counts, drawn from `requirements.json`.
3. **Respond:** the Response Studio loads this listing's real requirement checklist and evaluation criteria. You add your team and documents, Claude drafts each required section citing the requirement it answers, and gaps are marked `[NEEDS INPUT]`.
4. **Check:** a compliance matrix (requirement → section → status) and the submission checklist.
5. **Export:** a submission-ready package (narrative, forms list, attachments index). The vendor submits it in PASSPort themselves.
