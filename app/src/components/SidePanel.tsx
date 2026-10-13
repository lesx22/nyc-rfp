import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { buildLayout } from '../lib/layout'
import { countdown, cx, date, passportUrl, usd } from '../lib/format'
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
          className="glass scroll-thin absolute inset-x-2 bottom-2 z-30 flex max-h-[72vh] flex-col overflow-y-auto rounded-2xl sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-20 sm:max-h-none sm:w-[400px]"
        >
          {selected.kind === 'node' ? <NodeView id={selected.id} /> : <ClusterView id={selected.id} />}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function Close() {
  const select = useStore((s) => s.select)
  return (
    <button aria-label="Close panel" onClick={() => select(null)} className="grid size-8 shrink-0 place-items-center rounded-lg text-mute hover:bg-white/10 hover:text-white">
      ✕
    </button>
  )
}

function FitMeter({ v }: { v: number }) {
  const tone = v >= 70 ? 'from-cyan to-mint' : v >= 45 ? 'from-sky to-violet' : 'from-zinc-500 to-zinc-400'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className={cx('h-full rounded-full bg-gradient-to-r', tone)} />
    </div>
  )
}

function NodeView({ id }: { id: string }) {
  const n = useStore((s) => s.nodes.find((x) => x.id === id))
  const openStudio = useStore((s) => s.openStudio)
  if (!n) return null
  const urgent = n.daysLeft != null && n.daysLeft >= 0 && n.daysLeft <= 10
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-mute">{n.agency}</div>
          <h2 className="text-[19px] font-semibold leading-snug tracking-tight text-balance">{n.title}</h2>
        </div>
        <Close />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-[12px]">
        <Cell k="Due" v={<span className={cx(urgent && 'text-heat-2')}>{date(n.dueDate)}<div className="text-[11px] text-mute">{countdown(n.daysLeft)}</div></span>} />
        <Cell k="Released" v={date(n.releaseDate)} />
        <Cell k={n.industryInferred ? 'Industry (inferred)' : 'Industry'} v={n.industry} />
        <Cell k="Est. value" v={usd(n.estValueUSD)} />
        <Cell k="EPIN" v={<><span className="font-mono">{n.epin ?? '—'}</span>{n.method !== 'Unknown' && <div className="text-[11px] text-mute">{n.method}{n.fiscalYear && ` · FY${String(n.fiscalYear).slice(2)}`}</div>}</>} />
        <Cell k="Status" v={<>{n.status ?? '—'}{n.statusNote && <div className="text-[11px] text-mute">{n.statusNote}</div>}</>} />
        <div className="col-span-2">
          <Cell k="Main commodity" v={n.mainCommodity ?? '—'} />
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[12px] font-medium">AI-buildable fit</h3>
          <span className="font-mono text-[13px]">{n.aiFit}</span>
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
          <h3 className="mb-1.5 text-[12px] font-medium">Summary</h3>
          <p className="text-[13px] leading-relaxed text-white/75">{n.description}</p>
        </section>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button onClick={() => openStudio(n.id)} className="h-11 rounded-xl bg-white text-[13px] font-medium text-black transition-transform active:scale-[.98]">
          ✦ Generate RFP response
        </button>
        <a href={passportUrl(n)} target="_blank" rel="noreferrer" className="grid h-11 place-items-center rounded-xl border border-white/15 text-[13px] hover:bg-white/5">
          {n.onPassport === false ? 'View source listing ↗' : 'View listing on PASSPort ↗'}
        </a>
        {n.onPassport === false && <p className="text-center text-[10px] text-mute">Not procured through PASSPort ({n.agencyNote ?? 'see source'}).</p>}
        {n.confidence && n.confidence !== 'high' && <p className="text-center text-[10px] text-mute">Data confidence: {n.confidence}. Verify on PASSPort before bidding.</p>}
      </div>
    </div>
  )
}

function Cell({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="bg-black/60 p-3">
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-mute">{k}</div>
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
          <h2 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight">
            <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
            {c.label}
          </h2>
        </div>
        <Close />
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
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
          <h3 className="mb-2 text-[12px] font-medium">Sub-clusters</h3>
          <div className="flex flex-wrap gap-1.5">
            {children.map((ch) => (
              <button key={ch.id} onClick={() => select({ kind: 'cluster', id: ch.id })} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] hover:border-white/30">
                {ch.label} <span className="font-mono text-mute">{ch.members.length}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[12px] font-medium">Opportunities, by AI fit</h3>
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
    <div className="bg-black/60 px-2 py-3">
      <div className="text-[17px] font-semibold tracking-tight">{v}</div>
      <div className="text-[10px] uppercase tracking-wider text-mute">{k}</div>
    </div>
  )
}

function Row({ n, onClick }: { n: RfpNode; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-white/[.03]">
        <span className="w-7 shrink-0 font-mono text-[12px] text-cyan">{n.aiFit}</span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[12px] leading-snug">{n.title}</span>
          <span className="text-[10px] text-mute">{n.agency} · {countdown(n.daysLeft)}</span>
        </span>
        <span className="shrink-0 font-mono text-[11px] text-white/60">{usd(n.estValueUSD)}</span>
      </button>
    </li>
  )
}
