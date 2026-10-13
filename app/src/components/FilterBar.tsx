import { useEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../lib/format'
import { emptyFilters, passesFilters, useStore, type Filters } from '../store'
import type { GroupKey } from '../types'

const LABEL: Record<GroupKey, string> = { industry: 'Industry', agency: 'Agency', mainCommodity: 'Commodity', program: 'Program' }

export default function FilterBar() {
  const nodes = useStore((s) => s.nodes)
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const { l1, l2, setHierarchy, heat, toggleHeat } = useStore()
  const shown = nodes.filter((n) => passesFilters(n, filters)).length

  const opts = useMemo(() => {
    const u = (k: GroupKey) => [...new Set(nodes.map((n) => (n[k] as string | null) ?? '').filter(Boolean))].sort()
    return { industry: u('industry'), agency: u('agency'), mainCommodity: u('mainCommodity') }
  }, [nodes])
  const dirty = JSON.stringify(filters) !== JSON.stringify(emptyFilters)

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 p-3 sm:p-4">
      <div className="pointer-events-auto mr-2 flex items-center gap-2.5">
        <img src="./favicon.svg" alt="" className="size-7" />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">Opportunity Graph</div>
          <div className="text-[11px] text-mute">NYC procurement, mapped</div>
        </div>
      </div>

      <div className="glass pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl p-1">
        <Multi label="Industry" values={opts.industry} sel={filters.industry} onChange={(industry) => setFilters({ industry })} />
        <Multi label="Agency" values={opts.agency} sel={filters.agency} onChange={(agency) => setFilters({ agency })} />
        <Multi label="Commodity" values={opts.mainCommodity} sel={filters.mainCommodity} onChange={(mainCommodity) => setFilters({ mainCommodity })} />
        <Select
          label="Due"
          value={filters.dueWithin}
          options={[[null, 'Any time'], [7, '≤ 7 days'], [14, '≤ 14 days'], [30, '≤ 30 days'], [60, '≤ 60 days']]}
          onChange={(dueWithin) => setFilters({ dueWithin } as Partial<Filters>)}
        />
        <Chip on={filters.digitalOnly} onClick={() => setFilters({ digitalOnly: !filters.digitalOnly })} title="AI-fit score ≥ 60">
          ✦ AI-buildable
        </Chip>
        {dirty && (
          <button className="px-2 text-[12px] text-mute hover:text-white" onClick={() => setFilters(emptyFilters)}>
            Reset
          </button>
        )}
      </div>

      <div className="glass pointer-events-auto flex items-center gap-1 rounded-xl p-1">
        <span className="pl-2 text-[11px] uppercase tracking-wider text-mute">Cluster</span>
        <Select label="" value={l1} options={(['industry', 'agency', 'mainCommodity'] as GroupKey[]).map((k) => [k, LABEL[k]])} onChange={(v) => setHierarchy(v as GroupKey, v === l2 ? l1 : l2)} />
        <span className="text-mute">→</span>
        <Select label="" value={l2} options={(['agency', 'industry', 'mainCommodity'] as GroupKey[]).filter((k) => k !== l1).map((k) => [k, LABEL[k]])} onChange={(v) => setHierarchy(l1, v as GroupKey)} />
        <Chip on={heat} onClick={toggleHeat} title="Warm colours = closer deadline. Live traffic heat lands in Phase 4.">
          <span className="inline-block size-2 rounded-full bg-gradient-to-r from-heat-1 via-heat-2 to-heat-3" /> Heat
        </Chip>
      </div>

      <div className="pointer-events-auto ml-auto font-mono text-[11px] text-mute">
        {shown}/{nodes.length} open opportunities
      </div>
    </header>
  )
}

function Chip({ on, children, ...p }: { on: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} aria-pressed={on} className={cx('flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] transition-colors', on ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10')}>
      {children}
    </button>
  )
}

function useOutside(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const h = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && close()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('pointerdown', h)
    document.addEventListener('keydown', k)
    return () => (document.removeEventListener('pointerdown', h), document.removeEventListener('keydown', k))
  }, [ref, close])
}

function Multi({ label, values, sel, onChange }: { label: string; values: string[]; sel: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const list = values.filter((v) => v.toLowerCase().includes(q.toLowerCase()))
  return (
    <div ref={ref} className="relative">
      <Chip on={sel.length > 0} onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}
        {sel.length > 0 && <span className="font-mono text-[10px]">{sel.length}</span>}
        <span className="text-[9px] opacity-60">▼</span>
      </Chip>
      {open && (
        <div className="glass scroll-thin absolute left-0 top-10 z-30 max-h-80 w-72 overflow-auto rounded-xl p-1.5 shadow-2xl">
          {values.length > 8 && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} className="mb-1 w-full rounded-lg bg-white/5 px-2.5 py-1.5 text-[12px] outline-none placeholder:text-mute" />}
          {list.map((v) => {
            const on = sel.includes(v)
            return (
              <button key={v} onClick={() => onChange(on ? sel.filter((x) => x !== v) : [...sel, v])} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-white/10">
                <span className={cx('grid size-3.5 shrink-0 place-items-center rounded border text-[9px]', on ? 'border-white bg-white text-black' : 'border-white/30')}>{on && '✓'}</span>
                <span className="truncate">{v}</span>
              </button>
            )
          })}
          {!list.length && <div className="px-2.5 py-2 text-[12px] text-mute">No matches</div>}
        </div>
      )}
    </div>
  )
}

function Select<T extends string | number | null>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <label className="flex h-8 items-center gap-1 rounded-lg px-1.5 text-[12px] text-white/80 hover:bg-white/10">
      {label && <span>{label}</span>}
      <select value={String(value)} onChange={(e) => onChange(options.find(([v]) => String(v) === e.target.value)![0])} className="cursor-pointer bg-transparent text-white outline-none [&>option]:bg-zinc-900">
        {options.map(([v, l]) => (
          <option key={String(v)} value={String(v)}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}
