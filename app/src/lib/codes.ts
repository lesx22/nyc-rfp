/** Short HUD codes for industries and agencies (like a sector designator on an instrument). */
const INDUSTRY: Record<string, string> = {
  Construction: 'CON',
  Goods: 'GDS',
  'Goods - Construction Related': 'GCR',
  'Goods - IT Related': 'GIT',
  'Human/Client Service': 'HCS',
  Other: 'OTH',
  'Professional Services': 'PRO',
  'Professional Services - Architecture/Engineering': 'PAE',
  'Professional Services - Investigative/Confidential': 'PIC',
  'Professional Services - IT Related': 'PIT',
  'Professional Services- Construction Related': 'PCR',
  'Standard Services': 'STD',
  'Standard Services - Construction Related': 'SCR',
  'Standard Services - IT Related': 'SIT',
}

/** Common NYC agency acronyms; anything else falls back to initials. */
const AGENCY: Record<string, string> = {
  'New York City Police Department': 'NYPD',
  'Department of Transportation': 'DOT',
  'Department of Environmental Protection': 'DEP',
  'Department of Citywide Administrative Services': 'DCAS',
  'Department of Social Services': 'DSS',
  'Department of Health and Mental Hygiene': 'DOHMH',
  'Department of Housing Preservation and Development': 'HPD',
  'Department of Parks and Recreation': 'DPR',
  'Department of Design and Construction': 'DDC',
  'Department of Correction': 'DOC',
  'Department of Finance': 'DOF',
  "Administration for Children's Services": 'ACS',
  'Office of Technology and Innovation': 'OTI',
  "Mayor's Office of Contract Services": 'MOCS',
  'NYC Health + Hospitals': 'H+H',
  'NYCHA': 'NYCHA',
  'NYC Economic Development Corporation': 'EDC',
  'NYC Public Schools / DOE': 'DOE',
}

const initials = (s: string) =>
  s
    .replace(/[^A-Za-z/ ]/g, ' ')
    .split(/[\s/]+/)
    .filter((w) => w && !/^(of|and|the|for|nyc)$/i.test(w))
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 5) || '—'

export const codeFor = (key: string, value: string): string => {
  if (key === 'industry') return INDUSTRY[value] ?? initials(value)
  if (key === 'agency') return AGENCY[value] ?? (value.startsWith("Teachers'") ? 'TRS' : initials(value))
  if (key === 'method') return { 'Proposals (RFP)': 'RFP', 'Sealed bid': 'BID', 'RFI / notice': 'RFI', 'Design-build': 'DB', Demonstration: 'DEMO', 'Negotiated acquisition': 'NEG' }[value] ?? 'UNK'
  return initials(value)
}
