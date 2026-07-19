#!/usr/bin/env python3
"""
Auto-chapter a cooking video for Cook With Joe.

Given one full-length video, this:
  1. Extracts the audio track with ffmpeg.
  2. Transcribes it locally with faster-whisper (no API key, no cloud call).
  3. Groups the transcript into candidate recipe "steps" using simple cues:
     a new step starts after a pause in speech, or when a sentence begins
     with a common instruction/imperative phrase (e.g. "next", "now",
     "first", "add", "chop", "heat", ...).
  4. Writes a JSON file shaped like one entry of data/recipes.json, ready to
     drop into the app, or to open in the manual chapter editor
     (/admin/edit) for fine-tuning.

This is a *starting point*, not a final answer — transcription and step
detection are both imperfect, especially with background kitchen noise, so
always review/adjust the output in the editor before publishing.

Usage:
    python3 scripts/auto_chapters.py path/to/video.mp4 \\
        --slug my-recipe --title "My Recipe" --category Meats \\
        --out data/generated/my-recipe.json

Model size: defaults to "small" (good accuracy/speed balance on CPU).
Use --model tiny for a faster first pass, or --model medium for higher
accuracy on a machine with more CPU/RAM (or a GPU).
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

STEP_CUE_WORDS = [
    "next", "now", "first", "then", "finally", "after that", "once",
    "add", "pour", "chop", "dice", "mince", "slice", "chip", "heat",
    "stir", "whisk", "mix", "combine", "fold", "season", "sprinkle",
    "bake", "boil", "simmer", "saute", "sauté", "fry", "grill", "roast",
    "flip", "remove", "take", "place", "put", "let", "cover", "drain",
    "preheat", "cut", "peel", "grate", "crack", "melt", "reduce",
]

CUE_PATTERN = re.compile(
    r"^\s*(" + "|".join(re.escape(w) for w in STEP_CUE_WORDS) + r")\b",
    re.IGNORECASE,
)

PAUSE_THRESHOLD_SECONDS = 1.4
MIN_STEP_SECONDS = 3.0


def extract_audio(video_path: Path, out_wav: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(video_path),
            "-ac", "1", "-ar", "16000", "-vn",
            str(out_wav),
            "-loglevel", "error",
        ],
        check=True,
    )


def transcribe(wav_path: Path, model_size: str):
    from faster_whisper import WhisperModel

    print(f"Loading Whisper model '{model_size}' (first run downloads it)...", file=sys.stderr)
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _info = model.transcribe(str(wav_path), beam_size=5, vad_filter=True)
    return [
        {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
        for seg in segments
        if seg.text.strip()
    ]


def group_into_steps(segments):
    if not segments:
        return []

    steps = []
    current = {
        "start": segments[0]["start"],
        "end": segments[0]["end"],
        "texts": [segments[0]["text"]],
    }

    for prev, seg in zip(segments, segments[1:]):
        gap = seg["start"] - prev["end"]
        starts_new_instruction = bool(CUE_PATTERN.match(seg["text"]))
        long_enough = (prev["end"] - current["start"]) >= MIN_STEP_SECONDS

        should_split = long_enough and (gap >= PAUSE_THRESHOLD_SECONDS or starts_new_instruction)

        if should_split:
            steps.append(current)
            current = {"start": seg["start"], "end": seg["end"], "texts": [seg["text"]]}
        else:
            current["end"] = seg["end"]
            current["texts"].append(seg["text"])

    steps.append(current)
    return steps


def label_for(texts):
    joined = " ".join(texts)
    words = joined.split()
    label = " ".join(words[:8])
    if len(words) > 8:
        label += "…"
    return label[0].upper() + label[1:] if label else "Step"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("video", type=Path, help="Path to the full-length recipe video")
    parser.add_argument("--slug", required=True, help="URL-safe recipe slug, e.g. garlic-butter-steak")
    parser.add_argument("--title", required=True, help="Recipe display title")
    parser.add_argument("--category", default="Meats", help="Category (Meats, Appetizers, Cocktails, ...)")
    parser.add_argument("--premium", action="store_true", help="Mark this recipe as premium/subscriber-only")
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium", "large-v3"])
    parser.add_argument("--out", type=Path, default=None, help="Output JSON path (default: data/generated/<slug>.json)")
    args = parser.parse_args()

    if not args.video.exists():
        sys.exit(f"Video not found: {args.video}")

    out_path = args.out or Path("data/generated") / f"{args.slug}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / "audio.wav"
        print("Extracting audio...", file=sys.stderr)
        extract_audio(args.video, wav_path)

        print("Transcribing (this can take a while on CPU)...", file=sys.stderr)
        segments = transcribe(wav_path, args.model)

    print(f"Transcribed {len(segments)} speech segments. Grouping into steps...", file=sys.stderr)
    grouped = group_into_steps(segments)

    recipe = {
        "slug": args.slug,
        "title": args.title,
        "category": args.category,
        "premium": args.premium,
        "description": "Auto-generated chapters — review and adjust in the chapter editor before publishing.",
        "video": f"/videos/{args.video.name}",
        "thumbnail": "",
        "steps": [
            {
                "id": i + 1,
                "label": label_for(g["texts"]),
                "start": round(g["start"], 2),
                "end": round(g["end"], 2),
                "transcript": " ".join(g["texts"]),
            }
            for i, g in enumerate(grouped)
        ],
    }

    out_path.write_text(json.dumps(recipe, indent=2))
    print(f"\nWrote {len(recipe['steps'])} candidate steps to {out_path}")
    print("Next: copy the video into public/videos/, review/adjust the steps")
    print("in the chapter editor (/admin/edit), then merge into data/recipes.json.")


if __name__ == "__main__":
    main()
