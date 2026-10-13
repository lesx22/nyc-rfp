/**
 * iCalendar (RFC 5545) export for a solicitation's due date.
 * Pure and dependency-free so it runs in the browser and under `node --experimental-strip-types`
 * (tested by scripts/ics.test.ts). Only published fields are written; missing ones are omitted.
 */
import type { Rfp } from '../types.ts'

type IcsInput = Pick<Rfp, 'id' | 'title' | 'agency' | 'epin' | 'dueDate' | 'sourceUrl'>

const CRLF = '\r\n'
const enc = new TextEncoder()

/** TEXT value escaping (RFC 5545 §3.3.11): backslash, semicolon, comma, newline. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n')
}

/** Fold a content line so no physical line exceeds 75 octets (§3.1). Never splits a UTF-8 sequence. */
export function foldLine(line: string): string {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = enc.encode(ch).length
    // Continuation lines start with one space, which counts toward their 75 octets.
    if (bytes + b > 75) {
      out.push(cur)
      cur = ' '
      bytes = 1
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join(CRLF)
}

const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

function icsDate(y: number, m: number, d: number): string {
  const t = new Date(Date.UTC(y, m - 1, d))
  return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')}`
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Build a one-event calendar: all-day on the due date, titled "Due: <title>", with agency,
 * EPIN and source URL in the description and a display alarm 3 days before.
 * Throws when the listing has no valid due date (the UI disables the action in that case).
 */
export function buildIcs(rfp: IcsInput, now: Date = new Date()): string {
  const m = rfp.dueDate ? isoDate.exec(rfp.dueDate) : null
  if (!m) throw new Error('buildIcs: listing has no valid dueDate')
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]

  const desc = [`Agency: ${rfp.agency}`, rfp.epin && `EPIN: ${rfp.epin}`, rfp.sourceUrl && `Source: ${rfp.sourceUrl}`, 'Verify the deadline on PASSPort before submitting.']
    .filter(Boolean)
    .join('\n')
  const summary = `Due: ${rfp.title}`
  const uid = `${(rfp.epin ?? rfp.id).replace(/[^A-Za-z0-9._~-]/g, '-')}-due@opportunity-graph`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Opportunity Graph//Deadline export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${icsDate(y, mo, d)}`,
    `DTEND;VALUE=DATE:${icsDate(y, mo, d + 1)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(desc)}`,
    ...(rfp.sourceUrl ? [`URL:${rfp.sourceUrl}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    'TRIGGER:-P3D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join(CRLF) + CRLF
}
