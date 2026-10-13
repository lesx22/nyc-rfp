import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { relevance } from '../lib/score'
import { useStore } from '../store'

const PROFILE_KEY = 'og.profile'
const SUGGESTIONS = ['Small AI + design studio', 'Data dashboards & GIS', 'Websites & digital services']

function readProfile(): string {
  try {
    return localStorage.getItem(PROFILE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** "Tell it about you" → local relevance scoring → graph rotates & re-highlights. */
export default function PromptBar() {
  const nodes = useStore((s) => s.nodes)
  const setRelevance = useStore((s) => s.setRelevance)
  const rel = useStore((s) => s.relevance)
  const select = useStore((s) => s.select)
  const [q, setQ] = useState(readProfile)
  const [asked, setAsked] = useState(readProfile())
  const input = useRef<HTMLInputElement>(null)

  const run = (text: string) => {
    setQ(text)
    setAsked(text)
    try {
      localStorage.setItem(PROFILE_KEY, text)
    } catch {
      /* private mode: fine */
    }
    select(null)
    setRelevance(relevance(nodes, text || 'software ai digital data'))
  }

  // Cover state: highlight a few "for you" picks on first load.
  useEffect(() => {
    if (nodes.length) setRelevance(relevance(nodes, readProfile() || 'software ai digital data platform'))
  }, [nodes, setRelevance])

  // ⌘K / "/" focuses the prompt.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const top = useMemo(
    () =>
      [...rel.entries()]
        .filter(([, v]) => v > 0.55)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => nodes.find((n) => n.id === id)!)
        .filter(Boolean),
    [rel, nodes],
  )

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-3 sm:p-5">
      <AnimatePresence>
        {top.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto pb-1 scroll-thin">
            <span className="eyebrow shrink-0 self-center px-1.5 py-1 text-phosphor">{asked ? 'Matches' : 'For you'}</span>
            {top.map((n) => (
              <button key={n.id} data-match onClick={() => select({ kind: 'node', id: n.id })} className="glass group shrink-0 rounded-[2px] px-3 py-1 text-left text-[12px] hover:border-phosphor/50">
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-phosphor align-middle" />
                <span className="inline-block max-w-56 truncate align-middle">{n.title}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(q.trim())
        }}
        className="glass pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-[2px] p-1.5 pl-4 shadow-[0_0_40px_-24px_rgba(92,225,230,.6)]"
      >
        <span className="text-phosphor" aria-hidden="true">✦</span>
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Describe your team and what you want to build"
          aria-label="Describe yourself to find matching opportunities"
          className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-mute"
        />
        
        <button className="h-10 rounded-[3px] bg-phosphor px-4 text-[13px] font-semibold text-ink transition-transform duration-150 active:scale-[.97]">Match</button>
      </form>
      <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => run(s)} className="rounded-[2px] border border-line px-2.5 py-1 text-[11px] text-text/60 transition-colors duration-150 hover:border-phosphor/50 hover:text-text">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
