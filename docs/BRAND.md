# Brand kit v1: Instrument Panel

**Concept:** you're an operator scanning the city's procurement spectrum, and every readout is a real number. Chosen from [`VISUAL_DIRECTIONS.md`](./VISUAL_DIRECTIONS.md) (direction C).

## Colour

| Token | Value | Use |
|---|---|---|
| `ink` | `#020405` | Scope background (near-black with a teal bias) |
| `panel` | `rgb(3 8 10 / .9)` | Instrument panels, with no blur |
| `line` | `rgb(120 220 230 / .16)` | Hairlines, frames |
| `phosphor` | `#5CE1E6` | The one accent: primary actions, readouts, corner brackets, codes |
| `text` / `mute` | `#D8EEF0` / `#6B8388` | Body text / labels and secondary readouts |
| **Cool data** | cyan · sky · violet · mint · ice · lime | Sector identity |
| **Warm heat** | `#FDE68A` → `#FB923C` → `#F43F5E` | Heat only: urgency now, traffic later. Radar pings turn warm for listings closing within 14 days. |

## Type

- **JetBrains Mono** for all UI, data and labels (tabular numbers everywhere).
- **Archivo Expanded** (`font-stretch: 125%`) for record titles and the wordmark only.
- **Eyebrows** are 10px uppercase with +0.14em tracking. Numbers are zero-padded (`FIT 081`, `REC 054/054`, `T–31D`).

## Visual encodings (each one is real data)

| Mark | Meaning |
|---|---|
| Hollow ring | One opportunity |
| Ring thickness | Contract value (log scale; thin when unknown) |
| Dashed ring | Inferred or lower-confidence data (5 dashes = low, 10 = medium) |
| Filled core | Matches your prompt |
| Tick-marked large ring | Sector (industry) hub |
| Ring colour | Sector, or the warm urgency ramp when Heat is on |
| Warm radar ping | Closing within ~14 days |

## Chrome

- Square corners (2px), 1px hairline frames, and **phosphor corner brackets** on every panel. Ruler ticks run along the top of the record panel.
- Sector codes (`PIT`, `HCS`, `CON`…) in outlined tags. On phones the labels collapse to code + count.
- Crosshair cursor with a live tag naming what's under it.

## Motion (from the installed `animate` / `emil-design-eng` skills)

- **Easing tokens:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` and `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`. UI transitions stay under 300ms.
- **Delight budget, spent once:** a boot log plus the first radar revolution reveals the network, once per session.
- **Ambient:**
  - Radar sweep about every 11s; nodes ping as it passes.
  - Edge packets travel root → leaf, faster and brighter on matched paths.
  - The camera drifts slowly when idle.
- **Exempt from motion:** data you're reading (panels, lists, numbers) never moves for style.
- **Reduced motion:** turns off the boot, sweep, pings, packets and drift, and makes the camera cuts instant.
