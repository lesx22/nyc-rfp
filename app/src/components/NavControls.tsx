import { useEffect } from 'react'
import { cam } from '../lib/camera'
import { useStore } from '../store'

/** Click + keyboard alternatives to drag/pinch (Vercel guideline: no gesture-only interactions). */
export default function NavControls() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      const s = useStore.getState()
      const step = e.shiftKey ? 0.6 : 0.25
      const act: Record<string, () => void> = {
        ArrowLeft: () => cam.orbit(step, 0),
        ArrowRight: () => cam.orbit(-step, 0),
        ArrowUp: () => cam.orbit(0, step * 0.6),
        ArrowDown: () => cam.orbit(0, -step * 0.6),
        '=': () => cam.zoom(18),
        '+': () => cam.zoom(18),
        '-': () => cam.zoom(-18),
        '0': () => (s.select(null), cam.home()),
        Escape: () => (s.studioFor ? s.openStudio(null) : s.select(null)),
      }
      if (act[e.key]) {
        e.preventDefault()
        act[e.key]()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const btn = 'grid size-10 place-items-center text-[15px] text-white/80 hover:bg-white/10 hover:text-white active:bg-white/15 sm:size-9'
  return (
    <div className="glass pointer-events-auto absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col overflow-hidden rounded-[2px] sm:bottom-28 sm:top-auto sm:translate-y-0" role="toolbar" aria-label="Camera">
      <button className={btn} aria-label="Zoom in (+)" title="Zoom in (+)" onClick={() => cam.zoom(18)}>+</button>
      <button className={btn} aria-label="Zoom out (−)" title="Zoom out (−)" onClick={() => cam.zoom(-18)}>−</button>
      <button className={btn} aria-label="Rotate left (←)" title="Rotate (← →)" onClick={() => cam.orbit(0.35, 0)}>↻</button>
      <button className={btn} aria-label="Reset view (0)" title="Reset view (0)" onClick={() => (useStore.getState().select(null), cam.home())}>⌂</button>
    </div>
  )
}
