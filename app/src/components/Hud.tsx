import { useEffect, useMemo, useRef, useState } from 'react'
import { cam } from '../lib/camera'
import { codeFor } from '../lib/codes'
import { U } from '../lib/hud'
import { passesFilters, useStore } from '../store'

const deg = (r: number) => String(Math.round((((r * 180) / Math.PI) % 360 + 360) % 360)).padStart(3, '0') + '°'

/** Top-right instrument readout: record count, sweep bearing, camera azimuth/elevation/range. */
export function Readout() {
  const nodes = useStore((s) => s.nodes)
  const filters = useStore((s) => s.filters)
  const shown = useMemo(() => nodes.filter((n) => passesFilters(n, filters)).length, [nodes, filters])
  const closing = useMemo(() => nodes.filter((n) => n.daysLeft != null && n.daysLeft >= 0 && n.daysLeft <= 14).length, [nodes])
  const ref = useRef<HTMLSpanElement>(null)
  // 10 Hz text update via ref: no React re-render per tick.
  useEffect(() => {
    const id = setInterval(() => {
      const c = cam.controls
      if (!ref.current || !c) return
      ref.current.textContent = `SWP ${deg(U.uSweep.value)} · AZ ${deg(c.azimuthAngle)} · EL ${deg(Math.PI / 2 - c.polarAngle)} · RNG ${String(Math.round(c.distance)).padStart(4, '0')}`
    }, 100)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="pointer-events-none absolute right-3 top-[68px] z-10 hidden flex-col items-end gap-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-mute xl:flex">
      <span>
        REC <b className="font-medium text-phosphor">{String(shown).padStart(3, '0')}</b>/{String(nodes.length).padStart(3, '0')} · <span className="text-heat-2">{closing} closing ≤14D</span>
      </span>
      <span ref={ref}>SWP — · AZ — · EL — · RNG —</span>
    </div>
  )
}

/** Crosshair tag: follows the pointer and names whatever is under it. */
export function HoverTag() {
  const hovered = useStore((s) => s.hovered)
  const nodes = useStore((s) => s.nodes)
  const l1 = useStore((s) => s.l1)
  const l2 = useStore((s) => s.l2)
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (el.current) el.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`
    }
    window.addEventListener('pointermove', h)
    return () => window.removeEventListener('pointermove', h)
  }, [])
  let body: React.ReactNode = null
  if (hovered?.startsWith('1:') || hovered?.startsWith('2:')) {
    const label = hovered.startsWith('1:') ? hovered.slice(2) : hovered.slice(2).split('/').slice(1).join('/')
    body = (
      <>
        <span className="text-phosphor">{codeFor(hovered.startsWith('1:') ? l1 : l2, label)}</span> {label}
      </>
    )
  } else if (hovered) {
    const n = nodes.find((x) => x.id === hovered)
    if (n)
      body = (
        <>
          <div className="text-phosphor">
            {n.epin ?? n.id} · FIT {String(n.aiFit).padStart(3, '0')} · {n.daysLeft == null ? 'NO DUE DATE' : n.daysLeft < 0 ? 'CLOSED' : `T–${n.daysLeft}D`}
          </div>
          <div className="max-w-72 truncate normal-case tracking-normal text-text">{n.title}</div>
        </>
      )
  }
  return (
    <div ref={el} className="pointer-events-none fixed left-0 top-0 z-40" aria-hidden="true">
      {body && <div className="glass px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]">{body}</div>}
    </div>
  )
}

/** One-time boot log, timed to the first radar revolution. Built from the real dataset counts. */
export function BootLog({ source }: { source: string | null }) {
  const nodes = useStore((s) => s.nodes)
  const [show] = useState(() => {
    try {
      return sessionStorage.getItem('og.booted') !== '1' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return true
    }
  })
  if (!show || !nodes.length) return null
  const sectors = new Set(nodes.map((n) => n.industry)).size
  const agencies = new Set(nodes.map((n) => n.agency)).size
  const closing = nodes.filter((n) => n.daysLeft != null && n.daysLeft >= 0 && n.daysLeft <= 14).length
  const lines = [
    `> FEED ${source?.split(' ')[0].toUpperCase() ?? 'PASSPORT'} ............ OK`,
    `> LOADING ${nodes.length} RECORDS · ${sectors} SECTORS · ${agencies} AGENCIES`,
    `> ${closing} RECORDS CLOSING ≤14D ............ FLAGGED`,
    `> SWEEP CALIBRATED · SCOPE ONLINE`,
  ]
  return (
    <div className="boot-log pointer-events-none absolute left-1/2 top-[22%] z-30 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.1em] text-phosphor">
      {lines.map((l, i) => (
        <div key={i} className="opacity-0" style={{ animation: `boot-line 1ms linear ${0.15 + i * 0.5}s forwards` }}>
          {l}
        </div>
      ))}
    </div>
  )
}
