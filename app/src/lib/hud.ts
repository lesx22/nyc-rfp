import * as THREE from 'three'

/**
 * Shared GPU state for the graph. One uniforms object is referenced by every material,
 * so focus dimming and depth fade stay in lock-step for free.
 * Shader comments avoid backticks on purpose (they would end the template literal).
 */
export const U = {
  uTime: { value: 0 },
  uMotion: { value: 1 }, // 0 under prefers-reduced-motion
  uScale: { value: 800 }, // pixels per world unit at distance 1 (set from viewport each frame)
  uFogNear: { value: 200 },
  uFogFar: { value: 600 },
  uFocus: { value: new THREE.Vector3() }, // camera target: what the viewer is looking at
  uFocusNear: { value: 40 }, // full brightness inside this radius of the focus point
  uFocusFar: { value: 160 }, // dimmest beyond this radius
  uFocusFloor: { value: 0.32 }, // edges + labels: brightness of the most out-of-focus things (1 = no dimming)
  uOpacityNear: { value: 0.75 }, // dots: opacity in focus
  uOpacityFar: { value: 0.1 }, // dots: opacity at the far edge of focus
  uTargetDepth: { value: 170 }, // camera-to-target distance; things deeper than this recede further
}

/**
 * Depth gap between the closest and farthest spheres: opacity range plus how fast it falls off
 * (focus radii as fractions of camera distance). Dev-only review switch: ?gap=v05|wide|wider|widest
 */
export const GAPS = {
  v05: { near: 0.75, far: 0.1, r0: 0.32, r1: 1.05 },
  wide: { near: 0.9, far: 0.06, r0: 0.3, r1: 0.95 },
  wider: { near: 0.95, far: 0.04, r0: 0.25, r1: 0.8 },
  widest: { near: 1.0, far: 0.025, r0: 0.2, r1: 0.65 },
} as const
export const gap: { r0: number; r1: number } = { r0: GAPS.wider.r0, r1: GAPS.wider.r1 }
function applyGap(g: (typeof GAPS)[keyof typeof GAPS]) {
  U.uOpacityNear.value = g.near
  U.uOpacityFar.value = g.far
  gap.r0 = g.r0
  gap.r1 = g.r1
}
applyGap(GAPS.wider)
try {
  const g = new URLSearchParams(location.search).get('gap') as keyof typeof GAPS | null
  if (g && g in GAPS) applyGap(GAPS[g])
} catch {
  /* no location (tests): keep default */
}

/** Dev-only look tuning for side-by-side reviews: ?focus=off|subtle|medium|strong */
export const FOCUS_LEVELS = { off: 1, subtle: 0.55, medium: 0.32, strong: 0.16 } as const
try {
  const f = new URLSearchParams(location.search).get('focus') as keyof typeof FOCUS_LEVELS | null
  if (f && f in FOCUS_LEVELS) U.uFocusFloor.value = FOCUS_LEVELS[f]
} catch {
  /* no location (tests): keep default */
}

/** Soft depth of focus: things far from the point you're looking at recede. */
const COMMON_VERT = /* glsl */ `
  uniform float uFogNear, uFogFar, uFocusNear, uFocusFar, uFocusFloor, uTargetDepth;
  uniform vec3 uFocus;
  varying float vDim, vFocus, vFog;
  void applyFocus(vec3 world, vec4 mv) {
    // Two cues combined: distance from the point you're looking at, and being behind it.
    float behind = smoothstep(0.0, uTargetDepth * 0.7, -mv.z - uTargetDepth);
    vFocus = (1.0 - smoothstep(uFocusNear, uFocusFar, distance(world, uFocus))) * (1.0 - 0.6 * behind);
    vFog = 1.0 - smoothstep(uFogNear, uFogFar, -mv.z);
    vDim = mix(uFocusFloor, 1.0, vFocus) * vFog;
  }
`

/**
 * Sphere impostors: each point sprite is shaded as a lit ball (normal rebuilt from the sprite
 * coordinate), so 2,000 spheres still cost one draw call. Opacity ramps with focus:
 * uOpacityNear in focus, uOpacityFar at the edge. Matches get a faint halo.
 */
export function makeDotMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uScale;
      attribute vec3 aColor;
      attribute float aSize, aAlpha, aHalo;
      varying vec3 vColor;
      varying float vAlpha, vHalo;
      ${COMMON_VERT}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // Sprite is 1.6x the sphere so a halo fits around matches.
        gl_PointSize = aSize * 1.6 * uScale / max(-mv.z, 0.1);
        applyFocus(position, mv);
        vColor = aColor; vAlpha = aAlpha; vHalo = aHalo;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacityNear, uOpacityFar;
      varying vec3 vColor;
      varying float vAlpha, vHalo, vFocus, vFog;
      void main() {
        vec2 q = (gl_PointCoord * 2.0 - 1.0) * 1.6;
        q.y = -q.y;
        float r = length(q);
        if (r > 1.6) discard;
        float aa = fwidth(r) * 1.2;
        float disc = 1.0 - smoothstep(1.0 - aa, 1.0, r);
        // Rebuild the sphere normal and light it from the upper left.
        vec3 n = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))));
        vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
        float diffuse = max(dot(n, L), 0.0);
        float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
        float rim = pow(1.0 - n.z, 2.0);
        vec3 col = vColor * (0.3 + 0.85 * diffuse) + vec3(spec * 0.35) + vColor * rim * 0.2;
        // Halo starts just inside the rim so the shaded edge blends into it instead of outlining.
        float halo = vHalo * smoothstep(0.85, 1.0, r) * (1.0 - smoothstep(1.0, 1.6, r)) * 0.28;
        float opacity = mix(uOpacityFar, uOpacityNear, vFocus) * vFog;
        float a = max(disc * opacity, halo * vFocus) * vAlpha;
        if (a < 0.005) discard;
        gl_FragColor = vec4(mix(col, vColor * 0.8, halo / max(a, 0.001) * (1.0 - disc * 0.6)), a);
      }
    `,
  })
}

/** Thin edges. Only paths to your matches carry a slow signal. */
export function makeEdgeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aT, aSeed, aSignal;
      varying vec3 vColor;
      varying float vT, vSeed, vSignal;
      ${COMMON_VERT}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        applyFocus(position, mv);
        vColor = aColor; vT = aT; vSeed = aSeed; vSignal = aSignal;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uMotion;
      varying vec3 vColor;
      varying float vT, vSeed, vSignal, vDim;
      void main() {
        float d = fract(vT - uTime * 0.3 + vSeed);
        float packet = vSignal * uMotion * smoothstep(0.0, 0.03, d) * (1.0 - smoothstep(0.03, 0.12, d));
        float a = (0.12 + vSignal * 0.18 + packet * 0.6) * vDim;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  })
}
