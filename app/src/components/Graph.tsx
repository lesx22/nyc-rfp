import { AdaptiveDpr, Billboard, CameraControls, Html, PerformanceMonitor, Sparkles } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cam } from '../lib/camera'
import * as THREE from 'three'
import { buildLayout, heatColor, type Layout, type Vec3 } from '../lib/layout'
import { passesFilters, useStore } from '../store'

const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Live (animated) positions shared between nodes, hubs, edges and pulses. */
type Live = Map<string, THREE.Vector3>

export default function Graph() {
  const [bloom, setBloom] = useState(true)
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
      camera={{ position: [0, 30, 170], fov: 42, near: 0.1, far: 2000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => useStore.getState().select(null)}
    >
      <color attach="background" args={['#000']} />
      <fog attach="fog" args={['#000', 160, 420]} />
      {/* Drop resolution, then bloom, on weak GPUs instead of stuttering. */}
      <PerformanceMonitor onDecline={() => setBloom(false)} onIncline={() => setBloom(true)} flipflops={3} />
      <AdaptiveDpr pixelated={false} />
      <Scene />
      {bloom && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.15} luminanceSmoothing={0.2} intensity={1.15} />
          <Vignette eskil={false} offset={0.2} darkness={0.85} />
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

  return (
    <>
      <Rig layout={layout} />
      <Sparkles count={reducedMotion ? 0 : 260} scale={[420, 260, 420]} size={1.4} speed={0.15} opacity={0.35} color="#9fb4ff" />
      <RootHub />
      {layout.clusters.map((c) => (
        <Hub key={c.id} id={c.id} target={layout.clusterPos.get(c.id)!} color={layout.clusterColor.get(c.id)!} level={c.level} label={c.label} count={c.members.length} live={live} />
      ))}
      <Nodes layout={layout} live={live} />
      <Edges layout={layout} live={live} />
      {!reducedMotion && <Pulses layout={layout} live={live} />}
      <SelectionRing live={live} />
    </>
  )
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
    const mark = () => cam.touch()
    c.addEventListener('controlstart', mark)
    c.addEventListener('control', mark)
    return () => {
      c.removeEventListener('controlstart', mark)
      c.removeEventListener('control', mark)
    }
  }, [])

  // Fly to a selected cluster/node.
  useEffect(() => {
    const c = ref.current
    if (!c || !selected) return
    const p = selected.kind === 'cluster' ? layout.clusterPos.get(selected.id) : layout.nodePos.get(selected.id)
    if (!p) return
    const t = new THREE.Vector3(...p)
    const dist = selected.kind === 'cluster' ? (selected.id.startsWith('1:') ? 75 : 40) : 38
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
    const eye = ctr.clone().add(dir.multiplyScalar(110)).add(new THREE.Vector3(0, 18, 0))
    const look = ctr.clone().multiplyScalar(0.6)
    c.setLookAt(eye.x, eye.y, eye.z, look.x, look.y, look.z, true)
    cam.touch()
  }, [focusNonce, layout])

  // Idle drift: the "cover state" slowly orbits until the user grabs it.
  useFrame((_, dt) => {
    const c = ref.current
    if (!c || reducedMotion) return
    if (useStore.getState().selected) return
    if (performance.now() - cam.lastInput > 3500) c.azimuthAngle += dt * 0.045
  })

  return <CameraControls ref={ref} makeDefault minDistance={6} maxDistance={420} smoothTime={0.6} draggingSmoothTime={0.12} dollySpeed={0.6} />
}

/* ---------------- hubs ---------------- */

function RootHub() {
  const m = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (m.current) m.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.4) * 0.06)
  })
  return (
    <mesh ref={m}>
      <icosahedronGeometry args={[2.4, 3]} />
      <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(1.6)} toneMapped={false} />
    </mesh>
  )
}

