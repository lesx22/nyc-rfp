import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { aiAvailable, projectDraftRfp, readTextFiles, streamDraft } from '../lib/ai'
import { countdown, cx, date, passportUrl, usd } from '../lib/format'
import { type Intake, OUTLINE_SECTIONS, outline } from '../lib/outline'
import { loadSampleDraft, useSolicitation } from '../lib/solicitation'
import { useStore } from '../store'
import type { RfpNode } from '../types'

/**
 * Response Studio: guided intake → draft. The template outline is always available locally;
 * "Draft with Claude" streams a cited draft from /api/draft when the backend is configured
 * (docs/AI.md). Still to come: chat, PDF/DOCX parsing, requirement extraction, compliance checks.
 */
const STEPS = ['Brief', 'About you', 'Documents', 'Draft', 'Submit'] as const

export default function ResponseStudio() {
  const id = useStore((s) => s.studioFor)
  const close = useStore((s) => s.openStudio)
  const n = useStore((s) => s.nodes.find((x) => x.id === id))
  return (
    <AnimatePresence>
      {n && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-3 backdrop-blur-sm" onClick={() => close(null)}>
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Response studio"
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex h-[min(720px,100%)] w-[min(980px,100%)] flex-col overflow-hidden rounded-[2px]"
          >
            <Studio n={n} onClose={() => close(null)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Studio({ n, onClose }: { n: RfpNode; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [files, setFiles] = useState<File[]>([])
  const [f, setF] = useState<Intake>({ org: '', team: '', capabilities: '', pastWork: '', mwbe: false, approach: '' })
  const template = useMemo(() => outline(n, f, files.map((x) => x.name)), [n, f, files])
  const ai = useClaudeDraft(n, f, files)
  const sol = useSolicitation(n.epin)
  const sample = useSampleDraft(n.epin, f)
  const draft = ai.text ?? sample.text ?? template

  return (
    <>
      <header className="flex items-center gap-4 border-b border-line px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-mute">Response studio</div>
          <div className="truncate text-[14px] font-medium">{n.title}</div>
        </div>
        <span className="hidden font-mono text-[11px] text-heat-2 sm:block">{countdown(n.daysLeft)}</span>
        <button aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-[2px] text-mute hover:bg-white/10 hover:text-white">✕</button>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-44 shrink-0 flex-col gap-1 border-r border-line p-3 sm:flex">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)} className={cx('flex items-center gap-2.5 rounded-[2px] px-2.5 py-2 text-left text-[13px]', i === step ? 'bg-white/10 text-white' : 'text-mute hover:text-white')}>
              <span className={cx('grid size-5 place-items-center rounded-full border font-mono text-[10px]', i < step ? 'border-mint bg-mint text-black' : i === step ? 'border-white' : 'border-white/20')}>{i < step ? '✓' : i + 1}</span>
              {s}
            </button>
          ))}
        </nav>
        <main className="scroll-thin min-w-0 flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="space-y-4 text-[13px] leading-relaxed text-white/80">
              <h3 className="text-[17px] font-semibold text-white">What they're asking for</h3>
              <p>{n.description ?? 'No summary available yet — open the listing on PASSPort and download the solicitation documents.'}</p>
              <div className="grid grid-cols-2 gap-3 font-mono text-[12px] sm:grid-cols-4">
                <KV k="Agency" v={n.agency} />
                <KV k="Due" v={date(n.dueDate)} />
                <KV k="Value" v={usd(n.estValueUSD)} />
                <KV k="AI fit" v={String(n.aiFit)} />
              </div>
              {sol.data && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[2px] border border-line p-4">
                    <div className="mb-2 text-[12px] font-medium text-white">Evaluated on</div>
                    <ol className="list-decimal space-y-0.5 pl-4 text-[12px]">
                      {sol.data.evaluationCriteria.areas.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ol>
                    {!sol.data.evaluationCriteria.weights && <p className="mt-2 text-[11px] text-mute">Weights are in the main RFS, which hasn't been captured yet.</p>}
                  </div>
                  <div className="rounded-[2px] border border-line p-4">
                    <div className="mb-2 text-[12px] font-medium text-white">Key dates</div>
                    <ul className="space-y-0.5 text-[12px]">
                      {sol.data.keyDates.map((d) => (
                        <li key={d.label} className="flex justify-between gap-3">
                          <span className="min-w-0 truncate text-mute">{d.label}</span>
                          <span className="shrink-0 font-mono">{d.date.slice(0, 10)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="rounded-[2px] border border-line p-4">
                <div className="mb-2 text-[12px] font-medium text-white">Before you start</div>
                <ol className="list-decimal space-y-1 pl-4 text-[12px]">
                  <li>Create or confirm your <b>PASSPort vendor account</b> and filed Vendor Enrollment.</li>
                  <li>Download every solicitation document and addendum from the listing.</li>
                  <li>Note the pre-proposal conference date and question deadline.</li>
                  <li>Check M/WBE participation goals and insurance requirements.</li>
                </ol>
                <a href={passportUrl(n)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[12px] text-cyan hover:underline">Open listing on PASSPort ↗</a>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-4">
              <h3 className="text-[17px] font-semibold">Tell us about your team</h3>
              <Field label="Organization name" v={f.org} on={(org) => setF({ ...f, org })} />
              <Field label="Team (who's on it, size, roles)" v={f.team} on={(team) => setF({ ...f, team })} area />
              <Field label="Capabilities relevant to this RFP" v={f.capabilities} on={(capabilities) => setF({ ...f, capabilities })} area />
              <Field label="Past work / references" v={f.pastWork} on={(pastWork) => setF({ ...f, pastWork })} area />
              <Field label="Your approach in a few sentences" v={f.approach} on={(approach) => setF({ ...f, approach })} area />
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={f.mwbe} onChange={(e) => setF({ ...f, mwbe: e.target.checked })} className="accent-cyan-400" /> We are a certified M/WBE
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-[17px] font-semibold">Supporting documents</h3>
              <p className="text-[13px] text-mute">Add your capability statement, résumés, case studies, insurance certificates and the RFP PDF. Files stay in your browser in this version.</p>
              <label className="grid h-36 cursor-pointer place-items-center rounded-[2px] border border-dashed border-white/20 text-[13px] text-mute hover:border-white/40 hover:text-white">
                <span>Drop files or click to upload</span>
                <input type="file" multiple className="hidden" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
              </label>
              <ul className="space-y-1 font-mono text-[12px]">
                {files.map((x, i) => (
                  <li key={i} className="flex justify-between rounded-[2px] bg-white/5 px-3 py-2">
                    <span className="truncate">{x.name}</span>
                    <span className="text-mute">{Math.ceil(x.size / 1024)} KB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-[17px] font-semibold">{ai.text != null ? 'Draft' : 'Draft outline'}</h3>
                {ai.available && (
                  <>
                    <label className="sr-only" htmlFor="draft-section">Section to draft</label>
                    <select
                      id="draft-section"
                      value={ai.section}
                      onChange={(e) => ai.setSection(e.target.value)}
                      disabled={ai.streaming}
                      className="h-8 max-w-48 rounded-[2px] border border-line bg-ink px-2 text-[12px] text-text outline-none focus:border-phosphor/60"
                    >
                      <option value="">Whole proposal</option>
                      {OUTLINE_SECTIONS.map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                    {ai.streaming ? (
                      <button onClick={ai.stop} className="h-8 rounded-[2px] border border-phosphor/60 px-3 text-[12px] text-phosphor hover:bg-phosphor/10">Stop</button>
                    ) : (
                      <button onClick={ai.start} className="h-8 rounded-[2px] bg-phosphor px-3 text-[12px] font-semibold text-ink transition-transform duration-150 ease-[var(--ease-out)] active:scale-[.97]">
                        {ai.text != null ? 'Redraft with Claude' : 'Draft with Claude'}
                      </button>
                    )}
                    {ai.text != null && !ai.streaming && (
                      <button onClick={ai.reset} className="h-8 rounded-[2px] px-2 text-[12px] text-mute hover:text-text">Use template</button>
                    )}
                  </>
                )}
                {!ai.available && sample.available && (
                  sample.streaming ? (
                    <span className="h-8 px-1 text-[12px] leading-8 text-phosphor">Writing…</span>
                  ) : (
                    <button onClick={sample.start} className="h-8 rounded-[2px] bg-phosphor px-3 text-[12px] font-semibold text-ink transition-transform duration-150 ease-[var(--ease-out)] active:scale-[.97]">
                      {sample.text != null ? 'Rewrite first draft' : 'Write first draft'}
                    </button>
                  )
                )}
                <button onClick={() => download(`${n.epin ?? n.id}-response.md`, draft)} disabled={ai.streaming} className="h-8 rounded-[2px] border border-white/15 px-3 text-[12px] enabled:hover:bg-white/5 disabled:opacity-40">Download .md</button>
              </div>
              <p aria-live="polite" className="text-[11px] leading-snug text-mute empty:hidden">{ai.note || (sample.text != null ? 'Sample first draft for this demo, written against this solicitation\'s extracted requirements. Your answers fill the gaps; anything still marked NEEDS INPUT is yours to add.' : '')}</p>
              <pre aria-busy={ai.streaming} className="whitespace-pre-wrap rounded-[2px] border border-line bg-black/50 p-4 font-mono text-[12px] leading-relaxed text-white/80">
                {draft}
                {(ai.streaming || sample.streaming) && <span aria-hidden="true" className="text-phosphor">▍</span>}
              </pre>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3 text-[13px] text-white/80">
              <h3 className="text-[17px] font-semibold text-white">Submission checklist</h3>
              {(sol.data?.submissionChecklist.map((c) => c.item) ?? ['Proposal narrative follows the RFP section order', 'Price proposal in the required format', 'Doing Business Data Form(s)', 'M/WBE Utilization Plan (or waiver request)', 'Insurance certificates', 'Signed acknowledgement of all addenda', 'Uploaded in PASSPort before the deadline']).map((c) => (
                <label key={c} className="flex items-center gap-2.5 rounded-[2px] bg-white/[.03] px-3 py-2.5">
                  <input type="checkbox" className="accent-cyan-400" /> {c}
                </label>
              ))}
              <p className="pt-2 text-[12px] text-mute">Submissions happen inside PASSPort. Use this checklist before you upload.</p>
            </div>
          )}
        </main>
      </div>
      <footer className="flex items-center justify-between border-t border-line px-5 py-3">
        <span className="text-[11px] text-mute">{ai.available ? 'Claude drafts from your intake and .txt/.md files. You verify every claim.' : 'Template outline. Claude drafting appears when the server is configured.'}</span>
        <div className="flex gap-2">
          <button disabled={step === 0} onClick={() => setStep(step - 1)} className="h-9 rounded-[2px] px-3 text-[13px] text-mute enabled:hover:text-white disabled:opacity-30">Back</button>
          <button onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : onClose())} className="h-9 rounded-[2px] bg-white px-4 text-[13px] font-medium text-black">{step < STEPS.length - 1 ? 'Continue' : 'Done'}</button>
        </div>
      </footer>
    </>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[2px] bg-white/5 p-2.5">
      <div className="text-[10px] uppercase text-mute">{k}</div>
      <div className="truncate text-white">{v}</div>
    </div>
  )
}

function Field({ label, v, on, area }: { label: string; v: string; on: (v: string) => void; area?: boolean }) {
  const cls = 'w-full rounded-[2px] border border-line bg-white/[.03] px-3 py-2.5 text-[13px] outline-none focus:border-white/30'
  return (
    <label className="grid gap-1.5 text-[12px] text-mute">
      {label}
      {area ? <textarea rows={3} value={v} onChange={(e) => on(e.target.value)} className={cls} /> : <input value={v} onChange={(e) => on(e.target.value)} className={cls} />}
    </label>
  )
}

/** Streaming Claude draft state for the Draft step. Falls back to the template on any failure. */
function useClaudeDraft(n: RfpNode, f: Intake, files: File[]) {
  const [available, setAvailable] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [note, setNote] = useState('')
  const [section, setSection] = useState('')
  const ac = useRef<AbortController | null>(null)

  useEffect(() => {
    let live = true
    void aiAvailable().then((ok) => live && setAvailable(ok))
    return () => {
      live = false
      ac.current?.abort()
    }
  }, [])

  const start = async () => {
    const prev = text // restored if this attempt produces nothing
    ac.current?.abort()
    const ctl = new AbortController()
    ac.current = ctl
    setStreaming(true)
    setNote('Reading your files…')
    const { texts, skipped } = await readTextFiles(files)
    const used = texts.length ? `Using ${texts.length} file${texts.length === 1 ? '' : 's'}.` : 'No readable files; drafting from your intake only.'
    const skip = skipped.length ? ` Skipped: ${skipped.map((x) => `${x.name} (${x.why})`).join(', ')}.` : ''
    setNote(`Drafting with Claude. ${used}${skip}`)
    setText('')
    const out = await streamDraft({ rfp: projectDraftRfp(n), intake: f, files: texts, section: section || undefined }, setText, { signal: ctl.signal })
    if (ac.current !== ctl) return
    setStreaming(false)
    if (out.ok) setNote(`Draft from Claude. Check every [NEEDS INPUT] and citation before you submit.${skip}`)
    else if (out.reason === 'aborted') setNote(out.text.trim() ? 'Stopped. Partial draft kept.' : prev != null ? 'Stopped. Previous draft kept.' : 'Stopped.')
    else if (out.text.trim()) setNote('Connection lost. Partial draft kept; use the template or redraft.')
    else {
      const kept = prev != null ? 'Previous draft kept.' : 'Showing the template outline.'
      setNote(`${out.reason === 'too_large' ? 'Files too large to send.' : out.reason === 'unavailable' ? 'Claude is not available here.' : "Couldn't reach Claude."} ${kept}`)
      if (out.reason === 'unavailable') setAvailable(false)
    }
    if (!out.ok && !out.text.trim()) setText(prev)
  }
  const stop = () => ac.current?.abort()
  const reset = () => {
    setText(null)
    setNote('')
  }
  return { available, text, streaming, note, section, setSection, start, stop, reset }
}

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * The pre-written sample first draft (no API, no tokens). Reveals progressively so it reads like
 * a draft being written; instant under prefers-reduced-motion.
 */
function useSampleDraft(epin: string | null, f: Intake) {
  const { hasSample } = useSolicitation(epin)
  const [text, setText] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), [])
  const start = async () => {
    if (!epin) return
    const full = await loadSampleDraft(epin, { org: f.org, team: f.team, capabilities: f.capabilities, pastWork: f.pastWork, approach: f.approach })
    if (full == null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setText(full)
    setStreaming(true)
    let i = 0
    const step = Math.ceil(full.length / 90) // ~1.5s at 60 ticks/s
    timer.current = window.setInterval(() => {
      i = Math.min(full.length, i + step)
      setText(full.slice(0, i))
      if (i >= full.length) {
        clearInterval(timer.current!)
        setStreaming(false)
      }
    }, 16)
  }
  return { available: hasSample, text, streaming, start }
}
