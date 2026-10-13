# Brand kit v0

**Personality:** exploratory, precise, civic and optimistic. It should feel like a night-sky map of the city's economy, not a government form.

## Colour

| Token | Value | Use |
|---|---|---|
| `ink` | `#000000` | Canvas and page background |
| `panel` | `rgb(10 10 12 / .93)` + 18px blur | Glass surfaces |
| `line` | `rgb(255 255 255 / .08)` | Hairlines and dividers |
| `text` / `mute` | `#EDEDEF` / `#8A8F98` | Body text / secondary text |
| **Cool data** | `#22D3EE` cyan · `#60A5FA` sky · `#A78BFA` violet · `#5EEAD4` mint · `#C7D2FE` ice · `#A3E635` lime | Cluster identity (Industry) |
| **Warm heat** | `#FDE68A` → `#FB923C` → `#F43F5E` | Heat only: urgency now, traffic later |

Rule: **warm colours always mean heat.** Never use them to identify a category.

## Type

- **Geist** 300–700 for UI. Headings use −0.01em tracking and 600 weight.
- **Geist Mono** for numbers, EPINs, countdowns and scores.
- Scale: 10 / 11 / 12 / 13 / 14 / 17 / 19 / 22 px. The interface is dense and calm, and never shouts.

## Motion

- Ambient idle orbit at about 2.6°/s that stops on any input and resumes 3.5s after the last interaction.
- Camera flights use CameraControls smoothing (`smoothTime` 0.6s), so there are no linear tweens.
- Panels animate in with a spring (stiffness 380, damping 36).
- "Neural pulses" are light particles travelling root → industry → agency → node. Highlighted nodes receive about 60% of the pulses.
- Everything ambient switches off under `prefers-reduced-motion`.

## Shape

- Radius: 8px for chips, 12px for controls, 16px for panels.
- Hairline borders, and no drop shadows except the cyan glow on the prompt bar.
- Spheres for nodes, an icosahedron for the root, and rings for selection.
