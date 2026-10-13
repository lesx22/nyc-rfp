import { AdaptiveDpr, Billboard, CameraControls, Html, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Noise, Scanline, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { cam } from '../lib/camera'
import { codeFor } from '../lib/codes'
import { U, makeEdgeMaterial, makeRadarMaterial, makeRingMaterial } from '../lib/hud'
import { buildLayout, heatColor, type Layout, type Vec3 } from '../lib/layout'
import { passesFilters, useStore } from '../store'

const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const BOOT_SECONDS = 2.4
const SWEEP_SPEED = 0.55 // rad/s, about one revolution every 11s

/** Live (animated) positions shared between nodes, hubs, edges and the reticle. */
type Live = Map<string, THREE.Vector3>

export default function Graph() {
  const [post, setPost] = useState(true)
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const h = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [])
  return (
    <Canvas
      frameloop={visible ? 'always' : 'never'}
      aria-label="3D map of open NYC procurement opportunities. Use the zoom buttons or arrow keys to navigate."
      role="img"
      style={{ cursor: 'crosshair' }}
      camera={{ position: [0, 30, 170], fov: 42, near: 0.1, far: 4000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      raycaster={{ params: { Points: { threshold: 0.9 } } as THREE.Raycaster['params'] }}
      onPointerMissed={() => useStore.getState().select(null)}
    >
      <color attach="background" args={['#020405']} />
      {/* Drop resolution, then post effects, on weak GPUs instead of stuttering. */}
      <PerformanceMonitor onDecline={() => setPost(false)} onIncline={() => setPost(true)} flipflops={3} />
      <AdaptiveDpr pixelated={false} />
      <Scene />
      {post && (
        <EffectComposer multisampling={0}>
          <Scanline blendFunction={BlendFunction.OVERLAY} density={1.4} opacity={0.08} />
          <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.035} />
          <Vignette eskil={false} offset={0.25} darkness={0.8} />
        </EffectComposer>
      )}
    </Canvas>
  )
}

function Scene() {
  const nodes = useStore((s) => s.nodes)
  const l1 = useStore((s) => s.l1)
  const l2 = useStore((s) => s.l2)
  const layout = useMemo(() => buildLayout(nodes, l1, l2), [nodes, l1, l2])
  const live = useMemo<Live>(() => new Map([['root', new THREE.Vector3()]]), [])
  const radius = useMemo(() => {
    let r = 0
    for (const p of layout.clusterPos.values()) r = Math.max(r, Math.hypot(p[0], p[2]))
    return r
  }, [layout])

  return (
    <>
      <Clock ready={nodes.length > 0} radius={radius} />
      <Rig layout={layout} />
      <Ground radius={radius} />
      <Edges layout={layout} live={live} />
      <Hubs layout={layout} live={live} />
      <Nodes layout={layout} live={live} />
      <Reticle live={live} />
    </>
  )
}

/* ---------------- global clock: sweep, boot reveal, point scale, depth fade ---------------- */

function bootSeen() {
  try {
    return sessionStorage.getItem('og.booted') === '1'
  } catch {
    return false
  }
}

function Clock({ ready, radius }: { ready: boolean; radius: number }) {
  const start = useRef<number | null>(null)
  const { size, camera, gl } = useThree()
  useEffect(() => {
    U.uMotion.value = reducedMotion ? 0 : 1
    if (ready && start.current == null) {
      start.current = performance.now()
      if (reducedMotion || bootSeen()) U.uBoot.value = 7
      else {
        U.uBoot.value = 0
        try {
          sessionStorage.setItem('og.booted', '1')
        } catch {
          /* private mode: boot again next time, that's fine */
        }
      }
    }
  }, [ready])

  useFrame((_, dt) => {
    U.uTime.value += dt
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 42
    U.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((fov * Math.PI) / 360))
    U.uFogNear.value = cam.homeDist * 1.05
    U.uFogFar.value = cam.homeDist * 2.8
    U.uRadius.value = radius * 1.35
    if (reducedMotion) return
    if (U.uBoot.value < 7 && start.current != null) {
      // Boot: the first revolution of the sweep reveals the network.
      const p = Math.min(1, (performance.now() - start.current) / 1000 / BOOT_SECONDS)
      U.uBoot.value = p >= 1 ? 7 : p * Math.PI * 2
      U.uSweep.value = -Math.PI + p * Math.PI * 2
    } else {
      U.uSweep.value += dt * SWEEP_SPEED
    }
  })
  return null
}

