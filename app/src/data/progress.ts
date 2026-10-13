/** Mirrors docs/ROADMAP.md — update both when a task lands. */
export interface Phase {
  id: string
  name: string
  goal: string
  tasks: [string, boolean][]
}

export const BUILD = 'v0.4'

export const PHASES: Phase[] = [
  {
    id: 'P0',
    name: 'Foundations',
    goal: 'Data shape, stack, research',
    tasks: [
      ['Proposal & roadmap', true],
      ['Library / repo research', true],
      ['Schema mirroring PASSPort columns', true],
      ['Playwright scraper', true],
      ['54-row seed from public sources', true],
      ['Rankings (AI fit, value)', true],
      ['Full live scrape of PASSPort', false],
      ['Terms-of-use check with MOCS', false],
    ],
  },
  {
    id: 'P1',
    name: 'Graph scaffold',
    goal: 'Prove the hero interaction',
    tasks: [
      ['Canvas, orbit/zoom camera, idle drift', true],
      ['Hierarchical layout (Industry → Agency)', true],
      ['Instanced nodes + merged edges', true],
      ['Bloom, neural pulses, eased remaps', true],
      ['Cluster & node fly-to + side panels', true],
      ['Prompt bar matching + “Picked for you”', true],
      ['Filters, hierarchy remap, deadline heat', true],
      ['Response Studio v0', true],
      ['Keyboard + button camera controls', true],
      ['Legend', true],
      ['Mobile bottom sheet', true],
      ['Adaptive DPR, perf monitor, pause when hidden', true],
      ['Playwright smoke test', true],
      ['Scale pass (1,500-row stress test)', true],
      ['EPIN → procurement type filter', true],
      ['Visual direction C: Instrument Panel', true],
      ['Design & motion skills installed', true],
      ['Usability test with 5 target users', false],
    ],
  },
  {
    id: 'P2',
    name: 'Data pipeline & deploy',
    goal: 'Fresh, shareable data',
    tasks: [
      ['Nightly scrape GitHub Action', true],
      ['Claude Routines (review, self-heal)', false],
      ['Detail-page scraper (docs, contacts)', false],
      ['Contract value enrichment', false],
      ['Next.js on Vercel, /o/[epin] pages', false],
      ['Analytics events', false],
    ],
  },
  {
    id: 'P3',
    name: 'AI layer',
    goal: 'Claude matching & drafting',
    tasks: [
      ['/api/match with Claude', false],
      ['LLM AI-fit classifier', false],
      ['Response Studio agent (chat + docs)', false],
      ['Accounts & saved drafts', false],
    ],
  },
  {
    id: 'P4',
    name: 'Live heat',
    goal: 'Realtime traffic overlay',
    tasks: [
      ['Per-node view counters (Durable Objects)', false],
      ['Traffic heat + “quiet bids” filter', false],
      ['Presence', false],
    ],
  },
]
