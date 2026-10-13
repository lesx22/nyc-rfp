"""Build docs/solicitations/00225P0002/requirements.json from the captured documents.
Every item carries the PDF page where its anchor text is found (verified, not guessed)."""
import json, subprocess, re, sys
import os
BASE = os.path.dirname(os.path.abspath(__file__)) + '/'
T = 'files/01-Attachment_A_Proposal_Template.pdf'

def pages(pdf):
    out = subprocess.run(['pdftotext', '-layout', BASE + pdf, '-'], capture_output=True, text=True).stdout
    return [re.sub(r'\s+', ' ', p) for p in out.split('\f')]
TP = pages(T)
def page_of(anchor, pg=TP):
    a = re.sub(r'\s+', ' ', anchor)
    # Skip the cover and table of contents (PDF pp.1-3) so anchors resolve to the body text.
    hits = [i + 1 for i, p in enumerate(pg) if a in p and (pg is not TP or i >= 3)] or [i + 1 for i, p in enumerate(pg) if a in p]
    if not hits:
        sys.exit(f'ANCHOR NOT FOUND: {anchor!r}')
    return hits[0]
def src(anchor, file=T, pg=TP):
    return {'file': file, 'page': page_of(anchor, pg)}

def R(id, text, type, anchor, category=None, applies='all'):
    d = {'id': id, 'text': text, 'type': type, 'appliesTo': applies, 'source': src(anchor)}
    if category: d['category'] = category
    return d

