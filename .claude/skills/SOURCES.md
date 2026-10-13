# Installed skills: provenance

All skills were **reviewed before install** (they run with full agent permissions) and copied from the commit below. Update with `npx skills update`, or re-copy, after reviewing the diff.

| Skill(s) | Source | Commit | License | Why it's here |
|---|---|---|---|---|
| find-skills | [vercel-labs/skills](https://github.com/vercel-labs/skills) (34k★) | 13e4063 | MIT | Discover more skills (`npx skills find`; needs skills.sh network access) |
| web-design-guidelines | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (32k★) | 063bee9 | MIT | UI/a11y audit. **Modified:** rules pinned locally in GUIDELINES.md (from vercel-labs/web-interface-guidelines @ 434b7f9) instead of fetched live |
| frontend-design | [anthropics/skills](https://github.com/anthropics/skills) (181k★) | dbd4588 | Apache-2.0 | Distinctive visual direction, type, tokens |
| emil-design-eng, animate, review-animations, animation-performance, prototype, break-ui | [emilkowalski/skills](https://github.com/emilkowalski/skills) (46k★) | 2d22863 | MIT | Motion craft, animation review, perf budget, live variant picker, worst-case data tests |
| r3f-shaders, r3f-geometry, r3f-postprocessing, r3f-animation, r3f-interaction | [EnzeD/r3f-skills](https://github.com/EnzeD/r3f-skills) (129★) | 4a11805 | MIT | React Three Fiber: custom shaders, instancing/points/lines, post FX, useFrame motion, picking |

Considered and skipped: greensock/gsap-skills (16k★, we use `motion`, not GSAP), CloudAI-X/threejs-skills (3.6k★, vanilla three, overlaps the r3f pack), scottstts/Threejs-Awesome-Graphics (900★, aimed at planets, oceans and games), ComposioHQ/awesome-claude-skills (mostly SaaS automation).