/* ---------------- camera ---------------- */

function Rig({ layout }: { layout: Layout }) {
  const ref = useRef<CameraControls>(null)
  const selected = useStore((s) => s.selected)
  const focusNonce = useStore((s) => s.focusNonce)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    cam.controls = c
    cam.home()
    const mark = () => cam.touch()
    c.addEventListener('controlstart', mark)
    c.addEventListener('control', mark)
    return () => {
      c.removeEventListener('controlstart', mark)
      c.removeEventListener('control', mark)
    }
  }, [])

  // Frame the whole network whenever the layout changes size.
  useEffect(() => {
    let r = 0
    for (const p of layout.clusterPos.values()) r = Math.max(r, Math.hypot(...p))
    // Portrait screens need more distance to fit the same width.
    const aspect = window.innerWidth / Math.max(1, window.innerHeight)
    cam.homeDist = Math.max(120, r * 2.3) * (aspect < 1 ? Math.pow(1 / aspect, 0.75) : 1)
    if (!useStore.getState().selected) cam.home()
  }, [layout])

  // Fly to a selected cluster/node.
  useEffect(() => {
    const c = ref.current
    if (!c || !selected) return
    const p = selected.kind === 'cluster' ? layout.clusterPos.get(selected.id) : layout.nodePos.get(selected.id)
    if (!p) return
    const t = new THREE.Vector3(...p)
    const dist = selected.kind === 'cluster' ? (selected.id.startsWith('1:') ? 75 : 40) : 48
    const now = new THREE.Vector3()
    c.getPosition(now)
    const dir = now.sub(t).normalize()
    const eye = t.clone().add(dir.multiplyScalar(dist))
    c.setLookAt(eye.x, eye.y, eye.z, t.x, t.y, t.z, true)
    cam.touch()
  }, [selected, layout])

  // Rotate the network so the strongest matches face the viewer (prompt bar / "for you").
  useEffect(() => {
    const c = ref.current
    const { relevance } = useStore.getState()
    if (!c || !relevance.size) return
    const top = [...relevance.entries()].filter(([, v]) => v > 0.55).map(([id]) => layout.nodePos.get(id)).filter(Boolean) as Vec3[]
    if (!top.length) return
    const ctr = top.reduce((a, p) => a.add(new THREE.Vector3(...p)), new THREE.Vector3()).divideScalar(top.length)
    const dir = ctr.clone().setY(ctr.y * 0.4).normalize()
    if (dir.lengthSq() === 0) dir.set(0, 0, 1)
    const eye = ctr.clone().add(dir.multiplyScalar(cam.homeDist * 0.7)).add(new THREE.Vector3(0, cam.homeDist * 0.12, 0))
    const look = ctr.clone().multiplyScalar(0.6)
    c.setLookAt(eye.x, eye.y, eye.z, look.x, look.y, look.z, true)
    cam.touch()
  }, [focusNonce, layout])

  // Idle drift: the cover state slowly orbits until the user grabs it.
  useFrame((_, dt) => {
    const c = ref.current
    if (!c || reducedMotion) return
    if (useStore.getState().selected) return
    if (performance.now() - cam.lastInput > 3500) c.azimuthAngle += dt * 0.03
  })

  return <CameraControls ref={ref} makeDefault minDistance={6} maxDistance={1400} smoothTime={0.6} draggingSmoothTime={0.12} dollySpeed={0.6} />
}

/* ---------------- ground: polar grid + radar sweep ---------------- */

function Ground({ radius }: { radius: number }) {
  const R = radius * 1.35
  const y = -radius * 0.62
  const grid = useMemo(() => {
    const g = new THREE.PolarGridHelper(R, 12, 6, 96, '#1d3a40', '#0f1f23')
    const m = g.material as THREE.LineBasicMaterial
    m.transparent = true
    m.opacity = 0.75
    m.depthWrite = false
    return g
  }, [R])
  useEffect(() => () => grid.dispose(), [grid])
  const radar = useMemo(makeRadarMaterial, [])
  return (
    <group position={[0, y, 0]}>
      <primitive object={grid} raycast={() => null} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} material={radar}>
        <circleGeometry args={[R, 128]} />
      </mesh>
    </group>
  )
}

/* ---------------- shared ring-sprite buffer helper ---------------- */

