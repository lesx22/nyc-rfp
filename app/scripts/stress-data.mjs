#!/usr/bin/env node
/**
 * SYNTHETIC test data for performance/layout testing only. Never commit the output or ship it.
 *   node scripts/stress-data.mjs 1500 > dist/data/stress.json   → open /?data=stress.json
 */
const N = Number(process.argv[2] ?? 1500)
const IND = ['Construction', 'Goods', 'Goods - Construction Related', 'Goods - IT Related', 'Human/Client Service', 'Other', 'Professional Services', 'Professional Services - Architecture/Engineering', 'Professional Services - Investigative/Confidential', 'Professional Services - IT Related', 'Professional Services- Construction Related', 'Standard Services', 'Standard Services - Construction Related', 'Standard Services - IT Related']
const AG = Array.from({ length: 45 }, (_, i) => `Test Agency ${String(i + 1).padStart(2, '0')}`)
const WORDS = ['software platform', 'data dashboard', 'HVAC repair', 'shelter services', 'vehicle supply', 'website redesign', 'case management system', 'paving', 'youth program', 'GIS mapping', 'consulting study', 'janitorial services']
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (a, skew = 1) => a[Math.floor(Math.pow(rnd(), skew) * a.length)]
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)
const rfps = Array.from({ length: N }, (_, i) => ({
  id: `TEST-${i}`,
  title: `[TEST] ${pick(WORDS)} #${i}`,
  agency: pick(AG, 1.8),
  epin: `${String(800 + (i % 90)).padStart(3, '0')}27${pick(['P', 'B', 'Y', 'N'])}${String(i).padStart(4, '0')}`,
  industry: pick(IND, 1.4),
  program: null,
  status: 'Released',
  releaseDate: day(-Math.floor(rnd() * 60)),
  dueDate: day(Math.floor(rnd() * 90) - 5),
  mainCommodity: null,
  estValueUSD: null,
  description: 'Synthetic row for load testing.',
  sourceUrl: null,
  confidence: 'low',
}))
process.stdout.write(JSON.stringify({ meta: { source: `SYNTHETIC stress test (${N} rows)`, fetchedAt: new Date().toISOString() }, rfps }))
