export const usd = (v: number | null | undefined) =>
  v == null ? '—' : v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`

export const date = (iso: string | null) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export const countdown = (d: number | null) => (d == null ? 'No due date' : d < 0 ? 'Closed' : d === 0 ? 'Due today' : `${d} day${d === 1 ? '' : 's'} left`)

export const passportUrl = (r: { sourceUrl: string | null; epin: string | null }) =>
  r.sourceUrl ?? 'https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
