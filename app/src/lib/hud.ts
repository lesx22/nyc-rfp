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
  uFocusFloor: { value: 0.32 }, // brightness of the most out-of-focus things (1 = no dimming)
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
  uniform float uFogNear, uFogFar, uFocusNear, uFocusFar, uFocusFloor;
  uniform vec3 uFocus;
  varying float vDim;
  void applyFocus(vec3 world, vec4 mv) {
    float focus = 1.0 - smoothstep(uFocusNear, uFocusFar, distance(world, uFocus));
    float fog = 1.0 - smoothstep(uFogNear, uFogFar, -mv.z);
    vDim = mix(uFocusFloor, 1.0, focus) * fog;
  }
`

/** Filled dots with a soft edge. Matches get a faint halo. */
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
        // Sprite is 1.6x the dot so a halo fits around matches.
        gl_PointSize = aSize * 1.6 * uScale / max(-mv.z, 0.1);
        applyFocus(position, mv);
        vColor = aColor; vAlpha = aAlpha; vHalo = aHalo;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha, vHalo, vDim;
      void main() {
        float r = length(gl_PointCoord * 2.0 - 1.0) * 1.6;
        if (r > 1.6) discard;
        float aa = fwidth(r) * 1.2;
        float dot = 1.0 - smoothstep(1.0 - aa, 1.0, r);
        float halo = vHalo * (1.0 - smoothstep(1.0, 1.6, r)) * 0.35;
        vec3 col = mix(vColor, vec3(1.0), (1.0 - r) * 0.18);
        float a = max(dot, halo) * vAlpha * vDim;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
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