infra = [
 ('INF-01','Describe how the architecture supports load balancing and workload distribution; attach a reference architecture covering hosting environment and application architecture.','Architecture','load balancing and'),
 ('INF-02','Describe how the solution tracks: availability, response times, web/application/OS processes, database queries and I/O, throughput, CPU/memory/network/database utilization, active users, error rates, garbage collection.','Performance Management','Describe how your solution tracks the following metrics'),
 ('INF-03','Describe how new monitoring parameters are added.','Performance Management','Describe how you add new monitoring parameters'),
 ('INF-04','Describe how performance degradation is detected and reported.','Performance Management','detect and report performance degradation'),
 ('INF-05','Detail the logging and error-tracking process, including the list of items logged and tracked.','Performance Management','Detail your logging and error tracking process'),
 ('INF-06','Describe high availability and scalability through dynamic allocation of processing power, memory, database capacity, network bandwidth and application server capacity.','Architecture','provides high availability and'),
 ('INF-07','Describe the security model for the hosting infrastructure and the application.','Security','Describe your security model'),
 ('INF-08','Describe safeguards that prevent users from inadvertently impairing system performance.','Performance Management','What safeguards does your solution provide'),
 ('INF-09','Detail the approach to comprehensive database monitoring.','Performance Management','comprehensive database'),
 ('INF-10','Describe the process for guaranteeing database consistency.','Performance Management','guaranteeing database consistency'),
 ('INF-11','Describe the disaster recovery options included.','Architecture','disaster recovery options'),
 ('INF-12','List the environments included in the solution.','Architecture','List the environments that are included'),
 ('INF-13','Describe the process for problem identification, root cause determination and resolution.','Architecture','problem identification, root cause'),
]
perf = [
 ('PERF-01','99.9% of the time, at least 2,500 concurrent users must have consistent access to logins and user functions without timeouts or instability; describe how the solution provides this.','99.9% of the time, a minimum of 2,500 concurrent users'),
 ('PERF-02','Demonstrate scalability: when CPU, memory, database performance or other essential resources cross critical thresholds, provision resources to prevent or recover from degradation; describe the approach.','The solution must demonstrate scalability'),
 ('PERF-03','Provide real-time monitoring of key performance metrics (agreed with MOCS), visible to MOCS staff; for each application metric give name, description, impact, acceptable range and reporting frequency.','real-time monitoring of key performance metrics'),
]
func = [
 ('VM01','Self-service capture of vendor indicative, background and performance information; vendor/principal disclosure, caution and performance evaluation.','Vendor Management','Self-service capture of all indicative'),
 ('VM02','Manage Pre-Qualified Lists tied to a managing agency; citywide or agency-only flags.','PQL Management','Manage Pre-Qualified Lists'),
 ('VM03','Manage vendor responsibility determinations, including required City and external reporting.','RD Management','Manage vendor responsibility determinations'),
 ('VM04','Vendor document vault: upload specified document types and pull them into proposals, contracts, invoices, disclosures and PQL applications.','Document Vault','Provide vendor ability to store and manage'),
 ('VM05','Vendor budget management: certification of funds, invoice and payment tracking, advances and recoupments.','Budget Management','Provide vendor budget management'),
 ('VM06','Subcontractor management: submission and approval, subcontract modifications, payments to subcontractors.','Subcontractor Management','Provide subcontractor management functionality'),
 ('VM07','Let vendors and agencies monitor progress toward M/WBE goals per contract.','M/WBE Utilization','monitor progress'),
 ('CM01','Import goods catalogs from master agreement contracts; catalog items viewable citywide for requisitions.','Catalog Management','Establish import process for goods catalogs'),
 ('CM02','Internal business and financial approvals of goods requisitions before encumbrance; vendor order module with estimated delivery dates.','Requisition and Ordering','Allow for internal business and financial approvals'),
 ('CM03','Receipts confirming delivery; vendor invoices matched against order and receipt, with agency review before FMS disbursement.','Receiving and Invoicing','Create receipts to mark the confirmed delivery'),
 ('STC01','Contract requisition, solicitation, creation and management.','Source to Contract','Contract requisition, solicitation, creation'),
 ('STC02','Organize requisitions and sourcing projects into programs by citywide initiative.','Organization','Organize Requisitions, Sourcing Projects'),
 ('STC03','Request direct orders or task orders, or start a new sourcing event or contract action.','Requisition','through task orders'),
 ('STC04','Pre-solicitation review: market assessment, cost estimate, selection of procurement method.','Pre-Solicitation','Support pre-solicitation review'),
 ('STC05','Draft and publish solicitations to selected vendors in accordance with PPB rules.','Solicitation','Draft procurement solicitations'),
 ('STC06','Evaluate responses per PPB rules, including multiple rounds/addenda, open-ended solicitations and real-time bidding.','Evaluation','Evaluate vendor responses to solicitations'),
 ('STC07','Link responsibility determination to selected vendor; create and route recommendation for award.','Award','Link a responsibility determination'),
 ('STC08','Draft contracts with collaborative City–vendor editing; execution, oversight review, public hearings, certification of funds, Comptroller registration package.','Contract','Draft vendor contracts and engage'),
 ('STC09','Contract amendment and change order management.','Amendments','contract amendment and'),
 ('STC10','Register and manage Master Agreements (MA1, MMA1, MAR) including modifications and task-order rotation models.','Master Agreement Registration','register and manage Master Agreements'),
 ('FIN01','Agency management of certification of funds, encumbrances and accounting lines across requisition, contract, amendment, order and invoice.','Financials Management','Enable agencies to manage their certification of funds'),
 ('FIN02','Budget and encumbrance validation, submission, and oversight approval workflows.','FY Budgeting & Encumbrance','Budget and encumbrance management includes'),
 ('FIN03','Invoicing and receiving for direct orders, contracts and task orders, integrated with the City financial management system.','Invoicing & Receiving','Provide invoicing and receiving modules'),
 ('FIN04','Vendor submission of contract budgets for contracts and purchase orders.','Vendor Contract Budget','Enable submission of contract budgets from vendors'),
 ('FIN05','Manage retainage terms on contract budgets and related invoices.','Capital Management','retainage terms'),
 ('FIN06','Flexible pricing and blanket orders for specialized purchases (e.g. fuel, bulk supply).','Fuel Pricing/Blanket Order','Dynamic and well-managed flexible pricing'),
 ('FIN07','Real- or near-real-time order, invoice and disbursement integrations with the City financial system.','Financial system integrations','near-real'),
 ('FIN08','Support capital, expense and mixed funding structures across modules.','Mixed Funding Contract Submissions','Support different funding structures'),
 ('FIN09','Payment advances and recoupment.','Advances and Recoupment','Allow for payment advances and recoupment'),
 ('DR01','Integrations with City authentication, financial and budget systems (OTI, FISA, OMB) using standard protocols (API, FTP, LDAP) with security and management tooling.','Integration','Enable integrations required to support'),
 ('DR02','Programmatic and user read access to all application data via SQL-like queries, exportable to Excel, CSV, XML.','Reporting','Provide programmatic and user-accessible'),
 ('DV01','Document vault for vendor, agency and admin users; sharing rules (shared docs can\'t be archived/deleted; read-only viewing).','Document Management','This module allows Vendor, Agency, and Admin users'),
 ('DV02','Agencies set document submission requirements per step; link documents from device or vault; some converted to PDF.','Document Linking','select document'),
 ('GH01','Configure and design PASSPort global pages.','Homepage Configuration','configuration and design'),
 ('GH02','Map user profiles and authorizations to homepage features.','Profiles and Authorizations','mapping new and baseline user'),
 ('GH03','MOCS Admin management of agency approval rules, routing and delegation by dollar thresholds.','Approval Rules','MOCS Admin'),
 ('GH04','Configure and generate E-PINs; search objects by partial or full E-PIN.','E-PIN Generation','generate electronic procurement identification'),
 ('GH05','Generate PDFs from templates pulling Contract Object fields, with naming convention, into the agency vault.','System Generated Documents','The system will generate PDFs'),
 ('GH06','Configure which objects use the document vault vs. attachments, and allowed document types.','Document Vault configuration','certain system objects to use the document vault'),
]

