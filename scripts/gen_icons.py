#!/usr/bin/env python3
"""
Generate Gnaver's icon set — a Liquid-Glass mark: a glossy location pin riding a
luminous route sweep on an electric-blue field, with a specular glass sheen.

Pure PIL, supersampled 4x for clean edges. Re-runnable:
    python3 scripts/gen_icons.py
Outputs into assets/images/.
"""
import json
import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "images")
SS = 4

WHITE = (255, 255, 255)
ACCENT = (10, 132, 255)
PALE = (215, 230, 255)
LENS = (8, 78, 200)      # the glossy "hole" lens
FIELD_TOP = (56, 170, 255)
FIELD_BOT = (8, 92, 220)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    px = img.load()
    for y in range(size):
        px[0, y] = lerp(top, bottom, y / max(1, size - 1))
    return img.resize((size, size))


def teardrop_mask(S, cx, cy, r, tip_y):
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    dist = tip_y - cy
    if dist > r:
        a = math.acos(r / dist)
        sx, cxx = math.sin(a), math.cos(a)
        d.polygon([(cx - r * sx, cy + r * cxx), (cx, tip_y), (cx + r * sx, cy + r * cxx)], fill=255)
    return m


def soft_circle(S, x, y, r, color, blur):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([x - r, y - r, x + r, y + r], fill=color)
    return layer.filter(ImageFilter.GaussianBlur(blur)) if blur else layer


