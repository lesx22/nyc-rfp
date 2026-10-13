import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { countdown, cx, date, passportUrl, usd } from '../lib/format'
import { useStore } from '../store'
import type { RfpNode } from '../types'

/**
 * Response Studio v0: a guided, local-only intake → outline generator.
 * Phase 3 swaps the template for a Claude-backed agent (see docs/ROADMAP.md):
 * chat, document parsing, requirement extraction from the RFP PDF, and compliance checks.
 */
const STEPS = ['Brief', 'About you', 'Documents', 'Draft', 'Submit'] as const

interface Intake {
  org: string
  team: string
  capabilities: string
  pastWork: string
  mwbe: boolean
  approach: string
}

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
            className="glass flex h-[min(720px,100%)] w-[min(980px,100%)] flex-col overflow-hidden rounded-2xl"
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
  const draft = useMemo(() => outline(n, f, files), [n, f, files])

  return (
    <>
      <header className="flex items-center gap-4 border-b border-line px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-mute">Response studio</div>
          <div className="truncate text-[14px] font-medium">{n.title}</div>
        </div>
        <span className="hidden font-mono text-[11px] text-heat-2 sm:block">{countdown(n.daysLeft)}</span>
        <button aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-mute hover:bg-white/10 hover:text-white">✕</button>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-44 shrink-0 flex-col gap-1 border-r border-line p-3 sm:flex">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)} className={cx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]', i === step ? 'bg-white/10 text-white' : 'text-mute hover:text-white')}>
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
              <div className="rounded-xl border border-line p-4">
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
              <label className="grid h-36 cursor-pointer place-items-center rounded-xl border border-dashed border-white/20 text-[13px] text-mute hover:border-white/40 hover:text-white">
                <span>Drop files or click to upload</span>
                <input type="file" multiple className="hidden" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
              </label>
              <ul className="space-y-1 font-mono text-[12px]">
                {files.map((x, i) => (
                  <li key={i} className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
                    <span className="truncate">{x.name}</span>
                    <span className="text-mute">{Math.ceil(x.size / 1024)} KB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold">Draft outline</h3>
                <button onClick={() => download(`${n.epin ?? n.id}-response.md`, draft)} className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] hover:bg-white/5">Download .md</button>
              </div>
              <pre className="whitespace-pre-wrap rounded-xl border border-line bg-black/50 p-4 font-mono text-[12px] leading-relaxed text-white/80">{draft}</pre>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3 text-[13px] text-white/80">
              <h3 className="text-[17px] font-semibold text-white">Submission checklist</h3>
              {['Proposal narrative follows the RFP section order', 'Price proposal in the required format', 'Doing Business Data Form(s)', 'M/WBE Utilization Plan (or waiver request)', 'Insurance certificates', 'Signed acknowledgement of all addenda', 'Uploaded in PASSPort before the deadline'].map((c) => (
                <label key={c} className="flex items-center gap-2.5 rounded-lg bg-white/[.03] px-3 py-2.5">
                  <input type="checkbox" className="accent-cyan-400" /> {c}
                </label>
              ))}
              <p className="pt-2 text-[12px] text-mute">Submissions happen inside PASSPort. Use this checklist before you upload.</p>
            </div>
          )}
        </main>
      </div>
      <footer className="flex items-center justify-between border-t border-line px-5 py-3">
        <span className="text-[11px] text-mute">Chat with Claude to write sections: coming in Phase 3</span>
        <div className="flex gap-2">
          <button disabled={step === 0} onClick={() => setStep(step - 1)} className="h-9 rounded-lg px-3 text-[13px] text-mute enabled:hover:text-white disabled:opacity-30">Back</button>
          <button onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : onClose())} className="h-9 rounded-lg bg-white px-4 text-[13px] font-medium text-black">{step < STEPS.length - 1 ? 'Continue' : 'Done'}</button>
        </div>
      </footer>
    </>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-2.5">
      <div className="text-[10px] uppercase text-mute">{k}</div>
      <div className="truncate text-white">{v}</div>
    </div>
  )
}

function Field({ label, v, on, area }: { label: string; v: string; on: (v: string) => void; area?: boolean }) {
  const cls = 'w-full rounded-xl border border-line bg-white/[.03] px-3 py-2.5 text-[13px] outline-none focus:border-white/30'
  return (
    <label className="grid gap-1.5 text-[12px] text-mute">
      {label}
      {area ? <textarea rows={3} value={v} onChange={(e) => on(e.target.value)} className={cls} /> : <input value={v} onChange={(e) => on(e.target.value)} className={cls} />}
    </label>
  )
}

function outline(n: RfpNode, f: Intake, files: File[]): string {
  const or = (s: string, ph: string) => s.trim() || `[${ph}]`
  return `# Proposal: ${n.title}
Submitted to: ${n.agency}${n.epin ? `\nEPIN: ${n.epin}` : ''}
Proposer: ${or(f.org, 'Organization name')}
Due: ${date(n.dueDate)}

## 1. Executive summary
${or(f.org, 'We')} proposes to ${or(f.approach, 'describe the core approach in two to three sentences')}.

## 2. Understanding of the need
${n.description ?? '[Restate the agency need in your own words, citing the RFP scope section.]'}

## 3. Proposed approach & work plan
- Discovery & requirements (weeks 1–3)
- Design & prototyping with agency users (weeks 3–8)
- Build, test, accessibility (WCAG 2.2 AA) & security review
- Launch, training, and handoff
[Map each activity to the RFP's scope-of-services items.]

## 4. Organizational capability
Team: ${or(f.team, 'roles, size, key personnel')}
Capabilities: ${or(f.capabilities, 'relevant capabilities')}

## 5. Relevant experience & references
${or(f.pastWork, 'three comparable engagements with outcomes and a reference contact for each')}

## 6. M/WBE participation
${f.mwbe ? 'Proposer is a certified M/WBE.' : '[Utilization plan or waiver request]'}

## 7. Price proposal
[Use the agency's pricing form. Do not include pricing in the narrative unless instructed.]

## Attachments
${files.length ? files.map((x) => `- ${x.name}`).join('\n') : '- [Capability statement, résumés, insurance, forms]'}
`
}

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
