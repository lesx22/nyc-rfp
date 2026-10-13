import { lazy, Suspense, useEffect, useState } from 'react'
import FilterBar from './components/FilterBar'
import { HoverTag } from './components/Hud'
import Legend from './components/Legend'
import NavControls from './components/NavControls'
import PromptBar from './components/PromptBar'
import ResponseStudio from './components/ResponseStudio'
import SidePanel from './components/SidePanel'
import { enrich } from './lib/score'
import { useStore } from './store'
import type { Rfp } from './types'

const Graph = lazy(() => import('./components/Graph'))

export default function App() {
  const setNodes = useStore((s) => s.setNodes)
  const [meta, setMeta] = useState<{ source: string; fetchedAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // ?data=stress.json loads an alternate local file (dev/testing only; filename-only for safety).
    const alt = new URLSearchParams(location.search).get('data')
    const file = alt && /^[\w.-]+\.json$/.test(alt) ? alt : 'rfps.json'
    fetch(`${import.meta.env.BASE_URL}data/${file}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { meta: { source: string; fetchedAt: string }; rfps: Rfp[] }) => {
        setMeta(d.meta)
        setNodes(enrich(d.rfps))
      })
      .catch((e) => setError(String(e)))
  }, [setNodes])

  return (
    <div className="relative h-full w-full select-none">
      <Suspense fallback={<Loading />}>
        <Graph />
      </Suspense>
      <FilterBar />
      <SidePanel />
      <PromptBar />
      <ResponseStudio />
      <NavControls />
      <HoverTag />
      <Legend source={meta ? `${meta.source} · ${new Date(meta.fetchedAt).toLocaleDateString()}` : null} />
      {error && <div className="absolute inset-0 grid place-items-center text-[13px] text-heat-3">Couldn't load opportunities: {error}</div>}
    </div>
  )
}

function Loading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="size-3 animate-ping rounded-full bg-cyan" />
    </div>
  )
}