function Hub({ id, target, color, level, label, count, live }: { id: string; target: Vec3; color: string; level: 1 | 2; label: string; count: number; live: Live }) {
  const m = useRef<THREE.Mesh>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const select = useStore((s) => s.select)
  const selected = useStore((s) => s.selected)
  const hovered = useStore((s) => s.hovered)
  const hover = useStore((s) => s.hover)
  const tgt = useMemo(() => new THREE.Vector3(...target), [target])
  const base = level === 1 ? 1.6 + Math.sqrt(count) * 0.22 : 0.7 + Math.sqrt(count) * 0.16
  const col = useMemo(() => new THREE.Color(color).multiplyScalar(level === 1 ? 1.5 : 1.1), [color, level])

  useEffect(() => {
    if (!live.has(id)) live.set(id, new THREE.Vector3())
    return () => void live.delete(id)
  }, [id, live])

  useFrame(({ camera }, dt) => {
    const v = live.get(id)
    if (!v || !m.current) return
    if (labelRef.current) {
      // Fade labels as the camera closes in so they never balloon over the scene.
      const d = camera.position.distanceTo(v)
      const near = level === 1 ? 55 : 14
      labelRef.current.style.opacity = String(Math.max(0, Math.min(1, (d - near) / (near * 0.8))))
    }
    v.lerp(tgt, 1 - Math.exp(-dt * 3))
    m.current.position.copy(v)
    const s = hovered === id || selected?.id === id ? 1.35 : 1
    m.current.scale.lerp(new THREE.Vector3(s, s, s), 0.15)
  })

  const parentSelected = selected?.kind === 'cluster' && (selected.id === id || (level === 2 && id.startsWith(selected.id.replace(/^1:/, '2:') + '/')))
  const showLabel = level === 1 || hovered === id || parentSelected

  return (
    <mesh
      ref={m}
      onClick={(e: ThreeEvent<MouseEvent>) => (e.stopPropagation(), select({ kind: 'cluster', id }))}
      onPointerOver={(e) => (e.stopPropagation(), hover(id), (document.body.style.cursor = 'pointer'))}
      onPointerOut={() => (hover(null), (document.body.style.cursor = ''))}
    >
      <sphereGeometry args={[base, 24, 24]} />
      <meshBasicMaterial color={col} toneMapped={false} transparent opacity={level === 1 ? 0.95 : 0.8} />
      {showLabel && (
        <Html center distanceFactor={level === 1 ? 110 : 60} position={[0, base + (level === 1 ? 3 : 1.6), 0]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div ref={labelRef} className={`whitespace-nowrap transition-opacity font-medium tracking-tight ${level === 1 ? 'text-[22px] text-white' : 'text-[15px] text-white/75'}`} style={{ textShadow: '0 0 12px rgba(0,0,0,.9)' }}>
            {label}
            <span className="ml-1.5 font-mono text-[0.7em] text-white/40">{count}</span>
          </div>
        </Html>
      )}
    </mesh>
  )
}

/* ---------------- RFP nodes (instanced) ---------------- */

const DIM = new THREE.Color('#1c1f26')
function Nodes({ layout, live }: { layout: Layout; live: Live }) {
  const nodes = useStore((s) => s.nodes)
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  const scales = useMemo(() => new Float32Array(nodes.length).fill(0), [nodes])

  useEffect(() => {
    nodes.forEach((n) => {
      if (!live.has(n.id)) live.set(n.id, new THREE.Vector3())
    })
  }, [nodes, live])

  useFrame(({ clock }, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const { filters, relevance, hovered, selected, heat } = useStore.getState()
    const hasQ = relevance.size > 0
    const k = 1 - Math.exp(-dt * 2.6)
    const t = clock.elapsedTime
    nodes.forEach((n, i) => {
      const v = live.get(n.id)
      const p = layout.nodePos.get(n.id)
      if (!v || !p) return
      v.x += (p[0] - v.x) * k
      v.y += (p[1] - v.y) * k
      v.z += (p[2] - v.z) * k
      const on = passesFilters(n, filters)
      const rel = relevance.get(n.id) ?? 0
      const hot = hasQ && rel > 0.55
      let s = 0.45 + (n.aiFit / 100) * 0.55
      if (!on) s *= 0.35
      if (hot) s *= 1.55 + Math.sin(t * 3 + i) * 0.12
      if (hovered === n.id || selected?.id === n.id) s *= 1.3
      scales[i] += (s - scales[i]) * 0.18
      tmp.position.copy(v)
      tmp.scale.setScalar(scales[i])
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)

      if (heat && n.daysLeft != null && n.daysLeft >= 0) col.set(heatColor(1 - Math.min(n.daysLeft, 45) / 45))
      else col.set(layout.nodeColor.get(n.id) ?? '#fff')
      if (!on) col.copy(DIM)
      else if (hasQ) col.multiplyScalar(hot ? 2.2 : 0.28)
      else col.multiplyScalar(1.15)
      mesh.setColorAt(i, col)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.instanceId != null) useStore.getState().select({ kind: 'node', id: nodes[e.instanceId].id })
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.instanceId == null) return
    const id = nodes[e.instanceId].id
    if (useStore.getState().hovered !== id) useStore.getState().hover(id)
    document.body.style.cursor = 'pointer'
  }

  return (
    <instancedMesh key={nodes.length} ref={ref} args={[undefined, undefined, nodes.length]} onClick={onClick} onPointerMove={onMove} onPointerOut={() => (useStore.getState().hover(null), (document.body.style.cursor = ''))}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

/* ---------------- edges ---------------- */

function Edges({ layout, live }: { layout: Layout; live: Live }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(layout.edges.length * 6), 3))
    const c = new Float32Array(layout.edges.length * 6)
    layout.edges.forEach(([a, b], i) => {
      const color = new THREE.Color(layout.clusterColor.get(b) ?? layout.nodeColor.get(b) ?? '#fff')
      const fade = b.startsWith('1:') ? 0.55 : b.startsWith('2:') ? 0.4 : 0.22
      const ca = a === 'root' ? new THREE.Color('#fff').multiplyScalar(0.4) : color.clone().multiplyScalar(fade)
      ca.toArray(c, i * 6)
      color.clone().multiplyScalar(fade).toArray(c, i * 6 + 3)
    })
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    return g
  }, [layout])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame(() => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    layout.edges.forEach(([a, b], i) => {
      const va = live.get(a), vb = live.get(b)
      if (va) va.toArray(arr, i * 6)
      if (vb) vb.toArray(arr, i * 6 + 3)
    })
    pos.needsUpdate = true
  })

  return (
    <lineSegments geometry={geo} raycast={() => null}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>
  )
}

