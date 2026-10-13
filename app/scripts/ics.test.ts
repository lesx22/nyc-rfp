/**
 * Unit tests for the .ics builder.
 *   npm run test:unit   (node --test --experimental-strip-types scripts/ics.test.ts)
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIcs, escapeText, foldLine } from '../src/lib/ics.ts'

const now = new Date('2026-10-13T15:04:05.678Z')
const rfp = {
  id: '05626P0001',
  title: 'Paid Detail Application, Scheduling; and Billing Software Platform for Uniformed Members',
  agency: 'New York City Police Department',
  epin: '05626P0001',
  dueDate: '2026-11-12',
  sourceUrl: 'https://databook.nyc/procurement/solicitations',
}
const octets = (s: string) => new TextEncoder().encode(s).length
const unfold = (s: string) => s.replace(/\r\n[ \t]/g, '')

test('uses CRLF line endings only', () => {
  const ics = buildIcs(rfp, now)
  assert.ok(ics.endsWith('\r\n'))
  assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false, 'no bare LF')
  assert.equal(ics.replace(/\r\n/g, '').includes('\r'), false, 'no bare CR')
})

test('no physical line exceeds 75 octets', () => {
  const ics = buildIcs({ ...rfp, title: 'Ünïcødé — '.repeat(30) }, now)
  for (const line of ics.split('\r\n')) assert.ok(octets(line) <= 75, `${octets(line)} octets: ${line}`)
})

test('folding round-trips and never splits a multi-byte character', () => {
  const long = 'SUMMARY:' + 'é'.repeat(100) + '🗽'.repeat(20)
  const folded = foldLine(long)
  assert.equal(unfold(folded), long)
  for (const line of folded.split('\r\n')) {
    assert.ok(octets(line) <= 75)
    assert.ok(!line.includes('�'))
  }
  assert.equal(foldLine('SHORT:x'), 'SHORT:x')
})

test('escapes commas, semicolons, backslashes and newlines', () => {
  assert.equal(escapeText('a,b;c\\d\ne\r\nf'), 'a\\,b\\;c\\\\d\\ne\\nf')
})

test('has an all-day VEVENT on the due date with a 3-day VALARM', () => {
  const ics = unfold(buildIcs(rfp, now))
  const lines = ics.split('\r\n')
  assert.ok(lines.includes('BEGIN:VCALENDAR') && lines.includes('VERSION:2.0') && lines.includes('END:VCALENDAR'))
  assert.ok(lines.includes('DTSTART;VALUE=DATE:20261112'))
  assert.ok(lines.includes('DTEND;VALUE=DATE:20261113'))
  assert.ok(lines.includes('DTSTAMP:20261013T150405Z'))
  assert.ok(lines.includes('SUMMARY:Due: Paid Detail Application\\, Scheduling\\; and Billing Software Platform for Uniformed Members'))
  const desc = lines.find((l) => l.startsWith('DESCRIPTION:Agency'))!
  assert.ok(desc.includes('Agency: New York City Police Department\\nEPIN: 05626P0001\\nSource: https://databook.nyc/procurement/solicitations'))
  const a = lines.indexOf('BEGIN:VALARM')
  assert.ok(a > lines.indexOf('BEGIN:VEVENT') && a < lines.indexOf('END:VEVENT'))
  assert.ok(lines.includes('TRIGGER:-P3D') && lines.includes('ACTION:DISPLAY'))
})

test('rolls DTEND over month and year boundaries', () => {
  const ics = unfold(buildIcs({ ...rfp, dueDate: '2026-12-31' }, now))
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101'))
})

test('omits unknown fields instead of inventing them', () => {
  const ics = unfold(buildIcs({ ...rfp, epin: null, sourceUrl: null }, now))
  assert.ok(!ics.includes('EPIN:'))
  assert.ok(!ics.includes('Source:'))
  assert.ok(!ics.includes('\r\nURL:'))
  assert.ok(ics.includes('UID:05626P0001-due@opportunity-graph'))
})

test('throws without a due date', () => {
  assert.throws(() => buildIcs({ ...rfp, dueDate: null }, now))
  assert.throws(() => buildIcs({ ...rfp, dueDate: 'TBD' }, now))
})
