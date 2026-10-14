#!/usr/bin/env python3
"""Generate the HyperFrames composition (index.html) from the shot table below.

Times are seconds on the voice-over clock (see ../BEATS.md). Each intro shot is a slice
of one of the user's screen recordings: src, media start, playback rate, and a camera move
(scale and transform-origin, from -> to). Run: python3 build.py && npx hyperframes check
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
# Cues are written on the ORIGINAL voice-over clock (BEATS.md); vo-map.json (from ../vo_edit.py) maps
# them onto the tightened VO. A time inside a removed span lands where speech resumes.
_map = json.loads((HERE.parent / "vo-map.json").read_text())["anchors"] if (HERE.parent / "vo-map.json").exists() else None


def remap(t):
    """[original-clock, new-clock] anchors from vo-map.json; linear between them, slope 1 outside, never below 0."""
    if not _map:
        return t
    if t <= _map[0][0]:
        return max(0.0, _map[0][1] + t - _map[0][0])
    for (a0, n0), (a1, n1) in zip(_map, _map[1:]):
        if t <= a1:
            return n0 + (t - a0) * (n1 - n0) / (a1 - a0)
    a, n = _map[-1]
    return n + t - a


DUR = round(remap(71.5), 2)  # app capture runs to (old) VO 71.5
APP_AT = round(remap(21.2), 2)  # beat 6: the app capture, which opens from black
XF = 0.3  # crossfade between intro shots
EASE = "sine.inOut"

# id, old start, old end, src, media_start, rate, (scale0, scale1), origin0, origin1
SHOTS = [
    # 2 "New York City posts all of its contract opportunities on PASSPort": the grid, rows scroll past
    ("grid", 4.6, 8.2, "r1", 0.0, 1.0, (1.0, 1.1), "0% 40%", "0% 70%"),
    # 3 "If you're a small business building software, … a lot of manual work": quick cuts
    ("filter-open", 8.2, 10.2, "r1", 5.6, 1.0, (1.45, 1.6), "0% 48%", "0% 50%"),
    ("filter-pick", 10.2, 11.7, "r1", 8.0, 1.0, (1.6, 1.6), "0% 50%", "0% 52%"),
    ("docs", 11.7, 13.2, "r2", 9.0, 1.0, (1.4, 1.5), "0% 75%", "0% 80%"),
    ("filtered", 13.2, 14.2, "r1", 10.5, 1.0, (1.3, 1.35), "0% 45%", "0% 45%"),
    # 4 "Then I was pleasantly surprised to find this listing."
    ("search", 14.2, 16.2, "r2", 1.3, 1.0, (1.55, 1.6), "0% 30%", "0% 32%"),
    ("result", 16.2, 18.1, "r2", 2.9, 0.75, (1.55, 1.75), "15% 58%", "18% 60%"),
    # 5 "The city was actually asking for help rebuilding PASSPort itself."
    ("title", 18.1, 19.8, "r2", 5.0, 0.55, (1.55, 1.7), "27% 0%", "27% 0%"),
    ("about", 19.8, 20.99, "r2", 8.0, 0.5, (1.45, 1.55), "8% 30%", "8% 30%"),
]

# On-screen clicks in the recordings, as (shot start on the old clock, seconds into the shot): the
# recordings play at their own speed, so a click stays at its offset however the shot is retimed.
REC_CLICKS = [(8.2, 0.4), (10.2, 0.3), (14.2, 1.0), (16.2, 1.27)]
CLICKS = [remap(a) + off for a, off in REC_CLICKS]
# App-section clicks (old VO clock), from the app capture's cue table; the capture is retimed the same way.
cues_file = HERE / "app-clicks.json"
if cues_file.exists():
    CLICKS += [remap(t) for t in json.loads(cues_file.read_text())]

clips, tweens = [], []
for i, (sid, a, b, src, ms, rate, (s0, s1), o0, o1) in enumerate(SHOTS):
    t, d = round(remap(a), 3), round(remap(b) - remap(a), 3)
    lead = XF if i else 0.0  # each shot starts early and fades in over the one before it
    t0, d0, m0 = round(t - lead, 3), round(d + lead, 3), round(max(0.0, ms - lead * rate), 3)
    clips.append(
        f'      <div class="shot" id="{sid}-wrap"><div class="inner" id="{sid}-inner">'
        f'<video id="{sid}" class="clip" src="assets/rec/{src}.mp4" muted playsinline '
        f'data-start="{t0}" data-duration="{d0}" data-media-start="{m0}" data-playback-rate="{rate}" '
        f'data-track-index="{i % 2}"></video></div></div>'
    )
    tweens.append(
        f'tl.fromTo("#{sid}-inner", {{ scale: {s0}, transformOrigin: "{o0}" }}, '
        f'{{ scale: {s1}, transformOrigin: "{o1}", duration: {d0}, ease: "{EASE}" }}, {t0});'
    )
    if lead:
        tweens.append(f'tl.fromTo("#{sid}-wrap", {{ opacity: 0 }}, {{ opacity: 1, duration: {XF}, ease: "sine.out" }}, {t0});')
    if i == len(SHOTS) - 1:  # dip to black into the app, which opens from black
        tweens.append(f'tl.to("#{sid}-wrap", {{ opacity: 0, duration: 0.25, ease: "sine.in" }}, {round(t + d - 0.25, 3)});')

sfx = "\n".join(
    f'      <audio id="click-{i}" src="assets/sfx/click.ogg" data-start="{t:.2f}" data-duration="0.2" data-volume="0.35" data-track-index="5"></audio>'
    for i, t in enumerate(CLICKS)
)

VO_LEN = json.loads((HERE.parent / "vo-map.json").read_text())["length"] if _map else 71.0
html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Opportunity Graph walkthrough</title>
    <script src="assets/gsap.min.js"></script>
    <style>
      body {{ margin: 0; background: #05070a; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: #05070a; }}
      .shot, .inner {{ position: absolute; inset: 0; }}
      .inner {{ will-change: transform; }}
      video {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 0% 50%; }}
      #app-wrap {{ position: absolute; inset: 0; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="{DUR}">
{chr(10).join(clips)}
      <div id="app-wrap"><video id="app" class="clip" src="assets/app.mp4" muted playsinline data-start="{APP_AT}" data-duration="{DUR - APP_AT:.1f}" data-media-start="0" data-track-index="1"></video></div>
      <audio id="vo" src="assets/vo.mp3" data-start="0" data-duration="{VO_LEN}" data-volume="1" data-track-index="3"></audio>
{sfx}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      {chr(10) + '      '.join(tweens)}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""
pathlib.Path(__file__).with_name("index.html").write_text(html)
print(f"wrote index.html: {len(SHOTS)} intro shots, {len(CLICKS)} clicks, app at {APP_AT}s")
