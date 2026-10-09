"""Encode generated photographs into a silent, seamless travel montage.

This is animated photo editing, not scene-motion/video-model generation.
Usage: python scripts/render-travel-hero.py --ffmpeg PATH
"""

import argparse
import subprocess
from pathlib import Path


SCENES = ("beach", "lake", "heritage", "food", "people", "coast")
FPS = 24


def render(ffmpeg: str, root: Path, variant: str, width: int, height: int) -> None:
    sources = root / "assets" / "synthetic" / "hero"
    output = root / "assets" / "video" / f"travel-hero-{variant}.mp4"
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [ffmpeg, "-hide_banner", "-loglevel", "warning", "-y"]
    for scene in (*SCENES, SCENES[0]):
        command += ["-i", str(sources / f"{scene}.png")]

    filters = []
    for index in range(7):
        scene = (*SCENES, SCENES[0])[index]
        # Portrait crops deliberately follow the subject rather than blindly
        # centering every landscape. Desktop retains the full horizontal field.
        anchor = {"lake": 0.9, "people": 0.75, "heritage": 0.65, "food": 0.65}.get(scene, 0.5)
        # A smooth shallow zoom preserves the photo-memory feeling. The repeated
        # beach shot uses the same motion so trim endpoints align at the loop seam.
        filters.append(
            f"[{index}:v]scale={width * 2}:{height * 2}:force_original_aspect_ratio=increase,"
            f"crop={width * 2}:{height * 2}:x='(iw-ow)*{anchor}':y='(ih-oh)/2',setsar=1,"
            f"zoompan=z='1.015+0.045*on/71':"
            f"x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':"
            f"d=72:s={width}x{height}:fps={FPS},"
            f"format=yuv420p,settb=1/{FPS}[s{index}]"
        )
    previous = "s0"
    for index in range(1, 7):
        current = f"mix{index}"
        filters.append(
            f"[{previous}][s{index}]xfade=transition=fade:duration=0.5:"
            f"offset={index * 2.5}[{current}]"
        )
        previous = current
    filters.append(f"[{previous}]trim=start=0.5:end=15.5,setpts=N/({FPS}*TB)[out]")
    command += [
        "-filter_complex_threads", "1", "-filter_complex", ";".join(filters),
        "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "medium",
        "-crf", "22", "-r", str(FPS), "-fps_mode", "cfr", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-metadata", "comment=Synthetic editorial photo montage; no owner evidence",
        str(output),
    ]
    subprocess.run(command, check=True)
    # A separate decoder pass checks every encoded frame, including transitions.
    subprocess.run([ffmpeg, "-xerror", "-v", "error", "-i", str(output), "-f", "null", "-"], check=True)
    print(f"PASS {variant}: {output.stat().st_size:,} bytes; all frames decoded", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    for scene in SCENES:
        source = root / "assets" / "synthetic" / "hero" / f"{scene}.png"
        if not source.is_file():
            raise FileNotFoundError(f"Missing generated source: {source}")
    render(args.ffmpeg, root, "portrait", 720, 960)
    render(args.ffmpeg, root, "wide", 1280, 720)
    subprocess.run([
        args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i",
        str(root / "assets" / "video" / "travel-hero-wide.mp4"), "-frames:v", "1",
        "-q:v", "2", str(root / "assets" / "synthetic" / "hero" / "poster.jpg"),
    ], check=True)


if __name__ == "__main__":
    main()
