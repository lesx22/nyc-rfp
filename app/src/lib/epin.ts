/**
 * EPIN anatomy: 3-digit agency code · 2-digit fiscal year · method letter · 4-digit sequence.
 * e.g. 05626P0001 → NYPD (056), FY26, P = competitive sealed proposals.
 * Method letters per MOCS PASSPort conventions; unknown letters fall back to "Other".
 */
const METHOD: Record<string, string> = {
  P: 'Proposals (RFP)',
  B: 'Sealed bid',
  Y: 'RFI / notice',
  I: 'Design-build',
  D: 'Demonstration',
  N: 'Negotiated acquisition',
}

export interface EpinParts {
  agencyCode: string
  fiscalYear: number
  method: string
}

export function parseEpin(epin: string | null): EpinParts | null {
  const m = epin?.trim().match(/^(\d{3})(\d{2})([A-Z])(\d{4})$/)
  if (!m) return null
  return { agencyCode: m[1], fiscalYear: 2000 + Number(m[2]), method: METHOD[m[3]] ?? 'Other' }
}
