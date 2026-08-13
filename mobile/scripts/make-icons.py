#!/usr/bin/env python3
"""
Draws the app's launcher artwork from the design system's own colours.

The project shipped with Expo's template icon, which is both someone else's
trademark and an instant "unfinished app" signal to a store reviewer. This
generates a real set instead: a football, cream on the brand accent, drawn from
the same tokens the app renders with (see src/theme/colors.ts).

Deliberately geometric rather than illustrated — it has to survive being 40px
wide on a home screen, and it has to be reproducible from source rather than
being a binary nobody can edit.

    python3 scripts/make-icons.py

Every path it writes is already referenced by app.json, so there is nothing to
wire up afterwards. Replace these with real artwork whenever there is some;
keep the sizes and the transparency rules below and app.json needs no changes.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

# From src/theme/colors.ts — the light palette, so the icon matches the app.
ACCENT = (224, 92, 69, 255)  # #e05c45
CREAM = (248, 245, 239, 255)  # #f8f5ef  (paper)
INK = (38, 29, 21, 255)  # #261d15

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"

# Everything is drawn at 4x and reduced, which is the whole anti-aliasing
# strategy: Pillow's polygon fill has hard edges, and a 4x box filter is
# indistinguishable from a proper rasteriser at these shapes.
SS = 4


def pentagon(cx: float, cy: float, r: float, rot: float) -> list[tuple[float, float]]:
    """Five points on a circle, `rot` radians from pointing straight up."""
    return [
        (
            cx + r * math.sin(rot + i * 2 * math.pi / 5),
            cy - r * math.cos(rot + i * 2 * math.pi / 5),
        )
        for i in range(5)
    ]


def draw_ball(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    body: tuple[int, int, int, int],
    seam: tuple[int, int, int, int],
) -> None:
    """
    A football: one pentagon at the centre, five around the rim, seams between.

    The rim pentagons are clipped by the ball's edge rather than being drawn
    inside it, which is what stops the ball reading as a flower.
    """
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=body)

    centre_r = r * 0.32
    draw.polygon(pentagon(cx, cy, centre_r, 0), fill=seam)

    # Seams run from the centre pentagon's points to the rim. Drawn before the
    # rim patches so the patches cap them cleanly.
    for i in range(5):
        angle = i * 2 * math.pi / 5
        x0 = cx + centre_r * math.sin(angle)
        y0 = cy - centre_r * math.cos(angle)
        x1 = cx + r * math.sin(angle)
        y1 = cy - r * math.cos(angle)
        draw.line((x0, y0, x1, y1), fill=seam, width=int(r * 0.075))

    # Rim patches sit between the seams — hence the 36 degree offset — and are
    # drawn on a scratch layer so the ball's circle can clip them.
    patches = Image.new("RGBA", draw.im.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(patches)
    for i in range(5):
        angle = math.pi / 5 + i * 2 * math.pi / 5
        px = cx + r * 0.92 * math.sin(angle)
        py = cy - r * 0.92 * math.cos(angle)
        pd.polygon(pentagon(px, py, r * 0.30, angle + math.pi), fill=seam)

    clip = Image.new("L", patches.size, 0)
    ImageDraw.Draw(clip).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    patches.putalpha(Image.composite(patches.getchannel("A"), clip, clip))
    return patches


def compose(size: int, background: tuple[int, int, int, int] | None, ball_scale: float,
            body: tuple[int, int, int, int], seam: tuple[int, int, int, int]) -> Image.Image:
    """One icon: optional flood fill, then a ball at `ball_scale` of the width."""
    px = size * SS
    img = Image.new("RGBA", (px, px), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    patches = draw_ball(draw, px / 2, px / 2, px * ball_scale / 2, body, seam)
    img.alpha_composite(patches)
    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, name: str, *, opaque: bool) -> None:
    """
    iOS rejects an icon with an alpha channel outright, so those get flattened.
    Android's adaptive layers and the splash mark need theirs kept.
    """
    if opaque:
        flat = Image.new("RGB", img.size, ACCENT[:3])
        flat.paste(img, mask=img.getchannel("A"))
        flat.save(OUT / name)
    else:
        img.save(OUT / name)
    print(f"  {name}  {img.size[0]}x{img.size[1]}  {'opaque' if opaque else 'alpha'}")


def main() -> None:
    print(f"writing to {OUT}")

    # The store icon and the iOS launcher. No transparency, no rounded corners —
    # both platforms mask it themselves, and a pre-rounded icon gets double
    # corners.
    save(compose(1024, ACCENT, 0.68, CREAM, INK), "icon.png", opaque=True)

    # Android adaptive icon. The foreground has to survive being masked to a
    # circle and to a squircle, so the ball is kept well inside the 66% safe
    # zone the launcher guarantees.
    save(compose(1024, None, 0.44, CREAM, INK), "android-icon-foreground.png", opaque=False)
    background = Image.new("RGBA", (1024, 1024), ACCENT)
    save(background, "android-icon-background.png", opaque=True)

    # Themed icons: Android tints a single-colour silhouette itself, so this is
    # a flat white ball with no seams — seams would come back as holes.
    save(compose(1024, None, 0.44, (255, 255, 255, 255), (255, 255, 255, 255)),
         "android-icon-monochrome.png", opaque=False)

    # The splash mark. app.json renders it 128pt wide over the accent, so it
    # only needs to be crisp at 3x that, and it must keep its alpha.
    save(compose(512, None, 0.92, CREAM, INK), "splash-icon.png", opaque=False)

    # Expo Web's favicon.
    save(compose(48, ACCENT, 0.72, CREAM, INK), "favicon.png", opaque=True)


if __name__ == "__main__":
    main()
