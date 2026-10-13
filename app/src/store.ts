import { create } from 'zustand'
import type { GroupKey, RfpNode } from './types'

export interface Filters {
  industry: string[]
  agency: string[]
  mainCommodity: string[]
  method: string[]
  dueWithin: number | null // days
  minFit: number
  digitalOnly: boolean
}

export const emptyFilters: Filters = { industry: [], agency: [], mainCommodity: [], method: [], dueWithin: null, minFit: 0, digitalOnly: false }

interface State {
  nodes: RfpNode[]
  setNodes: (n: RfpNode[]) => void
  l1: GroupKey
  l2: GroupKey
  swapHierarchy: () => void
  setHierarchy: (l1: GroupKey, l2: GroupKey) => void
  filters: Filters
  setFilters: (f: Partial<Filters>) => void
  query: string
  setQuery: (q: string) => void
  relevance: Map<string, number>
  setRelevance: (m: Map<string, number>) => void
  /** Per-node one-line reasons and a one-line summary from /api/match; empty when local scoring is in use. */
  matchReasons: Map<string, string>
  matchSummary: string | null
  setMatchInfo: (reasons: Map<string, string>, summary: string | null) => void
  selected: { kind: 'node' | 'cluster'; id: string } | null
  select: (s: State['selected']) => void
  hovered: string | null
  hover: (id: string | null) => void
  heat: boolean
  toggleHeat: () => void
  studioFor: string | null
  openStudio: (id: string | null) => void
  focusNonce: number // bump to make the camera re-frame the current highlight
  refocus: () => void
}

export const useStore = create<State>((set) => ({
  nodes: [],
  setNodes: (nodes) => set({ nodes }),
  l1: 'industry',
  l2: 'agency',
  swapHierarchy: () => set((s) => ({ l1: s.l2, l2: s.l1, selected: null })),
  setHierarchy: (l1, l2) => set({ l1, l2, selected: null }),
  filters: emptyFilters,
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  query: '',
  setQuery: (query) => set({ query }),
  relevance: new Map(),
  setRelevance: (relevance) => set((s) => ({ relevance, focusNonce: s.focusNonce + 1 })),
  matchReasons: new Map(),
  matchSummary: null,
  setMatchInfo: (matchReasons, matchSummary) => set({ matchReasons, matchSummary }),
  selected: null,
  select: (selected) => set({ selected }),
  hovered: null,
  hover: (hovered) => set({ hovered }),
  heat: false,
  toggleHeat: () => set((s) => ({ heat: !s.heat })),
  studioFor: null,
  openStudio: (studioFor) => set({ studioFor }),
  focusNonce: 0,
  refocus: () => set((s) => ({ focusNonce: s.focusNonce + 1 })),
}))

export function passesFilters(n: RfpNode, f: Filters): boolean {
  if (f.industry.length && !f.industry.includes(n.industry)) return false
  if (f.agency.length && !f.agency.includes(n.agency)) return false
  if (f.mainCommodity.length && !f.mainCommodity.includes(n.mainCommodity ?? '')) return false
  if (f.method.length && !f.method.includes(n.method)) return false
  if (f.dueWithin != null && (n.daysLeft == null || n.daysLeft < 0 || n.daysLeft > f.dueWithin)) return false
  if (n.aiFit < f.minFit) return false
  if (f.digitalOnly && n.aiFit < 60) return false
  return true
}
