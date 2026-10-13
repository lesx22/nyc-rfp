import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { nodeUrl } from '../lib/deeplink'
import { buildIcs } from '../lib/ics'
import { buildLayout } from '../lib/layout'
import { countdown, cx, date, passportUrl, usd } from '../lib/format'
import { sectionRequirements, useSolicitation } from '../lib/solicitation'
import { useStore } from '../store'
import type { RfpNode } from '../types'

export default function SidePanel() {
  const selected = useStore((s) => s.selected)
  return (
    <AnimatePresence>
      {selected && (
        <motion.aside
          key={selected.kind}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="glass scroll-thin absolute inset-x-2 bottom-2 z-30 flex max-h-[72vh] flex-col overflow-y-auto rounded-[2px] sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-20 sm:max-h-none sm:w-[400px]"
        >
          {selected.kind === 'node' ? <NodeView id={selected.id} /> : <ClusterView id={selected.id} />}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

const ICON_BTN = 'grid size-8 shrink-0 place-items-center rounded-[2px] text-mute transition-colors duration-150 hover:bg-white/10 hover:text-white'

function BookmarkIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3.5 1.5h7v11L7 9.6l-3.5 2.9z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

/** Shortlist toggle. Keyboard: S (see NavControls). */
function SaveToggle({ id }: { id: string }) {
  const on = useStore((s) => s.saved.has(id))
  const toggle = useStore((s) => s.toggleSaved)
  return (
    <button
      aria-label="Save listing"
      aria-pressed={on}
      aria-keyshortcuts="s"
      title={on ? 'Saved. Click to remove (S)' : 'Save to your shortlist (S)'}
      onClick={() => toggle(id)}
      className={cx(ICON_BTN, on && 'text-phosphor hover:text-phosphor')}
    >
      <BookmarkIcon filled={on} />
    </button>
  )
}

/** Copy link with a visible read-only fallback when the clipboard API is missing or refused. */
function CopyLink({ n }: { n: RfpNode }) {
  const nodes = useStore((s) => s.nodes)
  const notify = useStore((s) => s.notify)
  const [fallback, setFallback] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (fallback) input.current?.select()
  }, [fallback])

  const copy = () => {
    const url = nodeUrl(n, nodes)
    const show = () => setFallback(url)
    try {
      // Called synchronously inside the click so the user-activation requirement holds.
      navigator.clipboard.writeText(url).then(() => (setFallback(null), notify('Link copied')), show)
    } catch {
      show()
    }
  }

  return (
    <>
      <button onClick={copy} className={SECONDARY}>
        Copy link
      </button>
      {fallback && (
        <label className="col-span-2 flex flex-col gap-1 text-[11px] text-mute">
          Copy this link (⌘C / Ctrl+C)
          <input ref={input} readOnly value={fallback} onFocus={(e) => e.currentTarget.select()} className="h-8 rounded-[2px] border border-line bg-ink px-2 font-mono text-[11px] text-text outline-none focus-visible:border-phosphor" />
        </label>
      )}
    </>
  )
}

function CalendarButton({ n }: { n: RfpNode }) {
  const hint = useId()
  const download = () => {
    const blob = new Blob([buildIcs(n)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `due-${(n.epin ?? n.id).replace(/[^A-Za-z0-9._~-]/g, '-')}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (!n.dueDate)
    return (
      <>
        <button disabled aria-describedby={hint} className={cx(SECONDARY, 'cursor-not-allowed opacity-40 hover:bg-transparent')}>
          Add deadline to calendar
        </button>
        <p id={hint} className="col-span-2 text-[10px] text-mute">
          No due date is published for this listing, so there is nothing to add to a calendar yet.
        </p>
      </>
    )
  return (
    <button onClick={download} title="Downloads an .ics file with a reminder 3 days before" className={SECONDARY}>
      Add deadline to calendar
    </button>
  )
}

const SECONDARY = 'grid min-h-9 place-items-center rounded-[2px] border border-line px-2 py-1.5 text-center text-[12px] leading-tight text-text/85 transition-colors duration-150 hover:border-white/30 hover:bg-white/5'

function Close() {
  const select = useStore((s) => s.select)
  return (
    <button aria-label="Close panel" onClick={() => select(null)} className={ICON_BTN}>
      ✕
    </button>
  )
}

/** Segmented 20-tick meter, like an instrument bar graph. Lit segments stagger in once (<300ms). */
function FitMeter({ v }: { v: number }) {
  const lit = Math.round(v / 5)
  return (
    <div className="flex h-3 gap-[3px]" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label="AI-buildable fit">
      {Array.from({ length: 20 }, (_, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0.15 }}
          animate={{ opacity: i < lit ? 1 : 0.15 }}
          transition={{ duration: 0.12, delay: i < lit ? i * 0.008 : 0, ease: [0.23, 1, 0.32, 1] }}
          className={cx('flex-1', i < lit ? (v >= 70 ? 'bg-phosphor' : v >= 45 ? 'bg-sky' : 'bg-mute') : 'bg-white/20')}
        />
      ))}
    </div>
  )
}

function NodeView({ id }: { id: string }) {
  const n = useStore((s) => s.nodes.find((x) => x.id === id))
  const openStudio = useStore((s) => s.openStudio)
  const reason = useStore((s) => s.matchReasons.get(id))
  if (!n) return null
  const urgent = n.daysLeft != null && n.daysLeft >= 0 && n.daysLeft <= 10
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1.5 truncate">{n.agency}</div>
          <h2 className="font-display text-[18px] font-semibold leading-snug text-balance">{n.title}</h2>
        </div>
        <SaveToggle id={n.id} />
        <Close />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-line bg-line text-[12px]">
        <Cell k="Due" v={<span className={cx(urgent && 'text-heat-2')}>{date(n.dueDate)}<div className="text-[11px]">{countdown(n.daysLeft)}</div></span>} />
        <Cell k="Released" v={date(n.releaseDate)} />
        <Cell k={n.industryInferred ? 'Industry (inferred)' : 'Industry'} v={n.industry} />
        <Cell k="Est. value" v={usd(n.estValueUSD)} />
        <Cell k="EPIN" v={<><span className="font-mono">{n.epin ?? '—'}</span>{n.method !== 'Unknown' && <div className="text-[11px] text-mute">{n.method}{n.fiscalYear && ` · FY${String(n.fiscalYear).slice(2)}`}</div>}</>} />
        <Cell k="Status" v={<>{n.status ?? '—'}{n.statusNote && <div className="text-[11px] text-mute">{n.statusNote}</div>}</>} />
        <div className="col-span-2">
          <Cell k="Main commodity" v={n.mainCommodity ?? '—'} />
        </div>
      </div>

      {reason && (
        <section className="border-l border-phosphor/60 pl-3">
          <h3 className="eyebrow mb-1">Why it matches you</h3>
          <p className="text-[13px] leading-relaxed text-text/85">{reason}</p>
          <p className="mt-1 text-[10px] text-mute">Ranked by Claude from the listing summary. Verify against the solicitation.</p>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="eyebrow">AI-buildable fit</h3>
          <span className="font-mono text-[15px] text-phosphor">{n.aiFit}</span>
        </div>
        <FitMeter v={n.aiFit} />
        <ul className="mt-2.5 space-y-1 text-[11px] text-mute">
          {n.aiFitReasons.map((r) => (
            <li key={r} className="font-mono">{r}</li>
          ))}
        </ul>
      </section>

      {n.description && (
        <section>
          <h3 className="eyebrow mb-1.5">Summary</h3>
          <p className="text-[13px] leading-relaxed text-white/75">{n.description}</p>
        </section>
      )}

      <Requirements epin={n.epin} />

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button onClick={() => openStudio(n.id)} className="h-11 rounded-[2px] bg-phosphor text-[13px] font-semibold text-ink transition-transform duration-150 ease-[var(--ease-out)] active:scale-[.97]">
          Draft a response
        </button>
        <a href={passportUrl(n)} target="_blank" rel="noreferrer" className="grid h-11 place-items-center rounded-[2px] border border-white/15 text-[13px] hover:bg-white/5">
          {n.onPassport === false ? 'View source listing ↗' : 'View listing on PASSPort ↗'}
        </a>
        <div className="grid grid-cols-2 gap-2">
          <CopyLink key={n.id} n={n} />
          <CalendarButton n={n} />
        </div>
        {n.onPassport === false && <p className="text-center text-[10px] text-mute">Not procured through PASSPort ({n.agencyNote ?? 'see source'}).</p>}
        {n.confidence && n.confidence !== 'high' && <p className="text-center text-[10px] text-mute">Data confidence: {n.confidence}. Verify on PASSPort before bidding.</p>}
      </div>
    </div>
  )
}

/** Requirements extracted from this listing's solicitation documents, when we have them. */
function Requirements({ epin }: { epin: string | null }) {
  const { data } = useSolicitation(epin)
  if (!data) return null
  const due = [...data.keyDates].reverse().find((d) => /due/i.test(d.label))
  return (
    <section aria-label="Requirements from the solicitation documents">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="eyebrow">From the solicitation documents</h3>
        <span className="font-mono text-[12px] text-phosphor">{data.counts.total} requirements</span>
      </div>
      <ul className="divide-y divide-white/5 rounded-[2px] border border-line">
        {data.sections.map((s) => (
          <li key={s.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-[12px]">
            <span className="min-w-0 truncate text-text/85">{s.title}</span>
            <span className="shrink-0 font-mono text-mute">{sectionRequirements(s).length}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        {due && (
          <>
            <dt className="text-mute">Latest due date</dt>
            <dd className="text-text/85">{due.date.replace('T', ' ')}</dd>
          </>
        )}
        {data.mwbe && (
          <>
            <dt className="text-mute">M/WBE goal</dt>
            <dd className="text-text/85">{Math.round(data.mwbe.participationGoal * 100)}%</dd>
          </>
        )}
        <dt className="text-mute">Evaluated on</dt>
        <dd className="text-text/85">{data.evaluationCriteria.areas.length} areas{data.evaluationCriteria.weights ? '' : ' (weights not published)'}</dd>
      </dl>
      <p className="mt-2 text-[10px] text-mute">Extracted from {data.sources.length} documents, each requirement cited to its page.</p>
    </section>
  )
}

function Cell({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="bg-ink/80 p-3">
      <div className="eyebrow mb-0.5">{k}</div>
      <div className="text-white/90">{v}</div>
    </div>
  )
}

function ClusterView({ id }: { id: string }) {
  const nodes = useStore((s) => s.nodes)
  const { l1, l2, select } = useStore()
  const layout = useMemo(() => buildLayout(nodes, l1, l2), [nodes, l1, l2])
  const c = layout.clusters.find((x) => x.id === id)
  if (!c) return null
  const members = c.members.map((m) => nodes.find((n) => n.id === m)!).sort((a, b) => b.aiFit - a.aiFit)
  const known = members.filter((m) => m.estValueUSD != null)
  const total = known.reduce((s, m) => s + (m.estValueUSD ?? 0), 0)
  const avg = Math.round(members.reduce((s, m) => s + m.aiFit, 0) / members.length)
  const soonest = members.filter((m) => m.daysLeft != null && m.daysLeft >= 0).sort((a, b) => a.daysLeft! - b.daysLeft!)[0]
  const parent = c.parent ? layout.clusters.find((x) => x.id === c.parent) : null
  const children = layout.clusters.filter((x) => x.parent === id)
  const color = layout.clusterColor.get(id)

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-mute">
            {parent && (
              <>
                <button className="hover:text-white" onClick={() => select({ kind: 'cluster', id: parent.id })}>{parent.label}</button>
                <span>/</span>
              </>
            )}
            <span>{c.level === 1 ? labelOf(l1) : labelOf(l2)}</span>
          </div>
          <h2 className="font-display flex items-center gap-2 text-[18px] font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
            {c.label}
          </h2>
        </div>
        <Close />
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-line bg-line text-center">
        <Stat k="Open" v={String(members.length)} />
        <Stat k="Avg AI fit" v={String(avg)} />
        <Stat k={`Value (${known.length} known)`} v={usd(known.length ? total : null)} />
      </div>
      {soonest && (
        <p className="text-[12px] text-mute">
          Next deadline: <button className="text-heat-2 hover:underline" onClick={() => select({ kind: 'node', id: soonest.id })}>{soonest.title}</button> — {countdown(soonest.daysLeft)}
        </p>
      )}

      {children.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Sub-clusters</h3>
          <div className="flex flex-wrap gap-1.5">
            {children.map((ch) => (
              <button key={ch.id} onClick={() => select({ kind: 'cluster', id: ch.id })} className="rounded-[2px] border border-white/10 px-2.5 py-1 text-[11px] hover:border-white/30">
                {ch.label} <span className="font-mono text-mute">{ch.members.length}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="eyebrow mb-2">Opportunities, by AI fit</h3>
        <ul className="divide-y divide-white/5">
          {members.map((m) => (
            <Row key={m.id} n={m} onClick={() => select({ kind: 'node', id: m.id })} />
          ))}
        </ul>
      </section>
    </div>
  )
}

const labelOf = (k: string) => ({ industry: 'Industry', agency: 'Agency', mainCommodity: 'Commodity', program: 'Program', method: 'Type' })[k] ?? k

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-ink/80 px-2 py-3">
      <div className="text-[17px] font-semibold text-phosphor">{v}</div>
      <div className="eyebrow">{k}</div>
    </div>
  )
}

function Row({ n, onClick }: { n: RfpNode; onClick: () => void }) {
  const saved = useStore((s) => s.saved.has(n.id))
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-white/[.03]">
        <span className="w-7 shrink-0 font-mono text-[12px] text-phosphor">{n.aiFit}</span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[12px] leading-snug">{n.title}</span>
          <span className="text-[10px] text-mute">
            {saved && <span className="mr-1 inline-block align-[-2px] text-phosphor" title="Saved"><BookmarkIcon filled size={9} /><span className="sr-only">Saved · </span></span>}
            {n.agency} · {countdown(n.daysLeft)}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[11px] text-white/60">{usd(n.estValueUSD)}</span>
      </button>
    </li>
  )
}
