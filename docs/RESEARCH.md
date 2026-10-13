# Research: libraries, repos and guidelines

*Data as of 2026-10-13. Star counts come from the GitHub search API. Versions, publish dates and licenses come from the npm registry. npm download counts weren't available (api.npmjs.org is blocked from this sandbox), so none are quoted.*

## Decision summary

| Need | Pick | Runner-up | Avoid / note |
|---|---|---|---|
| 3D engine | **three.js** (116k★) via **@react-three/fiber** (33k★) | Babylon.js (26k★, heavier, weaker React story) | — |
| Helpers | **@react-three/drei** (10k★): CameraControls, Html, Billboard, Sparkles, Instances, Detailed, AdaptiveDpr | — | — |
| Glow | **@react-three/postprocessing** + `postprocessing` (Bloom with mipmapBlur) | three's UnrealBloomPass | — |
| Graph layer | **Custom instanced r3f** (this repo) | **react-force-graph-3d / 3d-force-graph** (6.5k★): fastest demo, `postProcessingComposer()` for bloom | Sigma.js (12k★) and Cosmos are 2D and built for 10k–1M nodes. `@cosmograph/*` is **CC-BY-NC** |
| Layout | Deterministic hierarchical (here) → `d3-force-3d` / `ngraph.forcelayout` in a Web Worker | graphology (+ Louvain communities) | — |
| DOM motion | **motion** (34k★, v14) | GSAP 3.15 (free but not OSI-licensed) | popmotion (stale) |
| Micro-transitions | @formkit/auto-animate | — | — |
| UI kit | **Tailwind v4** + **shadcn/ui** (125k★) + **Radix** | Magic UI / Aceternity (use sparingly) | — |
| Command / prompt | **cmdk**, Vercel **AI Elements** (PromptInput) | assistant-ui (for full chat) | — |
| Type | **Geist / Geist Mono** | Inter | — |
| AI backend | **Vercel AI SDK** (`ai` 7.x) + Claude | Direct Anthropic SDK | — |
| Realtime heat | **Cloudflare Durable Objects (partyserver / partysocket)** | Supabase Realtime Broadcast; Liveblocks (polished, paid) | Yjs (overkill for counters) |
| Cinematic camera | — | Theatre.js | Stale since 2024 |

## Graph and network renderers

| Repo | ★ | npm (latest) | License | Notes |
|---|---|---|---|---|
| [antvis/G6](https://github.com/antvis/G6) | 12.3k | `@antv/g6` 5.1.1 | MIT | Full framework, mostly 2D |
| [jacomyal/sigma.js](https://github.com/jacomyal/sigma.js) | 12.2k | `sigma` 4.0.1 | MIT | Best 2D WebGL for large graphs |
| [cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js) | 11.2k | `cytoscape` 3.34.3 | MIT | Analysis-first, canvas |
| [vasturiano/3d-force-graph](https://github.com/vasturiano/3d-force-graph) | 6.5k | `3d-force-graph` 1.80.1 | MIT | Closest out-of-the-box match to the brief |
| [vasturiano/react-force-graph](https://github.com/vasturiano/react-force-graph) | 3.3k | `react-force-graph-3d` 1.29.2 | MIT | React wrapper |
| [graphology](https://github.com/graphology/graphology) | 1.8k | `graphology` 0.26.0 | MIT | Data model + algorithms |
| [anvaka/ngraph](https://github.com/anvaka/ngraph) | 1.5k | `ngraph.graph` 20.1.2 | BSD-3 | Fast 3D layout |
| [cosmosgl/graph](https://github.com/cosmosgl/graph) | 1.3k | `@cosmos.gl/graph` 3.5.1 | MIT | GPU, 2D, 1M nodes |
| [reaviz/reagraph](https://github.com/reaviz/reagraph) | 1.1k | `reagraph` 4.32.0 | Apache-2.0 | r3f-based, clustering built in |
| [visgl/deck.gl](https://github.com/visgl/deck.gl) | 14.7k | `deck.gl` 9.4.0 | MIT | Use if heat goes on a map |

## Engines and motion

| Repo | ★ | npm (latest) | License |
|---|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | 116.3k | `three` 0.186.1 | MIT |
| [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) | 32.9k | `@react-three/fiber` 9.8.1 | MIT |
| [pmndrs/drei](https://github.com/pmndrs/drei) | 9.9k | `@react-three/drei` 10.7.9 | MIT |
| [pmndrs/react-postprocessing](https://github.com/pmndrs/react-postprocessing) | 1.4k | `@react-three/postprocessing` 3.2.0 | MIT |
| [juliangarnier/anime](https://github.com/juliangarnier/anime) | 73.6k | `animejs` 4.5.0 | MIT |
| [motiondivision/motion](https://github.com/motiondivision/motion) | 34.1k | `motion` 14.2.0 | MIT |
| [greensock/GSAP](https://github.com/greensock/GSAP) | 29.2k | `gsap` 3.15.0 | Standard no-charge (not OSI) |
| [pmndrs/react-spring](https://github.com/pmndrs/react-spring) | 29.2k | `@react-spring/three` 10.1.2 | MIT |
| [rive-app/rive-wasm](https://github.com/rive-app/rive-wasm) | 1.0k | `@rive-app/react-canvas` 4.36.0 | MIT |

## Inspiration

- [anvaka/map-of-github](https://github.com/anvaka/map-of-github) (2.9k★): galaxy-style cluster map, the closest aesthetic reference
- [anvaka/pm](https://github.com/anvaka/pm) (1.8k★): 3D package-manager galaxies
- [tensorflow/playground](https://github.com/tensorflow/playground) (13k★): the classic neural-net visual
- [vasturiano/globe.gl](https://github.com/vasturiano/globe.gl) (3.2k★): GitHub-globe-style data globe
- [pmndrs/react-three-next](https://github.com/pmndrs/react-three-next) (2.9k★): Next.js + r3f + Tailwind starter
- [3d-force-graph examples](https://vasturiano.github.io/3d-force-graph/): bloom-effect, highlight, large-graph

## Vercel Web Interface Guidelines: rules that apply here

From [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines), also available as an agent skill: `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines`.

- **Keyboard first.** Everything is reachable by keyboard and uses `:focus-visible` rings. *(Done for DOM UI; canvas orbit and zoom keys are a Phase 1 task.)*
- **No gesture-only actions.** Drag and pinch need button or keyboard equivalents.
- **Hit targets** are at least 24px on desktop and at least 44px on mobile; use `touch-action: manipulation`.
- **Honor `prefers-reduced-motion`.** Animate only transform and opacity, and never use `transition: all`. *(Done: auto-orbit and pulses are disabled.)*
- **Design every state:** empty, sparse, dense and error.
- **Give icon buttons `aria-label`s**, and use a polite `aria-live` region for async results.
- **Keep interactions under 500ms**, virtualize long lists, and move heavy work to workers.
- **Interactive states are brighter than rest states.** Use layered shadows and APCA contrast.

## Performance practices used in the prototype

- **One draw call for all nodes** (`InstancedMesh`) and **one for all edges** (merged `LineSegments`)
- **Per-frame updates mutate buffers in `useFrame`**; React state changes only on discrete events
- **Bloom picks up only the bright nodes** (`luminanceThreshold` with `toneMapped={false}` materials)
- **The canvas chunk is lazy-loaded**, so the UI shell paints first
- **Still to do:** `AdaptiveDpr`, `PerformanceMonitor`, pause on `visibilitychange`, `frameloop="demand"` when idle with no auto-orbit
