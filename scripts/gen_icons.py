#!/usr/bin/env python3
"""
Generate Gnaver's app icon set — Map-first Minimal: an electric-blue location
pin with a short route trail over a soft map-grid background.

Pure PIL (no SVG deps). Supersamples 4x for clean antialiasing. Re-runnable:
    python3 scripts/gen_icons.py
Outputs into assets/images/.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "images")
SS = 4  # supersample factor

ACCENT = (10, 132, 255)      # #0A84FF electric blue
ACCENT_DK = (0, 102, 221)    # gradient end
INK = (11, 16, 20)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgradient(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    px = img.load()
    for y in range(size):
        px[0, y] = lerp(top, bottom, y / max(1, size - 1))
    return img.resize((size, size))


def draw_pin(draw, cx, cy_head, r, tip_y, fill, hole=None):
    """Teardrop pin: head circle + tangent triangle to the tip, optional hole."""
    draw.ellipse([cx - r, cy_head - r, cx + r, cy_head + r], fill=fill)
    d = tip_y - cy_head
    if d > r:
        alpha = math.acos(r / d)            # half-angle of the tangent cone
        sx, cxx = math.sin(alpha), math.cos(alpha)
        t1 = (cx - r * sx, cy_head + r * cxx)
        t2 = (cx + r * sx, cy_head + r * cxx)
        draw.polygon([t1, (cx, tip_y), t2], fill=fill)
    if hole:
        hr = hole
        draw.ellipse([cx - hr, cy_head - hr, cx + hr, cy_head + hr], fill=WHITE)


def compose(size, with_background=True, pin_scale=1.0):
    S = size * SS
    if with_background:
        base = vgradient(S, (251, 252, 254), (236, 243, 249)).convert("RGBA")
        # faint map grid
        grid = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grid)
        step = S // 8
        for i in range(1, 8):
            gd.line([(i * step, 0), (i * step, S)], fill=(120, 140, 165, 22), width=max(1, SS))
            gd.line([(0, i * step), (S, i * step)], fill=(120, 140, 165, 22), width=max(1, SS))
        base = Image.alpha_composite(base, grid)
        # soft blue glow behind the pin
        glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        gdr = ImageDraw.Draw(glow)
        gr = int(S * 0.30)
        gdr.ellipse([S // 2 - gr, int(S * 0.42) - gr, S // 2 + gr, int(S * 0.42) + gr],
                    fill=(10, 132, 255, 46))
        glow = glow.filter(ImageFilter.GaussianBlur(S // 18))
        base = Image.alpha_composite(base, glow)
    else:
        base = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    cx = S // 2
    r = int(S * 0.195 * pin_scale)
    cy_head = int(S * 0.40)
    tip_y = int(S * 0.74 * (1 if with_background else 1))
    tip_y = cy_head + int(r * 1.65)

    # drop shadow
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([cx - r * 0.9, tip_y - r * 0.18, cx + r * 0.9, tip_y + r * 0.28],
               fill=(11, 16, 20, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(S // 40))
    base = Image.alpha_composite(base, shadow)

    pin = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pin)

    # route trail leading into the pin
    trail = [(cx - int(r * 1.25), tip_y + int(r * 0.30)),
             (cx - int(r * 0.78), tip_y + int(r * 0.12)),
             (cx - int(r * 0.34), tip_y - int(r * 0.10))]
    for i, (x, y) in enumerate(trail):
        rr = int(r * (0.20 - i * 0.03))
        pd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=ACCENT)

    # pin with a vertical-gradient blue fill (draw solid then mask a gradient)
    draw_pin(pd, cx, cy_head, r, tip_y, ACCENT, hole=int(r * 0.40))
    grad = vgradient(S, ACCENT, ACCENT_DK).convert("RGBA")
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    draw_pin(md, cx, cy_head, r, tip_y, 255, hole=None)
    hole = Image.new("L", (S, S), 0)
    hd = ImageDraw.Draw(hole)
    hr = int(r * 0.40)
    hd.ellipse([cx - hr, cy_head - hr, cx + hr, cy_head + hr], fill=255)
    grad_pin = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad_pin.paste(grad, (0, 0), mask)
    white_hole = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    white_hole.paste(Image.new("RGBA", (S, S), WHITE + (255,)), (0, 0), hole)
    pin = Image.alpha_composite(grad_pin, white_hole)
    # re-draw the trail on top so it isn't covered by the gradient pin layer
    pin_trail = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ptd = ImageDraw.Draw(pin_trail)
    for i, (x, y) in enumerate(trail):
        rr = int(r * (0.20 - i * 0.03))
        ptd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=ACCENT + (255,))
    out = Image.alpha_composite(base, pin_trail)
    out = Image.alpha_composite(out, pin)
    return out.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)

    icon = compose(1024, with_background=True).convert("RGB")  # App Store: no alpha
    icon.save(os.path.join(OUT, "icon.png"))

    fg = compose(1024, with_background=False, pin_scale=0.66)   # adaptive safe zone
    fg.save(os.path.join(OUT, "android-icon-foreground.png"))

    splash = compose(1024, with_background=False, pin_scale=0.92)
    splash.save(os.path.join(OUT, "splash-icon.png"))

    icon.resize((196, 196), Image.LANCZOS).save(os.path.join(OUT, "favicon.png"))

    # solid brand background for the adaptive icon
    Image.new("RGB", (1024, 1024), WHITE).save(os.path.join(OUT, "android-icon-background.png"))

    print("Wrote icon.png, android-icon-foreground.png, splash-icon.png, favicon.png, android-icon-background.png")


if __name__ == "__main__":
    main()
