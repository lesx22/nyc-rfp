/** One row from the PASSPort public "Browse Procurements" grid, plus enrichment. */
export interface Rfp {
  id: string
  title: string
  agency: string
  epin: string | null
  industry: string
  program: string | null
  status: string | null
  releaseDate: string | null // ISO yyyy-mm-dd
  dueDate: string | null // ISO yyyy-mm-dd
  mainCommodity: string | null
  estValueUSD: number | null
  description: string | null
  sourceUrl: string | null
  confidence?: 'high' | 'medium' | 'low'
  isDigitalBuild?: boolean
  /** Provenance flags — the UI shows these so nothing inferred is presented as fact. */
  industryInferred?: boolean
  agencyNote?: string | null
  statusNote?: string | null
  onPassport?: boolean
}

/** Rfp + derived fields computed once at load. */
export interface RfpNode extends Rfp {
  aiFit: number // 0–100: how much of the delivery an AI-assisted team could automate end to end
  aiFitReasons: string[]
  daysLeft: number | null
  method: string // from EPIN method letter, else 'Unknown'
  fiscalYear: number | null
}

export type GroupKey = 'industry' | 'agency' | 'mainCommodity' | 'program' | 'method'

export interface Cluster {
  id: string // `${level}:${path}`
  level: 1 | 2
  label: string
  parent: string | null
  members: string[] // rfp ids
}
