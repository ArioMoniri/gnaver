#!/usr/bin/env python3
"""Generate crisp flag PNGs for the curated cities so chips never depend on the
device emoji font (which can render flag codepoints inconsistently)."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "images", "flags")
W, H = 120, 80


def vbands(colors):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    n = len(colors)
    for i, c in enumerate(colors):
        d.rectangle([i * W // n, 0, (i + 1) * W // n, H], fill=c)
    return img


def hbands(colors, weights=None):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    weights = weights or [1] * len(colors)
    total = sum(weights)
    y = 0
    for c, w in zip(colors, weights):
        h = round(H * w / total)
        d.rectangle([0, y, W, y + h], fill=c)
        y += h
    return img


def japan():
    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)
    r = 22
    d.ellipse([W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r], fill=(188, 0, 45))
    return img


def portugal():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gw = int(W * 0.42)
    d.rectangle([0, 0, gw, H], fill=(0, 102, 0))
    d.rectangle([gw, 0, W, H], fill=(218, 41, 28))
    # armillary sphere (simplified): yellow ring + red shield dot at the seam
    cx, cy, r = gw, H // 2, 15
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 204, 41), width=3)
    d.rectangle([cx - 5, cy - 8, cx + 5, cy + 8], fill=(255, 255, 255))
    d.rectangle([cx - 4, cy - 7, cx + 4, cy + 7], fill=(0, 39, 118))
    return img


FLAGS = {
    "fr": lambda: vbands([(0, 85, 164), (255, 255, 255), (239, 65, 53)]),
    "it": lambda: vbands([(0, 140, 69), (255, 255, 255), (205, 33, 42)]),
    "nl": lambda: hbands([(174, 28, 40), (255, 255, 255), (33, 70, 139)]),
    "es": lambda: hbands([(170, 21, 27), (241, 191, 0), (170, 21, 27)], [1, 2, 1]),
    "jp": japan,
    "pt": portugal,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for code, fn in FLAGS.items():
        fn().save(os.path.join(OUT, f"{code}.png"))
    print("Wrote flags:", ", ".join(f"{c}.png" for c in FLAGS))


if __name__ == "__main__":
    main()
