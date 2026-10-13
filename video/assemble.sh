#!/usr/bin/env bash
# Join the intro (VO 0–21.2) + app footage (VO 21.2–71.5) and mix in the voice-over. Captions ship as captions.srt.
#   bash video/assemble.sh [path/to/voiceover.(wav|mp3|m4a)]
# The intro is out/film-a.mp4 (placeholder title scenes) unless INTRO=path/to/cut.mp4 is given: the
# edited PASSPort screen recordings for beats 1–5, 21.2s, 1920×1080, 30fps.
set -euo pipefail
VO="${1:+$(realpath "$1")}"
INTRO="$(realpath "${INTRO:-$(dirname "$0")/out/film-a.mp4}")"
cd "$(dirname "$0")/out"
# Normalise the intro to exactly 21.2s at 1080p30 so the app footage lands on its VO times.
ffmpeg -y -loglevel error -i "$INTRO" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,tpad=stop_mode=clone:stop_duration=30,trim=duration=21.2,setpts=PTS-STARTPTS" -an -c:v libx264 -crf 17 -pix_fmt yuv420p intro-cut.mp4
# The app footage opens from black on its own; fade out over its last half second.
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 app.mp4)
ffmpeg -y -loglevel error -i app.mp4 -vf "fade=t=out:st=$(echo "$D - 0.5" | bc):d=0.5" -c:v libx264 -crf 17 -pix_fmt yuv420p app-faded.mp4
printf "file 'intro-cut.mp4'\nfile 'app-faded.mp4'\n" > list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -c copy silent.mp4
if [[ -n "$VO" ]]; then
  # Pad the voice-over with silence to the picture's length (the picture holds ~0.5s past the last word).
  ffmpeg -y -loglevel error -i silent.mp4 -i "$VO" -map 0:v -map 1:a -c:v copy -af apad -c:a aac -b:a 192k -shortest opportunity-graph.mp4
else
  cp silent.mp4 opportunity-graph.mp4
fi
ffprobe -v error -show_entries format=duration -of default=nw=1 opportunity-graph.mp4
