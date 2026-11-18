import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

directory = Path(sys.argv[1]).resolve()


def source(name):
    with Image.open(directory / f"{name}.jpg") as photo:
        return ImageOps.exif_transpose(photo).convert("RGB")


paper = Image.new("RGB", (1120, 820), "#f3efe7")
ferry = source("v2-nami-ferry")
ferry.thumbnail((756, 670))
paper.paste(ferry, ((paper.width - ferry.width) // 2, (paper.height - ferry.height) // 2))
paper.rotate(-7, expand=True, fillcolor="#675247", resample=Image.Resampling.BICUBIC).save(
    directory / "v6-paper-ferry.jpg", quality=88
)

monitor = Image.new("RGB", (1120, 920), "#2a2928")
tomb = source("v6-source-46295529").resize((940, 705), Image.Resampling.LANCZOS)
monitor.paste(ImageEnhance.Color(tomb).enhance(0.76), (90, 88))
overlay = ImageDraw.Draw(monitor)
for y in range(92, 789, 6):
    overlay.line((90, y, 1029, y), fill="#66696d", width=1)
monitor.rotate(4, expand=True, fillcolor="#474440", resample=Image.Resampling.BICUBIC).save(
    directory / "v6-screen-tomb.jpg", quality=88
)

ferry = source("v4-nami-jocelyn-2")
width, height = ferry.size
cropped_ferry = ferry.crop((int(width * 0.06), int(height * 0.16), int(width * 0.93), int(height * 0.85)))
cropped_ferry.thumbnail((900, 1200), Image.Resampling.LANCZOS)
ImageEnhance.Color(cropped_ferry).enhance(0.8).save(directory / "v6-full-bleed-unindexed-ferry.jpg", quality=88)
