import * as THREE from 'three'

/**
 * Shared GPU state for the Instrument Panel look. One uniforms object is referenced by every
 * HUD material, so the sweep, boot reveal and depth fade stay in lock-step for free.
 * Shader comments avoid backticks on purpose (they would end the template literal).
 */
export const U = {
  uTime: { value: 0 },
  uSweep: { value: -Math.PI }, // radar beam azimuth, radians (atan(z, x) convention)
  uBoot: { value: 7 }, // revealed arc in radians, 0..2pi during boot; >= 2pi means fully revealed
  uMotion: { value: 1 }, // 0 under prefers-reduced-motion: no pings, no packets
  uScale: { value: 800 }, // pixels per world unit at distance 1 (set from viewport each frame)
  uFogNear: { value: 200 },
  uFogFar: { value: 600 },
  uRadius: { value: 200 }, // radar disk radius, world units
}

const COMMON_VERT = /* glsl */ `
  uniform float uSweep, uBoot, uMotion, uFogNear, uFogFar;
  varying float vPing, vReveal, vFog;
  void hudCommon(vec3 world, vec4 mv) {
    float az = atan(world.z, world.x);
    float since = mod(uSweep - az, 6.2831853);
    vPing = uMotion * exp(-since * 2.6);
    vReveal = step(az + 3.1415927, uBoot);
    vFog = 1.0 - smoothstep(uFogNear, uFogFar, -mv.z);
  }
`

/** Hollow SDF ring sprites. Thickness = value, dashes = data confidence, core dot = match. */
export function makeRingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uScale;
      attribute vec3 aColor;
      attribute float aSize, aThick, aDash, aHeat, aAlpha, aFill;
      varying vec3 vColor;
      varying float vThick, vDash, vHeat, vAlpha, vFill;
      ${COMMON_VERT}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
        hudCommon(position, mv);
        vColor = aColor; vThick = aThick; vDash = aDash; vHeat = aHeat; vAlpha = aAlpha; vFill = aFill;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vThick, vDash, vHeat, vAlpha, vFill, vPing, vReveal, vFog;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float aa = fwidth(r) * 1.2;
        float ring = (1.0 - smoothstep(1.0 - aa, 1.0, r)) * smoothstep(1.0 - vThick - aa, 1.0 - vThick, r);
        if (vDash > 0.5) {
          float seg = fract(atan(p.y, p.x) / 6.2831853 * vDash);
          ring *= smoothstep(0.32, 0.36, seg);
        }
        float core = vFill * (1.0 - smoothstep(0.30 - aa, 0.30, r));
        float flash = vPing * (1.0 - r) * 0.45;
        vec3 pingColor = vHeat > 0.6 ? vec3(1.0, 0.55, 0.25) : vec3(0.85, 0.95, 1.0);
        vec3 col = mix(vColor, pingColor, clamp(vPing * (vHeat > 0.6 ? 1.0 : 0.55), 0.0, 1.0));
        float a = max(max(ring, core), flash) * vAlpha * vReveal * vFog;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
  })
}

/** Thin edges with "packets" travelling root to leaf. aSignal boosts packets on matched paths. */
export function makeEdgeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec3 aColor;
      attribute float aT, aSeed, aSignal;
      varying vec3 vColor;
      varying float vT, vSeed, vSignal;
      ${COMMON_VERT}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        hudCommon(position, mv);
        vColor = aColor; vT = aT; vSeed = aSeed; vSignal = aSignal;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uMotion;
      varying vec3 vColor;
      varying float vT, vSeed, vSignal, vPing, vReveal, vFog;
      void main() {
        float d = fract(vT - uTime * (0.25 + vSignal * 0.35) + vSeed);
        float packet = uMotion * smoothstep(0.0, 0.02, d) * (1.0 - smoothstep(0.02, 0.09, d));
        float base = 0.16 + vSignal * 0.22;
        float a = (base + packet * (0.25 + vSignal * 0.9)) * vReveal * vFog;
        gl_FragColor = vec4(vColor * (1.0 + packet * vSignal), a);
      }
    `,
  })
}

/** Ground-plane radar: rotating wedge with a hard leading edge, fading toward the rim. */
export function makeRadarMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uSweep, uMotion;
      uniform float uRadius;
      varying vec3 vWorld;
      void main() {
        float r = length(vWorld.xz) / uRadius;
        if (r > 1.0) discard;
        float since = mod(uSweep - atan(vWorld.z, vWorld.x), 6.2831853);
        float wedge = exp(-since * 5.0) * 0.22 + (1.0 - smoothstep(0.0, 0.012, since)) * 0.5;
        float a = wedge * uMotion * (1.0 - smoothstep(0.75, 1.0, r)) * smoothstep(0.02, 0.1, r);
        gl_FragColor = vec4(vec3(0.36, 0.88, 0.9), a);
      }
    `,
  })
}
