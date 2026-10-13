#!/usr/bin/env python3
"""Tighten the voice-over: drop lines and shrink long pauses, then write the edited audio and a time map.

  python3 video/vo_edit.py            # -> video/out/vo-edit.wav, video/vo-map.json

Times are on the ORIGINAL voice-over clock (BEATS.md, capture.mjs CUES). vo-map.json lists the
kept segments as [old_start, old_end, new_start]; capture.mjs and hf/build.py map their cues through it,
so every cut lands in the picture as well. A time inside a removed span maps to where the next kept
segment starts.
"""
import json
import pathlib
import re
import subprocess

HERE = pathlib.Path(__file__).parent
SRC = HERE / "out" / "voiceover.mp3"
END = 71.0

# Lines removed (original clock), cut inside the surrounding pauses.
CUT_LINES = [
    (0.0, 4.60),  # "Hey, I've had this idea for a long time and never got around to it."
    (20.99, 24.55),  # "So on a Tuesday night, in between cooking dinner and cleaning up," -> "I started prototyping."
    (59.15, 64.50),  # "and a script pulls the newest opportunities … every night, so it stays current. Essentially,"
]
PAUSE_KEEP = 0.24  # long pauses shrink to this


def pauses():
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(SRC), "-af", "silencedetect=n=-35dB:d=0.3", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    s = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    e = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    return list(zip(s, e))


def main():
    cuts = list(CUT_LINES)
    for s, e in pauses():
        if e - s > PAUSE_KEEP + 0.04 and not any(a <= s and e <= b for a, b in cuts) and e < END:
            trim = (e - s - PAUSE_KEEP) / 2
            cuts.append((s + trim, e - trim))
    cuts.sort()
    keep, t = [], 0.0
    for a, b in cuts:
        if a > t:
            keep.append([t, a])
        t = max(t, b)
    if t < END:
        keep.append([t, END])
    segs, new = [], 0.0
    for a, b in keep:
        segs.append([round(a, 3), round(b, 3), round(new, 3)])
        new += b - a
    (HERE / "vo-map.json").write_text(json.dumps({"segments": segs, "length": round(new, 3)}, indent=1))
    # 8 ms fades at every join so cuts never click.
    parts = "".join(
        f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st={b - a - 0.008:.3f}:d=0.008[s{i}];"
        for i, (a, b, _) in enumerate(segs)
    )
    graph = parts + "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1[out]"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-filter_complex", graph, "-map", "[out]", str(HERE / "out" / "vo-edit.wav")],
        check=True,
    )
    print(f"{len(segs)} segments, {END:.1f}s -> {new:.1f}s")


if __name__ == "__main__":
    main()