def build(mode):
    """mode 'app' = white pin on blue field; 'glyph' = blue pin on transparent."""
    S = 1024 * SS
    cx = S // 2
    r = int(S * (0.205 if mode == "app" else 0.150))
    cy = int(S * 0.385)
    tip_y = cy + int(r * 1.72)

    if mode == "app":
        base = vgrad(S, FIELD_TOP, FIELD_BOT).convert("RGBA")
        # top light source + bottom vignette for depth
        base = Image.alpha_composite(base, soft_circle(S, cx, int(S * 0.12), int(S * 0.5), (255, 255, 255, 60), S // 8))
        base = Image.alpha_composite(base, soft_circle(S, cx, int(S * 1.02), int(S * 0.55), (3, 40, 110, 120), S // 7))
        pin_top, pin_bot = WHITE, PALE
        hole_color = LENS
        route_color = (255, 255, 255, 255)
        glow_color = (255, 255, 255, 150)
    else:
        base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        pin_top, pin_bot = (90, 175, 255), ACCENT
        hole_color = (255, 255, 255, 255)
        route_color = ACCENT + (255,)
        glow_color = ACCENT + (120,)

    # ── route sweep: glowing dots curving up into the pin tip ──
    route = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(route)
    pts = [(cx - int(r * 1.55), tip_y + int(r * 0.55)),
           (cx - int(r * 1.02), tip_y + int(r * 0.42)),
           (cx - int(r * 0.52), tip_y + int(r * 0.16))]
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i, (x, y) in enumerate(pts):
        rr = int(r * (0.22 - i * 0.035))
        gd.ellipse([x - rr * 2, y - rr * 2, x + rr * 2, y + rr * 2], fill=glow_color)
    glow = glow.filter(ImageFilter.GaussianBlur(S // 60))
    for i, (x, y) in enumerate(pts):
        rr = int(r * (0.20 - i * 0.032))
        rd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=route_color)

    # ── shadow under the pin ──
    shadow = soft_circle(S, cx, tip_y + int(r * 0.05), int(r * 0.7), (3, 30, 90, 150), S // 34)
    if mode != "app":
        shadow = soft_circle(S, cx, tip_y, int(r * 0.5), (10, 40, 90, 70), S // 40)

    # ── pin body: glossy gradient fill via mask ──
    pin_mask = teardrop_mask(S, cx, cy, r, tip_y)
    pin_fill = vgrad(S, pin_top, pin_bot).convert("RGBA")
    pin = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    pin.paste(pin_fill, (0, 0), pin_mask)

    # inner specular highlight (top-left of the head)
    hi = soft_circle(S, cx - int(r * 0.34), cy - int(r * 0.42), int(r * 0.55), (255, 255, 255, 150), S // 50)
    hi_clip = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hi_clip.paste(hi, (0, 0), pin_mask)
    pin = Image.alpha_composite(pin, hi_clip)

    # glossy hole/lens
    hr = int(r * 0.40)
    lens = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lens)
    ld.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=hole_color + ((255,) if len(hole_color) == 3 else ()))
    if mode == "app":
        ld.ellipse([cx - hr, cy - hr, cx + int(hr * 0.2), cy + int(hr * 0.1)], fill=(40, 120, 230, 200))
    pin = Image.alpha_composite(pin, lens)

    out = Image.alpha_composite(base, shadow)
    out = Image.alpha_composite(out, glow)
    out = Image.alpha_composite(out, route)
    out = Image.alpha_composite(out, pin)

    # ── glass sheen sweep across the top (app only) ──
    if mode == "app":
        sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sheen)
        sd.ellipse([-int(S * 0.3), -int(S * 0.95), int(S * 1.3), int(S * 0.42)], fill=(255, 255, 255, 42))
        sheen = sheen.filter(ImageFilter.GaussianBlur(S // 90))
        out = Image.alpha_composite(out, sheen)

    return out.resize((1024, 1024), Image.LANCZOS)


def icon_mark(S):
    """A bold, vertically-centred white glossy pin on transparent — the
    foreground layer for the Apple Icon Composer (.icon) bundle. The system
    supplies the Liquid Glass material, specular highlight and dynamic tinting."""
    cx = S // 2
    r = int(S * 0.225)
    # Centre the whole teardrop (head + tip) in the canvas.
    cy = int(S * 0.5 - 0.36 * r)
    tip_y = cy + int(r * 1.72)
    mask = teardrop_mask(S, cx, cy, r, tip_y)
    pin = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    pin.paste(vgrad(S, (255, 255, 255), (226, 239, 255)).convert("RGBA"), (0, 0), mask)
    # specular highlight on the upper-left of the head
    hi = soft_circle(S, cx - int(r * 0.32), cy - int(r * 0.4), int(r * 0.5), (255, 255, 255, 130), S // 60)
    clip = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    clip.paste(hi, (0, 0), mask)
    pin = Image.alpha_composite(pin, clip)
    # glossy blue lens
    hr = int(r * 0.40)
    ImageDraw.Draw(pin).ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=(10, 108, 228, 255))
    return pin


def write_icon_composer_bundle():
    """Emit assets/Gnaver.icon — the Apple Icon Composer layered format (iOS 26
    Liquid Glass). Openable & tweakable in Icon Composer.app."""
    icon = os.path.normpath(os.path.join(OUT, "..", "Gnaver.icon"))
    os.makedirs(os.path.join(icon, "Assets"), exist_ok=True)
    icon_mark(1024).save(os.path.join(icon, "Assets", "mark.png"))
    spec = {
        "fill": {"automatic-gradient": "extended-srgb:0.03922,0.51765,1.00000,1.00000"},
        "groups": [
            {
                "layers": [{"image-name": "mark.png", "name": "Pin"}],
                "shadow": {"kind": "neutral", "opacity": 0.45},
                "translucency": {"enabled": False, "value": 0.5},
            }
        ],
        "supported-platforms": {"circles": ["watchOS"], "squares": "shared"},
    }
    with open(os.path.join(icon, "icon.json"), "w") as f:
        json.dump(spec, f, indent=2)


def main():
    os.makedirs(OUT, exist_ok=True)
    app = build("app").convert("RGB")  # App Store icon: opaque, no alpha
    app.save(os.path.join(OUT, "icon.png"))
    app.resize((196, 196), Image.LANCZOS).save(os.path.join(OUT, "favicon.png"))

    glyph = build("glyph")  # tinted pin on transparent
    # adaptive foreground: extra safe-zone padding
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    g = glyph.resize((int(1024 * 0.72), int(1024 * 0.72)), Image.LANCZOS)
    fg.alpha_composite(g, (int((1024 - g.width) / 2), int((1024 - g.height) / 2)))
    fg.save(os.path.join(OUT, "android-icon-foreground.png"))
    glyph.save(os.path.join(OUT, "splash-icon.png"))

    Image.new("RGB", (1024, 1024), "#FFFFFF").save(os.path.join(OUT, "android-icon-background.png"))

    write_icon_composer_bundle()
    print("Wrote icon.png, favicon.png, android-icon-foreground.png, splash-icon.png,")
    print("android-icon-background.png, and assets/Gnaver.icon (Apple Icon Composer)")


if __name__ == "__main__":
    main()
