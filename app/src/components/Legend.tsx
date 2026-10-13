import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { BUILD, PHASES } from '../data/progress'
import { cx } from '../lib/format'
import { buildLayout } from '../lib/layout'
import { useStore } from '../store'

/** Bottom-left: colour legend, heat scale, data provenance, and the build-progress drawer. */
export default function Legend({ source }: { source: string | null }) {
  const nodes = useStore((s) => s.nodes)
  const { l1, l2, heat, select } = useStore()
  const savedCount = useStore((s) => s.saved.size)
  const savedOnly = useStore((s) => s.filters.savedOnly)
  const setFilters = useStore((s) => s.setFilters)
  const [open, setOpen] = useState(false)
  const l1s = useMemo(() => {
    const lay = buildLayout(nodes, l1, l2)
    return lay.clusters.filter((c) => c.level === 1).map((c) => ({ id: c.id, label: c.label, n: c.members.length, color: lay.clusterColor.get(c.id)! }))
  }, [nodes, l1, l2])

  return (
    <div className="pointer-events-none absolute bottom-36 left-3 z-20 hidden w-60 flex-col gap-2 sm:flex lg:bottom-3">
      <AnimatePresence>{open && <Progress onClose={() => setOpen(false)} />}</AnimatePresence>
      <div className="glass pointer-events-auto rounded-[2px] p-3">
        <ul className="space-y-1">
          {l1s.map((c) => (
            <li key={c.id}>
              <button onClick={() => select({ kind: 'cluster', id: c.id })} className="flex w-full items-center gap-2 px-1 py-0.5 text-left text-[11px] text-text/75 hover:bg-phosphor/10 hover:text-text">
                <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                <span className="font-mono text-[10px] text-mute">{c.n}</span>
              </button>
            </li>
          ))}
        </ul>
        {heat && (
          <div className="mt-2.5 border-t border-line pt-2.5">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-heat-1 via-heat-2 to-heat-3" />
            <div className="mt-1 flex justify-between font-mono text-[9px] text-mute">
              <span>45+ days</span>
              <span>due now</span>
            </div>
          </div>
        )}
        <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5 text-[10px] text-mute">
          <span className="min-w-0 flex-1 truncate" title={source ?? undefined}>{source ? 'Sample data' : 'Loading…'}</span>
          {savedCount > 0 && (
            <button
              onClick={() => setFilters({ savedOnly: !savedOnly })}
              aria-pressed={savedOnly}
              title={savedOnly ? 'Show all listings' : 'Show only saved listings'}
              className={cx('shrink-0 px-1 transition-colors duration-150 hover:text-text', savedOnly && 'text-phosphor')}
            >
              <span className="font-mono">{savedCount}</span> saved
            </button>
          )}
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="shrink-0 rounded-[2px] border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/80 hover:border-white/40">
            {BUILD} build
          </button>
        </div>
      </div>
    </div>
  )
}

function Progress({ onClose }: { onClose: () => void }) {
  const all = PHASES.flatMap((p) => p.tasks)
  const done = all.filter(([, d]) => d).length
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="glass pointer-events-auto scroll-thin max-h-[60vh] overflow-y-auto rounded-[2px] p-3" aria-label="Build progress">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[12px] font-semibold">Build progress</h2>
        <button onClick={onClose} aria-label="Close build progress" className="text-[11px] text-mute hover:text-white">✕</button>
      </div>
      <div className="mb-3 font-mono text-[10px] text-mute">
        {done}/{all.length} tasks · {Math.round((done / all.length) * 100)}%
      </div>
      <ol className="space-y-3">
        {PHASES.map((p) => {
          const d = p.tasks.filter(([, x]) => x).length
          const pct = d / p.tasks.length
          return (
            <li key={p.id}>
              <div className="flex items-baseline gap-1.5 text-[11px]">
                <span className="font-mono text-mute">{p.id}</span>
                <span className="flex-1 font-medium">{p.name}</span>
                <span className="font-mono text-[10px] text-mute">{d}/{p.tasks.length}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className={cx('h-full rounded-full', pct === 1 ? 'bg-mint' : 'bg-cyan')} style={{ width: `${pct * 100}%` }} />
              </div>
              {pct > 0 && pct < 1 && (
                <ul className="mt-1.5 space-y-0.5">
                  {p.tasks.map(([t, x]) => (
                    <li key={t} className={cx('flex gap-1.5 text-[10px]', x ? 'text-white/45' : 'text-white/85')}>
                      <span className={x ? 'text-mint' : 'text-mute'}>{x ? '✓' : '○'}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </motion.section>
  )
}
