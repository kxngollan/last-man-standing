#!/usr/bin/env python3
"""
Draws the store listing artwork that isn't a screenshot.

Two of the required assets are pure graphic design with no app content in them,
which means they can be generated from the same tokens as everything else rather
than being binaries nobody can edit:

  * Google Play's 512x512 icon
  * Google Play's 1024x500 feature graphic (mandatory; the listing will not
    publish without one)

Screenshots are the other half of the listing and cannot come from here — they
have to be captures of the running app. See STORE_SUBMISSION.md.

    python3 scripts/make-store-assets.py

Everything lands in store/, which is gitignored output: regenerate rather than
edit. The ball is not redrawn — it is composited from assets/images, so the
listing and the launcher icon can never drift apart.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# From src/theme/colors.ts, light palette — the same three the icons use.
ACCENT = (224, 92, 69)  # #e05c45
CREAM = (248, 245, 239)  # #f8f5ef  (paper)
INK = (38, 29, 21)  # #261d15

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "assets" / "images"
OUT = ROOT / "store"

# Rendered at 3x and reduced. Pillow has no sub-pixel text positioning and its
# polygon fill is hard-edged; a downsample is the cheapest way to a clean edge.
SS = 3


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    """
    San Francisco where it exists, Helvetica Neue behind it.

    The app sets no fontFamily, so it renders in each platform's system face —
    SF on iOS, Roboto on Android. SF is the closer match of the two available
    here, and it is what an iPhone screenshot beside this graphic will show.
    """
    sf = Path("/System/Library/Fonts/SFNS.ttf")
    if sf.exists():
        f = ImageFont.truetype(str(sf), size)
        if bold:
            try:
                f.set_variation_by_name("Bold")
            except OSError:
                pass  # FreeType without variable-font support; regular is fine.
        return f
    return ImageFont.truetype(
        "/System/Library/Fonts/HelveticaNeue.ttc", size, index=1 if bold else 0
    )


def play_icon() -> None:
    """
    Play's 512x512, from the 1024 the app already ships.

    Down from 1024 rather than redrawn, so it is the same artwork the launcher
    shows. Flattened to RGB: Play rejects an icon with an alpha channel, and
    it rounds the corners itself, so no mask here either.
    """
    src = Image.open(IMAGES / "icon.png").convert("RGB")
    icon = src.resize((512, 512), Image.LANCZOS)
    write(icon, "play/icon-512.png")


def feature_graphic() -> None:
    """
    Play's 1024x500 header, shown above the listing on both web and phone.

    Play overlays its own play button and, on some surfaces, crops toward the
    centre, so nothing that matters goes near an edge and nothing sits dead
    centre. The layout is the ball on the left, the wordmark and one line of
    what the game is on the right — legible at the ~380px wide it is often
    rendered at, which rules out anything smaller than the tagline size below.
    """
    w, h = 1024 * SS, 500 * SS
    img = Image.new("RGB", (w, h), ACCENT)
    draw = ImageDraw.Draw(img)

    # A darker band bled off the bottom edge, so the flat accent has some depth
    # without introducing a second hue.
    draw.rectangle((0, h - 18 * SS, w, h), fill=(196, 76, 56))

    # The ball, from the splash mark — cream on accent, alpha intact.
    ball_px = 250 * SS
    ball = Image.open(IMAGES / "splash-icon.png").convert("RGBA")
    ball = ball.resize((ball_px, ball_px), Image.LANCZOS)
    img.paste(ball, (86 * SS, (h - ball_px) // 2), ball)

    x = 392 * SS
    wordmark = font(74 * SS, bold=True)
    tagline = font(33 * SS)
    kicker = font(23 * SS, bold=True)

    draw.text((x, 150 * SS), "LAST MAN", font=wordmark, fill=CREAM)
    draw.text((x, 226 * SS), "STANDING", font=wordmark, fill=CREAM)

    draw.line((x, 320 * SS, x + 96 * SS, 320 * SS), fill=INK, width=4 * SS)

    draw.text((x, 344 * SS), "One team a week. Lose and you’re out.", font=tagline, fill=INK)
    draw.text(
        (x, 396 * SS),
        "F R E E   T O   P L A Y  ·  N O   S T A K E S",
        font=kicker,
        fill=(255, 221, 207),
    )

    write(img.resize((1024, 500), Image.LANCZOS), "play/feature-graphic-1024x500.png")


def write(img: Image.Image, name: str) -> None:
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    print(f"  {name}  {img.size[0]}x{img.size[1]}  {img.mode}")


def main() -> None:
    print(f"writing to {OUT}")
    play_icon()
    feature_graphic()


if __name__ == "__main__":
    main()
