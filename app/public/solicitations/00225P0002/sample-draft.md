# Proposal: City-wide e-Procurement Performance Optimization
**In response to:** Mayor's Office of Contract Services · EPIN 00225P0002
**Proposer:** {{org|organization name}}
**Response Category:** 1 (enhancement and optimization of the existing PASSPort environment) [NEEDS INPUT: confirm Category 1 or 2]

> Sample draft for the Opportunity Graph demo. It follows the structure and requirements of Attachment A (Proposal Template), and each section cites the requirement it answers, e.g. (PERF-01, Att. A p.8). Anything about your company is a [NEEDS INPUT] gap or comes from what you entered in the studio. Nothing about your firm is invented.

## Executive Summary (EX-01, Att. A p.4)
{{org|organization name}} proposes to optimize PASSPort's performance, reliability and scalability under **Category 1**, so that the City's e-procurement system stays responsive for vendors and agencies as users and transaction volume grow.
- **Our understanding:** PASSPort must give at least 2,500 concurrent users consistent access 99.9% of the time, scale automatically when resources cross critical thresholds, and expose real-time performance metrics to MOCS (PERF-01–03).
- **Approach:** {{approach|two or three sentences on your approach}}
- **Team:** {{team|team size and key roles}}
- **Estimated duration:** an 8-month first phase, as the template expects for Category 1, followed by later phases over the next 12 months (SOW-05, Att. A p.17).

## 1. Relevant Project Experience (EXP-01, EXP-02, Att. A pp.4–5)
Describe at least three similar, successful projects. For each, give start and end dates, staff count, your role, the business need, the target audience and number of users, the technical solution deployed, and final results. Include one client reference per project.
{{pastWork|three comparable projects with outcomes and a reference contact for each}}

## 2. Solution Fit
### 2.1 Technical requirements (INF-01–13, Att. A pp.5–7)
- **Architecture and load balancing (INF-01, INF-06):** reference architecture covering hosting and application tiers; horizontal scaling of application servers behind a load balancer; database capacity managed independently. [NEEDS INPUT: attach reference architecture]
- **Performance management (INF-02, INF-04):** we track availability, response times, process health, database queries and I/O, throughput, resource use, active users, error rates and garbage collection, with alerts on degradation before users feel it.
- **Security (INF-07):** {{capabilities|your security model and certifications}}
- **Disaster recovery (INF-11):** [NEEDS INPUT: RPO/RTO targets and DR topology]

### 2.2 Performance requirements (PERF-01–03, Att. A p.8)
| Metric | Acceptable range | Frequency |
|---|---|---|
| Concurrent users with stable sessions | ≥ 2,500 at 99.9% availability | Real time |
| Page and API response time (p95) | [NEEDS INPUT: target] | Real time, weekly report |
| Error rate (application, DB, OS) | [NEEDS INPUT: target] | Real time, weekly report |
| Resource headroom before auto-scaling | [NEEDS INPUT: thresholds] | Real time |

### 2.3 Functional requirements
Not required for Category 1. A Category 2 response must address all 39 functional requirements (VM, CM, STC, FIN, DR, DV, GH; Att. A pp.9–14).

## 3. Statement of Work (SOW-01–10, Att. A pp.15–19)
- **Objectives:** measurable stability and speed for PASSPort's vendors and agency users.
- **Methodology:** {{approach|delivery methodology, e.g. Agile with fortnightly demos to MOCS}}
- **Phase 1 (Category 1, ~8 months):** project setup and analysis of the current environment → Phase 1 environment design → test environment → test system → performance evaluation criteria → migration to production (months 6–8).
- **Deliverables:** project work plan, Phase 1 evaluation criteria, Phase 1 test plan, detailed hosting and multi-tier application designs, test and production implementation plans, end-to-end testing, UAT and approval.
- **Scope exclusions (SOW-08):** [NEEDS INPUT: specific exclusions; the template says generic exclusions are not acceptable]

## 4. Project Staffing and Organization (STF-01–06, Att. A pp.19–21)
Required Category 1 key roles: Project Manager\*, Technical Project Lead\*, Lead Infrastructure Architect\*, Sr. Application Solution Engineer\*, Senior Database Engineer\*, Senior Implementation Engineer\*, plus Implementation Engineer(s).
{{team|named staff for each role, with labor category and hourly rate}}
For each resource, attach a resume and a client reference. Cloud work requires at least 5 years in the target environment (STF-03).

## 5. Fees (FEE-01–07, Att. A pp.21–26)
Fixed-price and deliverables-based, with hours and rates per deliverable, entered in Attachment E. Phase 1 is priced separately from later phases (SOW-07). Warranty of at least 12 months (FEE-07).
[NEEDS INPUT: pricing. Never estimated by this tool.]

## Before you submit
- Acknowledge Addendum #3 and any later addenda.
- M/WBE Utilization Plan toward the **30%** participation goal (M/WBE goals worksheet).
- Submit in PASSPort before the due date.
