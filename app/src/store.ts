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
  savedOnly: boolean // shortlist: only listings the user saved
}

export const emptyFilters: Filters = { industry: [], agency: [], mainCommodity: [], method: [], dueWithin: null, minFit: 0, digitalOnly: false, savedOnly: false }

/* Shortlist persistence. Storage can be missing or throw (private mode, sandboxed iframes),
   so every access is guarded and the app keeps working in memory. */
const SAVED_KEY = 'og.saved'

function readSaved(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    const arr: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeSaved(saved: Set<string>) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]))
  } catch {
    /* no storage: the shortlist lasts for this session only */
  }
}

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
  /** Shortlisted node ids. A new Set on every change, so selectors and frame loops can compare by reference. */
  saved: Set<string>
  toggleSaved: (id: string) => void
  /** Short status message for the polite live region (see Toast). `n` makes repeats re-announce. */
  toast: { msg: string; n: number } | null
  notify: (msg: string) => void
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
  saved: readSaved(),
  toggleSaved: (id) =>
    set((s) => {
      const saved = new Set(s.saved)
      if (saved.has(id)) saved.delete(id)
      else saved.add(id)
      writeSaved(saved)
      return { saved }
    }),
  toast: null,
  notify: (msg) => set((s) => ({ toast: { msg, n: (s.toast?.n ?? 0) + 1 } })),
}))

export function passesFilters(n: RfpNode, f: Filters, saved: Set<string> = useStore.getState().saved): boolean {
  if (f.savedOnly && !saved.has(n.id)) return false
  if (f.industry.length && !f.industry.includes(n.industry)) return false
  if (f.agency.length && !f.agency.includes(n.agency)) return false
  if (f.mainCommodity.length && !f.mainCommodity.includes(n.mainCommodity ?? '')) return false
  if (f.method.length && !f.method.includes(n.method)) return false
  if (f.dueWithin != null && (n.daysLeft == null || n.daysLeft < 0 || n.daysLeft > f.dueWithin)) return false
  if (n.aiFit < f.minFit) return false
  if (f.digitalOnly && n.aiFit < 60) return false
  return true
}