function useRingBuffers(count: number) {
  return useMemo(() => {
    const g = new THREE.BufferGeometry()
    const attr = (name: string, size: number) => {
      const a = new THREE.BufferAttribute(new Float32Array(count * size), size)
      a.setUsage(THREE.DynamicDrawUsage)
      g.setAttribute(name, a)
      return a.array as Float32Array
    }
    const buf = {
      g,
      pos: attr('position', 3),
      color: attr('aColor', 3),
      size: attr('aSize', 1),
      thick: attr('aThick', 1),
      dash: attr('aDash', 1),
      heat: attr('aHeat', 1),
      alpha: attr('aAlpha', 1),
      fill: attr('aFill', 1),
      flush() {
        for (const k of Object.keys(g.attributes)) g.attributes[k].needsUpdate = true
      },
    }
    // Frustum culling uses a stale bounding sphere for animated points; skip it (cheap at this size).
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return buf
  }, [count])
}

/* ---------------- cluster hubs (industry + agency) ---------------- */

function Hubs({ layout, live }: { layout: Layout; live: Live }) {
  const { clusters } = layout
  const n = clusters.length + 1 // + root
  const buf = useRingBuffers(n)
  const mat = useMemo(makeRingMaterial, [])
  const col = useMemo(() => new THREE.Color(), [])
  const sizes = useMemo(() => new Float32Array(n).fill(0), [n])

  useEffect(() => {
    clusters.forEach((c) => live.set(c.id, live.get(c.id) ?? new THREE.Vector3()))
    return () => clusters.forEach((c) => live.delete(c.id))
  }, [clusters, live])
  useEffect(() => () => buf.g.dispose(), [buf])

  useFrame((_, dt) => {
    const { hovered, selected } = useStore.getState()
    const k = 1 - Math.exp(-dt * 3)
    clusters.forEach((c, i) => {
      const v = live.get(c.id)
      const p = layout.clusterPos.get(c.id)
      if (!v || !p) return
      v.x += (p[0] - v.x) * k
      v.y += (p[1] - v.y) * k
      v.z += (p[2] - v.z) * k
      const target = (c.level === 1 ? 5 + Math.sqrt(c.members.length) * 0.55 : 2.2 + Math.sqrt(c.members.length) * 0.22) * (hovered === c.id || selected?.id === c.id ? 1.3 : 1)
      sizes[i] += (target - sizes[i]) * 0.15
      v.toArray(buf.pos, i * 3)
      col.set(layout.clusterColor.get(c.id)!).toArray(buf.color, i * 3)
      buf.size[i] = sizes[i]
      buf.thick[i] = c.level === 1 ? 0.07 : 0.16
      buf.dash[i] = c.level === 1 ? 48 : 0 // fine tick ring marks a sector
      buf.heat[i] = 0
      buf.alpha[i] = c.level === 1 ? 0.95 : 0.7
      buf.fill[i] = 0
    })
    // Root: a small solid white beacon.
    const r = clusters.length
    buf.pos.set([0, 0, 0], r * 3)
    buf.color.set([1, 1, 1], r * 3)
    buf.size[r] = 4.5
    buf.thick[r] = 0.12
    buf.dash[r] = 0
    buf.heat[r] = 0
    buf.alpha[r] = 1
    buf.fill[r] = 1
    buf.g.setDrawRange(0, n)
    buf.flush()
  })

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.index != null ? clusters[e.index]?.id : undefined)
  return (
    <>
      <points
        geometry={buf.g}
        material={mat}
        onClick={(e) => {
          e.stopPropagation()
          const id = pick(e)
          if (id) useStore.getState().select({ kind: 'cluster', id })
        }}
        onPointerMove={(e) => {
          e.stopPropagation()
          const id = pick(e)
          if (id && useStore.getState().hovered !== id) useStore.getState().hover(id)
        }}
        onPointerOut={() => useStore.getState().hover(null)}
      />
      <Labels layout={layout} live={live} />
    </>
  )
}

/** Sector labels always; agency labels when hovered or when their sector is selected. */
function Labels({ layout, live }: { layout: Layout; live: Live }) {
  const hovered = useStore((s) => s.hovered)
  const selected = useStore((s) => s.selected)
  const l1 = useStore((s) => s.l1)
  const l2 = useStore((s) => s.l2)
  const sel = selected?.kind === 'cluster' ? selected.id : null
  const selParent = sel ? layout.clusters.find((x) => x.id === sel)?.parent : null
  const shown = layout.clusters.filter((c) => c.level === 1 || c.id === hovered || c.id === sel || (sel && (c.parent === sel || c.parent === selParent)))
  return (
    <>
      {shown.map((c) => (
        <Label key={c.id} id={c.id} level={c.level} code={codeFor(c.level === 1 ? l1 : l2, c.label)} text={c.label} count={c.members.length} lift={c.level === 1 ? 5.5 : 2.6} live={live} />
      ))}
    </>
  )
}