sections = [
 {'id':'exec','title':'Executive Summary','evaluated':False,'requirements':[
   R('EX-01','Identify the Response Category (1 or 2), your understanding of scope and objectives, and summarize approach, proposed staff and estimated duration.','must','identify the Response Category')]},
 {'id':'experience','title':'1. Relevant Project Experience','evaluated':True,'requirements':[
   R('EXP-01','Describe at least three similar, successful projects with start/end dates, staff count, your role, business need, target audience and approximate users, technical solution, and final results.','must','Describe at least three similar projects'),
   R('EXP-02','Provide a client reference for each project (organization, name and title, project role, phone, email); references must agree to be contacted.','must','please provide a client reference including')]},
 {'id':'solution','title':'2. Solution Fit','evaluated':True,'subsections':[
   {'id':'technical','title':'2.1 Technical (Infrastructure) Requirements','note':'All proposers must complete.','requirements':[R(i,t,'must',a,c) for i,t,c,a in infra]},
   {'id':'performance','title':'2.2 Performance Requirements','requirements':[R(i,t,'must',a) for i,t,a in perf]},
   {'id':'functional','title':'2.3 Functional Requirements','note':'Category 2 proposers only; fuller descriptions are in Appendix F of the RFS (not yet captured).','requirements':[R(i,t,'must',a,c,'category2') for i,t,c,a in func]}]},
 {'id':'sow','title':'3. Statement of Work','evaluated':True,'requirements':[
   R('SOW-01','State your understanding of the project objectives and goals.','must','State your understanding of the project'),
   R('SOW-02','Describe the approach and methodology (e.g. prototyping, RAD, Agile, COTS).','must','Describe the approach and methodology'),
   R('SOW-03','Project scope: contractor needs, proposed acceptance criteria and process, interaction with City staff and other contractors, and tasks by phase with resources, durations and milestones.','must','Contractor’s needs'),
   R('SOW-04','List deliverables (e.g. work plan, design document with security approach, test plan/scripts/results, production application, technical docs, deployment and back-out plans, transition plan, weekly status reports).','must','Describe the deliverables for this project'),
   R('SOW-05','Category 1: initial phase expected within 8 months (setup → design → test env → test system → evaluation criteria → production by months 6–8); later phases within the following 12 months.','info','Category 1 Solutions','category1'),
   R('SOW-06','Category 2: sandbox, gap analysis and business process re-engineering within 8 months; full implementation, integration and migration within the following 18 months.','info','Category 2 Solutions','category2'),
   R('SOW-07','Phase 1 must be priced separately from all future phases (Categories 1 and 2).','must','Category 2 Phase 1 cost should be priced separately'),
   R('SOW-08','Explicitly list scope exclusions; generic exclusions are not acceptable.','must','Generic exclusions are not acceptable'),
   R('SOW-09','Describe reports: title, form and content, frequency.','must','Describe the Reports that will be submitted'),
   R('SOW-10','List assumptions (assumptions conflicting with the Agreement are void).','should','Contractor should insert any Assumptions here')]},
 {'id':'staffing','title':'4. Project Staffing and Organization','evaluated':True,'requirements':[
   R('STF-01','Category 1 key roles: Project Manager*, Technical Project Lead*, Lead Infrastructure Architect*, Sr. Application Solution Engineer*, Senior Database Engineer*, Senior Implementation Engineer*, plus Implementation Engineer(s), with labor category and hourly rate; mark subcontractors.','must','Category 1 responders are expected to staff'),
   R('STF-02','Category 2 adds: Business Analyst Lead*, QA Lead*, Business Analysts, QA Analysts, BPR Lead, Change Management Lead.','must','Category 2 responders are expected to staff','category2'),
   R('STF-03','Resume and at least one client reference per resource; for cloud or new-software work, resumes must show at least five years in the targeted environment.','must','minimum of five years’ experience'),
   R('STF-04','Specify prevailing-wage mark-up, non-U.S. labor discounted rates, and specialized subcontractor cost-plus rates where applicable.','should','Prevailing Wage labor'),
   R('STF-05','Organization chart and narrative showing interaction with City staff and other entities.','must','Please provide an organization chart'),
   R('STF-06','Describe the governance structure.','must','Describe the governance structure of the project')]},
 {'id':'fees','title':'5. Fees','evaluated':True,'requirements':[
   R('FEE-01','Fixed-price, deliverables-based structure showing hours and hourly rates per deliverable (alternatives such as T&M may be added).','must','fixed-price, deliverables-'),
   R('FEE-02','Complete Attachment E – Price Proposal Worksheet (Staffing Plan, Total Charges, Phase 1 tabs) across all phases for up to six years.','form','Attachment E – Price Proposal Worksheet'),
   R('FEE-03','Software/subscription and hardware costs with licensing structure and mark-ups (not above Attachment PRC; 0% on maintenance); prices at or below the lesser of contractor discount, NYS OGS or GSA.','must','Identify any packaged and/or operating system software costs'),
   R('FEE-04','Post-implementation support and maintenance annual fees, no overlap with acceptance and warranty; 0% mark-up.','must','Post-Implementation Support and Maintenance'),
   R('FEE-05','Optional performance outcome measures and financial incentives/disincentives.','should','Contractors are invited to list and describe outcome measures'),
   R('FEE-06','Payment schedule (monthly or by deliverable).','must','The Contractor shall submit invoices to the Agency Project Manager'),
   R('FEE-07','Warranty period for products and system deliverables of at least 12 months.','must','Warranty Period for Products and System Deliverables')]},
]

