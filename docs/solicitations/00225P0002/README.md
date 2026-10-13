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
| Due dates | Originally 4/24/2025 → 10/24/2025 2 PM (Addendum #3) → 2/27/2026 2 PM per the PASSPort mirror | Addendum #3, [Databook](https://databook.nyc/procurement/solicitation/00225P0002) |
| Status | Due date passed. Award not known | — |
| Estimated value | $230,940,954 (agency estimate, not an award) | M/WBE goals worksheet |

> **Open conflict:** the City Record notice (Jan 2025) and the Databook release date (Oct 2025) disagree. The PASSPort page and its addenda should settle it.

## Scope (from the City Record notice)

- **Goal:** improve the performance, efficiency, reliability and scalability of the City's e-procurement system (PASSPort) as users and transaction volume grow.
- **Category 1:** system enhancement or optimization of the existing software environment.
- **Category 2:** software enhancement or replacement, up to and including a complete system replacement.
- **Background:** PASSPort launched in 2016, replacing APT and Vendex. In 2024, MOCS retired HHS Accelerator and folded those services into PASSPort.

## Solicitation documents (captured 2026-10-13)

The user provided these. They're stored in `data-raw/solicitations/00225P0002/files/`, with text extracts in `text/`.

| # | Document | What it gives us |
|---|---|---|
| 01 | Attachment A – Proposal Template (26 pp) | Required proposal structure, the five evaluation areas, and **81 requirements** |
| 02 | Addendum #3 (Apr 23, 2025) | Due date moved from Apr 24, 2025 to **Oct 24, 2025, 2 PM**; question deadline to **Aug 29, 2025** |
| 03 | Special Case Determination Memo (Nov 13, 2024) | Why competitive sealed proposals were used: specialist software expertise, and a balance of price and quality |
| 04 | M/WBE Participation Goals Worksheet | **30% M/WBE goal** (unspecified). Agency-estimated contract value **$230,940,954**; ~$69.3M in subcontracting across "Procurement Software" and "Procurement Development" |
| 05 | Appendix A – General Provisions (Jan 2018) + addendum (77 pp) | **60 contract obligations** with page citations → [`appendix-a-obligations.json`](../../../data-raw/solicitations/00225P0002/appendix-a-obligations.json) |

**Still missing:**
- The main RFS, which holds the **evaluation weights** and submission instructions
- Appendix F (detailed functional requirements)
- Attachment E (price worksheet), Attachment PRC and Attachment SCY
- Addenda #1, #2 and any after #3. Databook's Feb 27, 2026 due date suggests at least one more.

## Requirements (extracted, cited)

All of these are in [`requirements.json`](./requirements.json), each with its PDF page. Rebuild with `python3 data-raw/solicitations/00225P0002/build_requirements.py`.

| Section (evaluated area) | Requirements | Highlights |
|---|---|---|
| Executive Summary | 1 | Name your Response Category (1 or 2), approach, staff, duration |
| 1. Relevant Project Experience | 2 | At least 3 similar projects, with a reference for each |
| 2. Solution Fit | 55 | 13 infrastructure (architecture, monitoring, security, DR), 3 performance (**2,500 concurrent users at 99.9%**, auto-scaling, real-time metrics visible to MOCS), 39 functional (**Category 2 only**: vendor management, catalog, source-to-contract, finance, data, document vault, global config) |
| 3. Statement of Work | 10 | Category 1: 8-month first phase, then 12 months. Category 2: 8-month gap analysis and BPR, then 18 months. Phase 1 priced separately |
| 4. Staffing and Organization | 6 | 6 named key roles (Category 2 adds 6 more); resumes, references, and 5+ years in the target cloud environment |
| 5. Fees | 7 | Fixed-price, deliverables-based; Attachment E; mark-up limits; 12-month minimum warranty |

## Contract obligations that shape the proposal (Appendix A)

- **Integrity certifications at signing:** responsibility disclosures (§2.04, p.7), non-collusion (§2.03, p.7), no conflicts of interest (§2.02, p.6), Lobbying Law (§2.01, p.6), and the affirmation of no City debts (p.62).
- **E.O. 50 equal employment:** an Employment Report is due before award (§4.05(D), pp.16–17).
- **Subcontractors:** those over $20,000 need prior approval and a Payee Information Portal listing. Payments to them must be reported within 30 days, or $100/day in liquidated damages applies (§3.02, pp.9, 11).
- **Intellectual property:** the City owns the work product, including drafts (Art. 6, pp.30–31). **Name pre-existing IP and tools in the proposal** (§6.03 carve-out).
- **Insurance (Schedule A, p.63):** workers' comp, disability, employers' liability, and general liability ($1M per occurrence / $2M aggregate). No professional or cyber liability is checked, which is unusual for an IT contract; confirm in the main RFS.
- **Data breach (addendum to §5.08(B), pp.76–77):** notice within **3 days** of discovery, root-cause fix, machine-readable evidence to the City, and breach costs deductible from payments. The security sections should answer these.
- **Records:** 6-year retention and audit (pp.24–25).
- **Safe and Sick Time rider (pp.70–75):** supersedes §4.06.
- **Not in Appendix A:** Doing Business data, campaign finance, M/WBE and HireNYC. They are expected in the main RFS or other attachments.

## End-to-end demo plan

1. **Discover:** the listing appears in the graph. Prompt: "PASSPort e-procurement performance optimization".
2. **Understand:** the side panel shows scope, dates and requirement counts, drawn from `requirements.json`.
3. **Respond:** the Response Studio loads this listing's real requirement checklist and evaluation criteria. You add your team and documents, Claude drafts each required section citing the requirement it answers, and gaps are marked `[NEEDS INPUT]`.
4. **Check:** a compliance matrix (requirement → section → status) and the submission checklist.
5. **Export:** a submission-ready package (narrative, forms list, attachments index). The vendor submits it in PASSPort themselves.
