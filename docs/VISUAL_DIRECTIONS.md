# Visual directions

The v0 look (glowing spheres, straight lines, bloom, frosted-glass panels, Geist) reads as generic because it's the default output of the r3f + shadcn stack. Below are three distinct directions. **Pick one as the base.** Elements of the others can come back later as alternate layouts or a marketing mode.

Every direction keeps the product rules: a black ground, cool colours for categories, warm colours only for heat, a reduced-motion fallback, and keyboard alternatives.

---

## A. Transit Authority: procurement as a subway map

*Every industry is a line and every agency is a station. You ride the line to find work.*

- **Layout:** octilinear (45° and 90°) routes on a slightly tilted plane, with an almost-orthographic camera
- **Nodes:** flat station dots (white fill, black ring), "transfer" capsules for agencies that span industries, and circular route bullets with short codes for industries
- **Edges:** thick flat ribbons (MeshLine) with rounded 45° corners. Hovering a line sends a train pulse along it.
- **Atmosphere:** pure black, a faint Manhattan street-grid shader, no bloom, light grain
- **Type and chrome:** Schibsted Grotesk or Hanken Grotesk set tight, white on black sign bands, Barlow Condensed for codes. Panels are hard-edged black slabs with a white rule, like platform signage. Deadlines show on an **arrivals board** (split-flap countdown in heat colours).
- **Signature moment:** on load, the lines ink themselves out from a central hub like a Vignelli map being drawn, then the station names tick in.
- **Performance:** lowest of the three. No bloom or depth of field, so it runs well on phones.
- **Caveat:** MTA route colours are warm, so we borrow the bullet *form* only and keep the cool palette. We use no MTA marks.

## B. Civic Nebula: a living, organic cosmos

*Opportunities condense out of a nebula like stars, and deadlines make them burn.*

- **Nodes:** soft-core "data stars" drawn by a custom shader (crisp at any zoom, one draw call), diffraction spikes on standout listings, and a refractive glass shell on the root only
- **Edges:** hierarchical edge bundling (curved filaments routed through their parent clusters) with particles drifting along the curves
- **Atmosphere:** a GPU curl-noise dust field (64k+ particles) flowing around clusters, depth of field that follows your focus, slight chromatic aberration, and grain
- **Type and chrome:** Instrument Serif or Fraunces for cluster names (editorial rather than techy) and Fragment Mono for data. Minimal floating captions, no cards.
- **Signature moment:** hovering an agency makes the nebula "inhale": dust streams along the filaments into it, and its stars flare warm by deadline.
- **Performance:** highest. It needs a quality tier that drops the dust and depth of field on phones and under reduced motion.

## C. Instrument Panel: a mission-control HUD

*You're an operator scanning the city's procurement spectrum, and every readout is a real number.*

- **Nodes:** hollow rings with tick marks. Ring thickness encodes contract value and dash density encodes data confidence, so inferred data visibly looks less certain. The selected node gets a rotating reticle with corner brackets.
- **Edges:** thin straight lines with a dashed signal travelling root → leaf. Selecting a node fires a one-shot "packet" along its path.
- **Atmosphere:** black, a polar grid on the ground plane, a sweeping radar arc, faint scanlines, little or no bloom
- **Type and chrome:** JetBrains Mono or IBM Plex Mono throughout, with Space Grotesk or Archivo Expanded for headings. Coordinate readouts (sector / agency / EPIN), ruler ticks on panel edges, a crosshair cursor with a live label, and corner-bracket frames instead of glass.
- **Signature moment:** a **radar sweep** rotates around the root, nodes "ping" as it passes them (warm blips for listings closing soon), and the HUD logs each hit. The boot sequence types out like a system check: `LOADING 1,987 RECORDS · 14 SECTORS`.
- **Performance:** low to medium.

---

## Recommendation

**C as the base.** It suits a tool people come back to, and its visual encodings (value, confidence, deadline) carry real information instead of decoration. **A** would come back later as a "Lines" layout toggle using the same morph pipeline, and **B** as the landing or marketing mode.

## Shared technique upgrades (whichever direction wins)

| Upgrade | Technique | Cost |
|---|---|---|
| Crisp nodes at any zoom | SDF point sprites in one `THREE.Points` draw call, with size, colour and heat as attributes | Lower than the current spheres |
| Staggered boot reveal | A per-node `bootDelay` attribute plus `smoothstep(uTime - delay)` in the shader. No per-node React state. | ~0 |
| Animated remaps | Two position attributes and `mix(posA, posB, uProgress)` | ~0 |
| Flowing edges | Per-vertex `t` and `fract(t - time)` in the line shader | ~0 |
| In-scene labels | drei `<Text>` (troika SDF) for clusters only | ~1 draw call per label |
| Live tuning | **leva** (dev-only uniform sliders, export presets) + **r3f-perf** (budget: ≤20 draw calls, <8ms GPU) | Dev only |
| Authored camera/boot | **theatre.js** keyframes, skipped under reduced motion | Small |

## References

- [GitHub globe write-up](https://github.blog/engineering/how-we-built-the-github-globe) · [Stripe globe](https://stripe.com/blog/globe) · [anvaka/map-of-github](https://github.com/anvaka/map-of-github) (2.9k★)
- Maxime Heckel: [particles & shaders in R3F](https://blog.maximeheckel.com/posts/the-magical-world-of-particles-with-react-three-fiber-and-shaders/) · [refraction & dispersion](https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/)
- Codrops [GPGPU particles](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/) · Three.js Journey [flow-field particles](https://threejs-journey.com/lessons/gpgpu-flow-field-particles-shaders), [particle morphing](https://www.threejs-journey.com/lessons/particles-morphing-shader)
- Holten 2006, *Hierarchical Edge Bundles*
- NYCTA Graphics Standards Manual (1970, Vignelli/Noorda): [Parsons history](https://amt.parsons.edu/?p=1393)
- Libraries: [pmndrs/leva](https://github.com/pmndrs/leva) (6.3k★), [utsuboco/r3f-perf](https://github.com/utsuboco/r3f-perf) (781★), [theatre-js/theatre](https://github.com/theatre-js/theatre) (12.8k★), [spite/THREE.MeshLine](https://github.com/spite/THREE.MeshLine) (2.3k★), [protectwise/troika](https://github.com/protectwise/troika) (2.0k★), [THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) (1.3k★). Avoid [pmndrs/lamina](https://github.com/pmndrs/lamina), which is archived.