doc = {
 'epin': '00225P0002',
 'title': 'City-wide E-Procurement Performance Optimization (PASSPort 2026)',
 'agency': "Mayor's Office of Contract Services",
 'status': 'extracted',
 'extractedAt': '2026-10-13',
 'note': 'Extracted from the documents provided by the user. Pages are PDF page numbers. The main RFS document, Appendix F and Attachment E were not among the files and are listed under missingDocuments.',
 'sources': [
   {'file':'files/01-Attachment_A_Proposal_Template.pdf','title':'Attachment A – Proposal Template','pages':26},
   {'file':'files/02-Addendum_3_Submission_and_QA_Deadline_Extension.pdf','title':'Addendum #3 – Submission Due Date & Question Deadline Extension','pages':1},
   {'file':'files/03-Special_Case_Determination_Memo.pdf','title':'Special Case Determination Memo (11/13/2024)','pages':1},
   {'file':'files/04-MOCS_MWBE_Goals_Worksheet.xlsx','title':'NYC M/WBE Participation Goals Worksheet'},
   {'file':'files/05-Appendix_A_2018_with_Addendum.pdf','title':'Appendix A – General Provisions (2018) with Addendum','pages':77},
 ],
 'missingDocuments': ['Main RFS (evaluation weights, submission instructions)','Appendix F – detailed functional requirements','Attachment E – Price Proposal Worksheet','Attachment PRC (mark-up limits)','Attachment SCY (security)','Addenda #1, #2 and any after #3'],
 'responseCategories': [
   {'id':'category1','title':'Category 1','summary':'Enhancement or optimization of the existing PASSPort software environment.'},
   {'id':'category2','title':'Category 2','summary':'Software enhancement or replacement, up to a complete system replacement; also completes the functional requirements.'}],
 'keyDates': [
   {'label':'Special case determination (CSP method)','date':'2024-11-13','source':{'file':'files/03-Special_Case_Determination_Memo.pdf','page':1}},
   {'label':'Original proposal due date','date':'2025-04-24T14:00','source':{'file':'files/02-Addendum_3_Submission_and_QA_Deadline_Extension.pdf','page':1}},
   {'label':'Addendum #3 issued','date':'2025-04-23','source':{'file':'files/02-Addendum_3_Submission_and_QA_Deadline_Extension.pdf','page':1}},
   {'label':'Question deadline (extended)','date':'2025-08-29','source':{'file':'files/02-Addendum_3_Submission_and_QA_Deadline_Extension.pdf','page':1}},
   {'label':'Proposal due date (extended by Addendum #3)','date':'2025-10-24T14:00','source':{'file':'files/02-Addendum_3_Submission_and_QA_Deadline_Extension.pdf','page':1}},
   {'label':'Proposal due date per PASSPort mirror (later addendum not captured)','date':'2026-02-27T14:00','source':{'url':'https://databook.nyc/procurement/solicitation/00225P0002'}}],
 'evaluationCriteria': {
   'areas': ['Relevant Project Experience','Solution Fit','Statement of Work (Approach and Methodology)','Organization and Staffing (Organizational Capability)','Fees (Cost Proposal)'],
   'weights': None,
   'weightsNote': 'Weights are in the main RFS, which was not provided.',
   'source': src('The proposals will be evaluated in five key areas')},
 'procurementMethod': {'method':'Competitive sealed proposals','reason':'Requires specific expertise in software development and optimization; a balance of price, quality and other factors (PPB Rule § 3-01(d)(2)).','source':{'file':'files/03-Special_Case_Determination_Memo.pdf','page':1}},
 'mwbe': {
   'participationGoal': 0.30, 'goalBreakdown': 'Unspecified (no group-specific goals)',
   'estimatedContractValueUSD': 230940954, 'estimatedMwbeValueUSD': 69282286.2,
   'subcontractingAreas': [{'area':'Procurement Software','estValueUSD':34641143.1},{'area':'Procurement Development','estValueUSD':34641143.1}],
   'note': 'Agency estimate from the M/WBE goals worksheet, not an award amount. Directory search exports in the workbook contain third-party contact details and are not reproduced here.',
   'source': {'file':'files/04-MOCS_MWBE_Goals_Worksheet.xlsx','sheet':'Worksheet'}},
 'sections': sections,
 'submissionChecklist': [
   {'item':'Proposal following Attachment A section order (Executive Summary, sections 1–5, Warranty)','source':src('This template is to be used for Systems Integrator Proposals')},
   {'item':'Reference architecture attachment (INF-01)','source':src('load balancing and')},
   {'item':'Resumes and client references for every proposed resource','source':src('provide a resume and')},
   {'item':'Attachment E – Price Proposal Worksheet, Phase 1 priced separately','source':src('Attachment E – Price Proposal Worksheet')},
   {'item':'M/WBE Utilization Plan meeting the 30% participation goal (or waiver request)','source':{'file':'files/04-MOCS_MWBE_Goals_Worksheet.xlsx','sheet':'Worksheet'}},
   {'item':'Acknowledge Addendum #3 (and any later addenda)','source':{'file':'files/02-Addendum_3_Submission_and_QA_Deadline_Extension.pdf','page':1}},
   {'item':'Submit in PASSPort before the due date','source':{'url':'https://passport.cityofnewyork.us/page.aspx/en/bpm/process_manage_extranet/26900'}}],
}
def count(s):
    n = len(s.get('requirements', []))
    for sub in s.get('subsections', []): n += len(sub['requirements'])
    return n
doc['counts'] = {s['id']: count(s) for s in sections}
doc['counts']['total'] = sum(doc['counts'].values())
json.dump(doc, open(os.path.join(BASE, '../../../docs/solicitations/00225P0002/requirements.json'), 'w'), indent=2, ensure_ascii=False)
print(doc['counts'])
