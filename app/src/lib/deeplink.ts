import { useEffect } from 'react'
import { useStore } from '../store'
import type { RfpNode } from '../types'
import { cam } from './camera'

/*
 * Deep links: the selected listing lives in the URL hash as a bare token (#05626P0001).
 * Only unreserved characters are used because the app is also hosted as a claude.ai
 * artifact, where only plain `#token` hashes survive. Hash writes use replaceState so
 * browsing the graph never spams history.
 */

const SAFE = /[^A-Za-z0-9._~-]/g
const TOKEN = /^[A-Za-z0-9._~-]{1,80}$/

/** EPIN when it identifies exactly one listing, else the row id; reduced to unreserved characters. */
export function nodeToken(n: RfpNode, nodes: RfpNode[]): string {
  const epinUnique = n.epin != null && nodes.filter((x) => x.epin === n.epin).length === 1
  return (epinUnique ? n.epin! : n.id).replace(SAFE, '-')
}

export function findByToken(token: string, nodes: RfpNode[]): RfpNode | undefined {
  return nodes.find((n) => nodeToken(n, nodes) === token) ?? nodes.find((n) => n.id === token || n.epin === token)
}

/** Absolute URL for a listing, for "Copy link". */
export function nodeUrl(n: RfpNode, nodes: RfpNode[]): string {
  const u = new URL(location.href)
  u.hash = nodeToken(n, nodes)
  return u.href
}

function readHash(): string | null {
  const raw = location.hash.slice(1)
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function replaceUrl(url: string) {
  if (url === location.pathname + location.search + location.hash) return
  try {
    history.replaceState(history.state, '', url)
  } catch {
    /* sandboxed frames may refuse; the link just won't update */
  }
}

function writeHash() {
  const { selected, nodes } = useStore.getState()
  const n = selected?.kind === 'node' ? nodes.find((x) => x.id === selected.id) : undefined
  const base = location.pathname + location.search
  if (n) replaceUrl(`${base}#${nodeToken(n, nodes)}`)
  else if (location.hash) replaceUrl(base)
}

/**
 * Select the listing named by the current hash. Unknown or malformed hashes are cleared
 * with a polite notice instead of erroring.
 */
function applyHash(): boolean {
  const tok = readHash()
  const s = useStore.getState()
  if (!tok) return false
  const n = TOKEN.test(tok) ? findByToken(tok, s.nodes) : undefined
  if (!n) {
    replaceUrl(location.pathname + location.search)
    s.notify('That listing is not in this dataset')
    return false
  }
  if (s.selected?.kind !== 'node' || s.selected.id !== n.id) s.select({ kind: 'node', id: n.id })
  return true
}

/** Wire hash ⇄ selection. Mount once (App). */
export function useDeepLink() {
  const loaded = useStore((s) => s.nodes.length > 0)

  // Selection → hash.
  useEffect(() => useStore.subscribe((s, prev) => s.selected !== prev.selected && writeHash()), [])

  // Hand-edited hash → selection.
  useEffect(() => {
    const h = () => useStore.getState().nodes.length && applyHash()
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  // Initial hash → selection, once data loads. Wait until the camera rig has mounted and
  // run its own framing effects (home / "for you" rotation), so the fly-to lands last.
  // Timers, not rAF: a slow GPU must not delay the panel. Falls back after ~4s so the panel
  // still opens if WebGL never starts.
  useEffect(() => {
    if (!loaded || !readHash()) return
    const startSel = useStore.getState().selected
    const t0 = performance.now()
    let settled = 0
    const id = setInterval(() => {
      if (useStore.getState().selected !== startSel) return clearInterval(id) // user already picked something
      if (cam.controls || performance.now() - t0 > 4000) settled++
      if (settled >= 3) {
        clearInterval(id)
        applyHash()
      }
    }, 50)
    return () => clearInterval(id)
  }, [loaded])
}
