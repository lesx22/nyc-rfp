#!/usr/bin/env python3
"""Generate the HyperFrames composition (index.html) from the shot table below.

Times are seconds on the voice-over clock (see ../BEATS.md). Each intro shot is a slice
of one of the user's screen recordings: src, media start, playback rate, and a camera move
(scale and transform-origin, from -> to). Run: python3 build.py && npx hyperframes check
"""
import json
import pathlib

DUR = 71.5  # app capture runs to VO 71.5
APP_AT = 21.2  # beat 6: hard cut into the app capture

# id, start, dur, src, media_start, rate, (scale0, scale1), origin0, origin1
SHOTS = [
    # 1 "Hey, I've had this idea…": the PASSPort grid, slow push
    ("grid-hold", 0.0, 4.4, "r1", 4.5, 0.25, (1.0, 1.12), "0% 60%", "0% 60%"),
    # 2 "…posts all of its contract opportunities on PASSPort": rows scroll past
    ("grid-scroll", 4.4, 3.8, "r1", 0.4, 1.0, (1.08, 1.14), "0% 50%", "0% 60%"),
    # 3 "…a lot of manual work": quick cuts
    ("filter-open", 8.2, 2.0, "r1", 5.6, 1.0, (1.6, 1.75), "0% 48%", "0% 52%"),
    ("filter-pick", 10.2, 1.5, "r1", 8.0, 1.0, (1.65, 1.65), "0% 55%", "0% 50%"),
    ("docs", 11.7, 1.5, "r2", 9.0, 1.0, (1.45, 1.55), "0% 75%", "0% 80%"),
    ("filtered", 13.2, 1.0, "r1", 10.5, 1.0, (1.3, 1.35), "0% 45%", "0% 45%"),
    # 4 "Then I was pleasantly surprised to find this listing."
    ("search", 14.2, 2.0, "r2", 0.8, 1.0, (1.6, 1.6), "0% 30%", "0% 30%"),
    ("result", 16.2, 1.0, "r2", 2.9, 1.0, (1.6, 1.7), "20% 60%", "20% 60%"),
    # 5 "The city was actually asking for help rebuilding PASSPort itself."
    ("open", 17.2, 0.9, "r2", 3.4, 1.0, (1.6, 1.7), "20% 60%", "20% 60%"),
    ("title", 18.1, 1.7, "r2", 5.0, 0.55, (1.6, 1.7), "27% 0%", "27% 0%"),
    ("about", 19.8, 1.4, "r2", 8.0, 0.5, (1.5, 1.6), "8% 30%", "8% 30%"),
]

# On-screen clicks in the recordings (VO clock), for UI click SFX.
CLICKS = [8.6, 10.5, 15.6, 17.75]
# App-section clicks (VO clock) come from the app capture's cue table, if present.
cues_file = pathlib.Path(__file__).with_name("app-clicks.json")
if cues_file.exists():
    CLICKS += json.loads(cues_file.read_text())

clips, tweens = [], []
for i, (sid, t, d, src, ms, rate, (s0, s1), o0, o1) in enumerate(SHOTS):
    clips.append(
        f'      <div class="shot" id="{sid}-wrap"><div class="inner" id="{sid}-inner">'
        f'<video id="{sid}" class="clip" src="assets/rec/{src}.mp4" muted playsinline '
        f'data-start="{t}" data-duration="{d}" data-media-start="{ms}" data-playback-rate="{rate}" '
        f'data-track-index="0"></video></div></div>'
    )
    tweens.append(
        f'tl.fromTo("#{sid}-inner", {{ scale: {s0}, transformOrigin: "{o0}" }}, '
        f'{{ scale: {s1}, transformOrigin: "{o1}", duration: {d}, ease: "none" }}, {t});'
    )

sfx = "\n".join(
    f'      <audio id="click-{i}" src="assets/sfx/click.ogg" data-start="{t:.2f}" data-duration="0.2" data-volume="0.35" data-track-index="5"></audio>'
    for i, t in enumerate(CLICKS)
)

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
      <audio id="vo" src="assets/vo.mp3" data-start="0" data-duration="71.0" data-volume="1" data-track-index="3"></audio>
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
