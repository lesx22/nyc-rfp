#!/usr/bin/env bash
# Join film-a + app + film-b, add the voice-over if present, burn nothing (captions ship as captions.srt).
#   bash video/assemble.sh [path/to/voiceover.(wav|mp3|m4a)]
set -euo pipefail
VO="${1:+$(realpath "$1")}"
cd "$(dirname "$0")/out"
# Fade the app footage in and out so it meets the title scenes cleanly.
ffmpeg -y -loglevel error -i app.mp4 -vf "fade=t=in:st=0:d=0.5,fade=t=out:st=31.2:d=0.5" -c:v libx264 -crf 17 -pix_fmt yuv420p app-faded.mp4
printf "file 'film-a.mp4'\nfile 'app-faded.mp4'\nfile 'film-b.mp4'\n" > list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -c copy silent.mp4
if [[ -n "$VO" ]]; then
  ffmpeg -y -loglevel error -i silent.mp4 -i "$VO" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k opportunity-graph.mp4
else
  cp silent.mp4 opportunity-graph.mp4
fi
ffprobe -v error -show_entries format=duration -of default=nw=1 opportunity-graph.mp4