/* ---------------- neural pulses ---------------- */

/** Signals travel root → L1 → L2 → node. Highlighted nodes get dedicated signals; the rest is ambient chatter. */
function Pulses({ layout, live }: { layout: Layout; live: Live }) {
  const N = 90
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    return g
  }, [])
  const state = useRef(Array.from({ length: N }, () => ({ path: [] as string[], t: Math.random() * 3, speed: 0.6 + Math.random() * 0.7 })))
  const leafIds = useMemo(() => [...layout.nodeCluster.keys()], [layout])

  const pathTo = (leaf: string) => {
    const l2 = layout.nodeCluster.get(leaf)
    const l1 = l2 ? '1:' + l2.slice(2).split('/')[0] : undefined
    return ['root', l1, l2, leaf].filter(Boolean) as string[]
  }

  useFrame((_, dt) => {
    const arr = (geo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    const rel = useStore.getState().relevance
    const hot = [...rel.entries()].filter(([, v]) => v > 0.55).map(([k]) => k)
    state.current.forEach((p, i) => {
      p.t += dt * p.speed
      if (!p.path.length || p.t >= p.path.length - 1) {
        const pool = hot.length && i < N * 0.6 ? hot : leafIds
        p.path = pool.length ? pathTo(pool[(Math.random() * pool.length) | 0]) : []
        p.t = 0
      }
      const seg = Math.floor(p.t)
      const a = live.get(p.path[seg]), b = live.get(p.path[seg + 1])
      if (a && b) {
        const f = p.t - seg
        arr[i * 3] = a.x + (b.x - a.x) * f
        arr[i * 3 + 1] = a.y + (b.y - a.y) * f
        arr[i * 3 + 2] = a.z + (b.z - a.z) * f
      }
    })
    geo.getAttribute('position').needsUpdate = true
  })

  return (
    <points geometry={geo} raycast={() => null}>
      <pointsMaterial size={0.9} color={new THREE.Color('#e0f2fe').multiplyScalar(2.2)} toneMapped={false} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  )
}

/* ---------------- selection ---------------- */

function SelectionRing({ live }: { live: Live }) {
  const g = useRef<THREE.Group>(null)
  const selected = useStore((s) => s.selected)
  useFrame(({ clock }) => {
    if (!g.current || !selected) return
    const v = live.get(selected.id)
    if (v) g.current.position.copy(v)
    g.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.08)
  })
  if (!selected || selected.kind !== 'node') return null
  return (
    <group ref={g}>
      <Billboard>
        <mesh raycast={() => null}>
          <ringGeometry args={[1.9, 2.05, 64]} />
          <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(2)} toneMapped={false} transparent opacity={0.9} />
        </mesh>
      </Billboard>
    </group>
  )
}