function Label({ id, level, code, text, count, lift, live }: { id: string; level: 1 | 2; code: string; text: string; count: number; lift: number; live: Live }) {
  const g = useRef<THREE.Group>(null)
  const el = useRef<HTMLDivElement>(null)
  useFrame(({ camera }) => {
    const v = live.get(id)
    if (!v || !g.current) return
    g.current.position.set(v.x, v.y + lift, v.z)
    if (el.current) {
      // Fade labels as the camera closes in, and keep them hidden until the boot sweep reveals their sector.
      const d = camera.position.distanceTo(v)
      const near = level === 1 ? 55 : 14
      const az = Math.atan2(v.z, v.x) + Math.PI
      const revealed = U.uBoot.value >= az ? 1 : 0
      el.current.style.opacity = String(revealed * Math.max(0, Math.min(1, (d - near) / (near * 0.8))))
    }
  })
  return (
    <group ref={g}>
      <Html center distanceFactor={level === 1 ? 120 : 70} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div ref={el} className={`hud-label ${level === 1 ? 'hud-label-l1' : 'hud-label-l2'}`}>
          <span className="hud-code">{code}</span>
          <span className="hud-name">{text}</span>
          <span className="hud-count">{String(count).padStart(2, '0')}</span>
        </div>
      </Html>
    </group>
  )
}

/* ---------------- opportunities ---------------- */

function Nodes({ layout, live }: { layout: Layout; live: Live }) {
  const nodes = useStore((s) => s.nodes)
  const buf = useRingBuffers(nodes.length)
  const mat = useMemo(makeRingMaterial, [])
  const col = useMemo(() => new THREE.Color(), [])
  const sizes = useMemo(() => new Float32Array(nodes.length).fill(0), [nodes])
  // Value scale for ring thickness: log-normalised over the values we actually have.
  const valueRange = useMemo(() => {
    const v = nodes.map((n) => n.estValueUSD).filter((x): x is number => x != null && x > 0).map(Math.log10)
    return v.length ? [Math.min(...v), Math.max(...v)] : null
  }, [nodes])

  useEffect(() => {
    nodes.forEach((n) => live.set(n.id, live.get(n.id) ?? new THREE.Vector3()))
  }, [nodes, live])
  useEffect(() => () => buf.g.dispose(), [buf])

  useFrame((_, dt) => {
    const { filters, relevance, hovered, selected, heat } = useStore.getState()
    const hasQ = relevance.size > 0
    const density = Math.min(1, Math.pow(150 / Math.max(nodes.length, 1), 0.3))
    const k = 1 - Math.exp(-dt * 2.6)
    nodes.forEach((n, i) => {
      const v = live.get(n.id)
      const p = layout.nodePos.get(n.id)
      if (!v || !p) return
      v.x += (p[0] - v.x) * k
      v.y += (p[1] - v.y) * k
      v.z += (p[2] - v.z) * k
      v.toArray(buf.pos, i * 3)

      const on = passesFilters(n, filters)
      const hot = hasQ && (relevance.get(n.id) ?? 0) > 0.55
      let s = (1.3 + (n.aiFit / 100) * 1.5) * density
      if (!on) s *= 0.6
      if (hot) s *= 1.3
      if (hovered === n.id || selected?.id === n.id) s *= 1.5
      sizes[i] += (s - sizes[i]) * 0.18
      buf.size[i] = sizes[i]

      const urgency = n.daysLeft != null && n.daysLeft >= 0 ? 1 - Math.min(n.daysLeft, 45) / 45 : 0
      if (heat && urgency > 0) col.set(heatColor(urgency))
      else col.set(layout.nodeColor.get(n.id) ?? '#fff')
      col.toArray(buf.color, i * 3)

      buf.thick[i] = valueRange && n.estValueUSD ? 0.12 + 0.3 * ((Math.log10(n.estValueUSD) - valueRange[0]) / Math.max(1e-6, valueRange[1] - valueRange[0])) : 0.14
      const uncertain = n.confidence !== 'high' || n.industryInferred
      buf.dash[i] = !uncertain ? 0 : n.confidence === 'low' ? 5 : 10
      buf.heat[i] = urgency
      buf.alpha[i] = !on ? 0.12 : hasQ && !hot ? 0.35 : 0.95
      buf.fill[i] = hot ? 1 : 0
    })
    buf.flush()
  })

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.index != null ? nodes[e.index]?.id : undefined)
  return (
    <points
      key={nodes.length}
      geometry={buf.g}
      material={mat}
      onClick={(e) => {
        e.stopPropagation()
        const id = pick(e)
        if (id) useStore.getState().select({ kind: 'node', id })
      }}
      onPointerMove={(e) => {
        e.stopPropagation()
        const id = pick(e)
        if (id && useStore.getState().hovered !== id) useStore.getState().hover(id)
      }}
      onPointerOut={() => useStore.getState().hover(null)}
    />
  )
}

