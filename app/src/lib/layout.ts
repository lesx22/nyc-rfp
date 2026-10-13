import type { Cluster, GroupKey, RfpNode } from '../types'

export type Vec3 = [number, number, number]

/** Cool palette for level-1 clusters. Warm colours are reserved for heat. */
export const COOL = ['#22d3ee', '#60a5fa', '#a78bfa', '#5eead4', '#c7d2fe', '#a3e635', '#38bdf8', '#818cf8', '#2dd4bf', '#e0e7ff']

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

/** Evenly spread n points on a sphere (golden-angle spiral). */
function fibonacci(n: number, i: number, r: number, seed = 0): Vec3 {
  if (n === 1) return [0, 0, 0]
  const y = 1 - ((i + 0.5) / n) * 2
  const rad = Math.sqrt(1 - y * y)
  const th = Math.PI * (3 - Math.sqrt(5)) * i + seed * Math.PI * 2
  return [Math.cos(th) * rad * r, y * r * 0.72, Math.sin(th) * rad * r]
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]) || 1

const keyOf = (n: RfpNode, k: GroupKey) => (n[k] as string | null) || 'Unspecified'

export interface Layout {
  clusters: Cluster[]
  clusterPos: Map<string, Vec3>
  clusterColor: Map<string, string>
  nodePos: Map<string, Vec3>
  nodeColor: Map<string, string>
  nodeCluster: Map<string, string> // rfp id -> level-2 cluster id
  edges: [string, string][] // ids: 'root' | cluster ids | rfp ids
}

/**
 * Hierarchical "neural" layout: root → L1 (e.g. industry) → L2 (e.g. agency) → RFP.
 * Deterministic (hash-seeded) so the graph is stable between visits and remaps animate cleanly.
 */
export function buildLayout(nodes: RfpNode[], l1: GroupKey, l2: GroupKey): Layout {
  const tree = new Map<string, Map<string, RfpNode[]>>()
  for (const n of nodes) {
    const a = keyOf(n, l1), b = keyOf(n, l2)
    if (!tree.has(a)) tree.set(a, new Map())
    const sub = tree.get(a)!
    if (!sub.has(b)) sub.set(b, [])
    sub.get(b)!.push(n)
  }
  const l1Keys = [...tree.keys()].sort((a, b) => count(tree.get(b)!) - count(tree.get(a)!))

  const clusters: Cluster[] = []
  const clusterPos = new Map<string, Vec3>()
  const clusterColor = new Map<string, string>()
  const nodePos = new Map<string, Vec3>()
  const nodeColor = new Map<string, string>()
  const nodeCluster = new Map<string, string>()
  const edges: [string, string][] = []

  const R1 = 34 + l1Keys.length * 2.5
  l1Keys.forEach((a, i) => {
    const id1 = `1:${a}`
    const p1 = fibonacci(l1Keys.length, i, R1, 0.1)
    const color = COOL[i % COOL.length]
    const sub = tree.get(a)!
    const members1: string[] = []
    clusterPos.set(id1, p1)
    clusterColor.set(id1, color)
    edges.push(['root', id1])

    const l2Keys = [...sub.keys()].sort((x, y) => sub.get(y)!.length - sub.get(x)!.length)
    const R2 = 7 + Math.sqrt(l2Keys.length) * 4.5
    const out = scale(p1, 1 / len(p1))
    l2Keys.forEach((b, j) => {
      const id2 = `2:${a}/${b}`
      const p2 = add(add(p1, fibonacci(l2Keys.length, j, R2, hash(a))), scale(out, R2 * 0.55))
      const list = sub.get(b)!
      clusterPos.set(id2, p2)
      clusterColor.set(id2, color)
      edges.push([id1, id2])
      const R3 = 2.2 + Math.sqrt(list.length) * 1.3
      list.forEach((n, k) => {
        const jitter: Vec3 = [(hash(n.id + 'x') - 0.5) * 1.2, (hash(n.id + 'y') - 0.5) * 1.2, (hash(n.id + 'z') - 0.5) * 1.2]
        nodePos.set(n.id, add(add(p2, fibonacci(list.length, k, R3, hash(b))), jitter))
        nodeColor.set(n.id, color)
        nodeCluster.set(n.id, id2)
        edges.push([id2, n.id])
        members1.push(n.id)
      })
      clusters.push({ id: id2, level: 2, label: b, parent: id1, members: list.map((n) => n.id) })
    })
    clusters.push({ id: id1, level: 1, label: a, parent: null, members: members1 })
  })
  return { clusters, clusterPos, clusterColor, nodePos, nodeColor, nodeCluster, edges }
}

function count(m: Map<string, RfpNode[]>) {
  let c = 0
  for (const v of m.values()) c += v.length
  return c
}

/** Warm ramp for heat (urgency today, page-view traffic later). t ∈ [0,1]. */
export function heatColor(t: number): string {
  const stops = [
    [253, 230, 138],
    [251, 146, 60],
    [244, 63, 94],
  ]
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  const f = x - i
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
