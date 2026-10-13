import { useEffect, useRef } from 'react'
import { useStore } from '../store'

/** Hover tag: follows the pointer and names whatever is under it. Nothing else. */
export function HoverTag() {
  const hovered = useStore((s) => s.hovered)
  const nodes = useStore((s) => s.nodes)
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (el.current) el.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`
    }
    window.addEventListener('pointermove', h)
    return () => window.removeEventListener('pointermove', h)
  }, [])
  let label: string | null = null
  if (hovered?.startsWith('1:')) label = hovered.slice(2)
  else if (hovered?.startsWith('2:')) label = hovered.slice(2).split('/').slice(1).join('/')
  else if (hovered) label = nodes.find((x) => x.id === hovered)?.title ?? null
  return (
    <div ref={el} className="pointer-events-none fixed left-0 top-0 z-40" aria-hidden="true">
      {label && <div className="glass max-w-72 truncate px-2 py-1 text-[12px]">{label}</div>}
    </div>
  )
}