/* ---------------- edges with signal packets ---------------- */

function Edges({ layout, live }: { layout: Layout; live: Live }) {
  const mat = useMemo(makeEdgeMaterial, [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = layout.edges.length
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aSignal', new THREE.BufferAttribute(new Float32Array(n * 2), 1).setUsage(THREE.DynamicDrawUsage))
    const color = new Float32Array(n * 6)
    const t = new Float32Array(n * 2)
    const seed = new Float32Array(n * 2)
    layout.edges.forEach(([a, b], i) => {
      const c = new THREE.Color(layout.clusterColor.get(b) ?? layout.nodeColor.get(b) ?? '#fff')
      const fade = b.startsWith('1:') ? 0.7 : b.startsWith('2:') ? 0.55 : 0.4
      ;(a === 'root' ? new THREE.Color('#9fb3b8').multiplyScalar(0.6) : c.clone().multiplyScalar(fade)).toArray(color, i * 6)
      c.clone().multiplyScalar(fade).toArray(color, i * 6 + 3)
      t[i * 2] = 0
      t[i * 2 + 1] = 1
      seed[i * 2] = seed[i * 2 + 1] = (i * 0.6180339) % 1
    })
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
  }, [layout])
  useEffect(() => () => geo.dispose(), [geo])

  // Matched nodes and their ancestors get stronger, faster packets.
  const hotPaths = useRef<{ rel: Map<string, number> | null; ids: Set<string> }>({ rel: null, ids: new Set() })

  useFrame(() => {
    const rel = useStore.getState().relevance
    if (hotPaths.current.rel !== rel) {
      const ids = new Set<string>()
      for (const [id, v] of rel) {
        if (v <= 0.55) continue
        ids.add(id)
        const l2 = layout.nodeCluster.get(id)
        if (l2) {
          ids.add(l2)
          ids.add(layout.clusters.find((c) => c.id === l2)?.parent ?? '')
        }
      }
      hotPaths.current = { rel, ids }
    }
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const sig = geo.getAttribute('aSignal') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const s = sig.array as Float32Array
    layout.edges.forEach(([a, b], i) => {
      const va = live.get(a), vb = live.get(b)
      if (va) va.toArray(arr, i * 6)
      if (vb) vb.toArray(arr, i * 6 + 3)
      s[i * 2] = s[i * 2 + 1] = hotPaths.current.ids.has(b) ? 1 : 0
    })
    pos.needsUpdate = true
    sig.needsUpdate = true
  })

  return <lineSegments geometry={geo} material={mat} raycast={() => null} />
}

/* ---------------- selection reticle ---------------- */

const BRACKETS = (() => {
  // Four corner brackets of a unit square, as line segments.
  const s = 1, l = 0.38
  const pts: number[] = []
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    pts.push(x * s, y * s, 0, x * s - x * l, y * s, 0, x * s, y * s, 0, x * s, y * s - y * l, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return g
})()

function Reticle({ live }: { live: Live }) {
  const g = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const selected = useStore((s) => s.selected)
  useFrame(({ clock }) => {
    if (!g.current || !selected) return
    const v = live.get(selected.id)
    if (v) g.current.position.copy(v)
    if (spin.current && !reducedMotion) spin.current.rotation.z = clock.elapsedTime * 0.6
  })
  if (!selected) return null
  const size = selected.kind === 'node' ? 2.2 : selected.id.startsWith('1:') ? 7 : 3.5
  return (
    <group ref={g}>
      <Billboard>
        <group ref={spin} scale={size}>
          <lineSegments geometry={BRACKETS} raycast={() => null}>
            <lineBasicMaterial color="#e6fbff" transparent opacity={0.95} depthTest={false} />
          </lineSegments>
        </group>
      </Billboard>
    </group>
  )
}
