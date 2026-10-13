import { useEffect, useState } from 'react'

/** Listing-specific requirements extracted from solicitation documents (docs/solicitations/<EPIN>). */
export interface Source {
  file?: string
  page?: number
  sheet?: string
  url?: string
}
export interface Requirement {
  id: string
  text: string
  type: 'must' | 'should' | 'form' | 'info'
  appliesTo: 'all' | 'category1' | 'category2'
  category?: string
  source: Source
}
export interface ReqSection {
  id: string
  title: string
  evaluated?: boolean
  note?: string
  requirements?: Requirement[]
  subsections?: { id: string; title: string; note?: string; requirements: Requirement[] }[]
}
export interface Solicitation {
  epin: string
  title: string
  sources: { file: string; title: string; pages?: number }[]
  missingDocuments: string[]
  responseCategories: { id: string; title: string; summary: string }[]
  keyDates: { label: string; date: string; source: Source }[]
  evaluationCriteria: { areas: string[]; weights: null | Record<string, number>; weightsNote?: string; source: Source }
  mwbe?: { participationGoal: number; estimatedContractValueUSD?: number; note: string }
  sections: ReqSection[]
  submissionChecklist: { item: string; source: Source }[]
  counts: Record<string, number>
}

export const sectionRequirements = (s: ReqSection) => [...(s.requirements ?? []), ...(s.subsections ?? []).flatMap((x) => x.requirements)]

const base = `${import.meta.env.BASE_URL}solicitations/`
let indexPromise: Promise<Map<string, { sample: boolean }>> | null = null
function loadIndex() {
  indexPromise ??= fetch(`${base}index.json`)
    .then((r) => (r.ok ? r.json() : { solicitations: [] }))
    .then((d: { solicitations: { epin: string; sample: boolean }[] }) => new Map(d.solicitations.map((s) => [s.epin, { sample: s.sample }])))
    .catch(() => new Map())
  return indexPromise
}
const cache = new Map<string, Promise<Solicitation | null>>()

/** Requirements for a listing, or null when none have been extracted. Only fetches files the index lists. */
export function useSolicitation(epin: string | null | undefined) {
  const [state, setState] = useState<{ epin: string | null; data: Solicitation | null; hasSample: boolean }>({ epin: null, data: null, hasSample: false })
  useEffect(() => {
    if (!epin) return
    let live = true
    loadIndex().then((idx) => {
      const entry = idx.get(epin)
      if (!entry) return live && setState({ epin, data: null, hasSample: false })
      if (!cache.has(epin)) cache.set(epin, fetch(`${base}${epin}/requirements.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
      cache.get(epin)!.then((data) => live && setState({ epin, data, hasSample: entry.sample }))
    })
    return () => {
      live = false
    }
  }, [epin])
  return state.epin === epin ? state : { epin: epin ?? null, data: null, hasSample: false }
}

/** The pre-written sample draft for a listing, with intake answers filled into {{placeholders}}. */
export async function loadSampleDraft(epin: string, fill: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch(`${base}${epin}/sample-draft.md`)
    if (!r.ok) return null
    const text = await r.text()
    return text.replace(/\{\{(\w+)\|([^}]*)\}\}/g, (_, key: string, fallback: string) => fill[key]?.trim() || `[NEEDS INPUT: ${fallback}]`)
  } catch {
    return null
  }
}
