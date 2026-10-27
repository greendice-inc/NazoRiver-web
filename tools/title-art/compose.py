"""Compose the four lit title quadrants (public/art/on_*.webp) into on_full.png (1920x1080)."""
from PIL import Image
c = Image.new("RGB", (1920, 1080))
for k, (x, y) in {"ul": (0, 0), "ur": (960, 0), "dl": (0, 540), "dr": (960, 540)}.items():
    c.paste(Image.open(f"../../public/art/on_{k}.webp"), (x, y))
c.save("on_full.png")
