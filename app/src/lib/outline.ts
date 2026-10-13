import type { RfpNode } from '../types.ts'
import { date } from './format.ts'

/** What the Response Studio collects in "About you". Also the `intake` sent to /api/draft. */
export interface Intake {
  org: string
  team: string
  capabilities: string
  pastWork: string
  mwbe: boolean
  approach: string
}

/**
 * Section headings of the template outline. api/draft.ts has the same list (DRAFT_SECTIONS);
 * tests/ai.test.ts keeps them in sync so a Claude draft and this fallback line up.
 */
export const OUTLINE_SECTIONS = [
  '1. Executive summary',
  '2. Understanding of the need',
  '3. Proposed approach & work plan',
  '4. Organizational capability',
  '5. Relevant experience & references',
  '6. M/WBE participation',
  '7. Price proposal',
  'Attachments',
] as const

/** Local, template-only draft. Always available; the fallback when Claude is not. */
export function outline(n: Pick<RfpNode, 'title' | 'agency' | 'epin' | 'dueDate' | 'description'>, f: Intake, fileNames: string[]): string {
  const or = (s: string, ph: string) => s.trim() || `[${ph}]`
  const [s1, s2, s3, s4, s5, s6, s7, att] = OUTLINE_SECTIONS
  return `# Proposal: ${n.title}
Submitted to: ${n.agency}${n.epin ? `\nEPIN: ${n.epin}` : ''}
Proposer: ${or(f.org, 'Organization name')}
Due: ${date(n.dueDate)}

## ${s1}
${or(f.org, 'We')} proposes to ${or(f.approach, 'describe the core approach in two to three sentences')}.

## ${s2}
${n.description ?? '[Restate the agency need in your own words, citing the RFP scope section.]'}

## ${s3}
- Discovery & requirements (weeks 1–3)
- Design & prototyping with agency users (weeks 3–8)
- Build, test, accessibility (WCAG 2.2 AA) & security review
- Launch, training, and handoff
[Map each activity to the RFP's scope-of-services items.]

## ${s4}
Team: ${or(f.team, 'roles, size, key personnel')}
Capabilities: ${or(f.capabilities, 'relevant capabilities')}

## ${s5}
${or(f.pastWork, 'three comparable engagements with outcomes and a reference contact for each')}

## ${s6}
${f.mwbe ? 'Proposer is a certified M/WBE.' : '[Utilization plan or waiver request]'}

## ${s7}
[Use the agency's pricing form. Do not include pricing in the narrative unless instructed.]

## ${att}
${fileNames.length ? fileNames.map((x) => `- ${x}`).join('\n') : '- [Capability statement, résumés, insurance, forms]'}
`
}
