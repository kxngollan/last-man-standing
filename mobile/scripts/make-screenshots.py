#!/usr/bin/env python3
"""
Composes store screenshots from raw device captures.

The stores want different canvases for the same pictures — Apple 1260x2736 for
the 6.9" iPhone, Play a 9:16 phone frame — and neither wants a bare capture at
whatever resolution the device happened to be. This takes the raw PNGs in
store/raw/ and lays each one on a branded board with a caption, at both sizes.

    adb exec-out screencap -p > store/raw/01-standings.png
    python3 scripts/make-screenshots.py

Order and captions come from SHOTS below; a raw file with no entry is skipped
with a warning rather than being emitted uncaptioned. The number prefix is the
listing order, which is worth caring about: both stores show the first two or
three inline and hide the rest behind a tap.

Captures come from the Android emulator, which is the only device this machine
can drive. For the Apple set the status and navigation bars are cropped away
(CHROME_TOP / CHROME_BOTTOM) so no Android system chrome reaches an iPhone
listing — guideline 2.3.3 is about screenshots that misrepresent the app, and
another platform's clock and gesture bar is exactly that. What's left is the
app's own UI, which is the same React tree either way.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# src/theme/colors.ts, light palette.
ACCENT = (224, 92, 69)
CREAM = (248, 245, 239)
INK = (38, 29, 21)
PAPER2 = (241, 236, 227)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "store" / "raw"
OUT = ROOT / "store"

# Pixel 7 emulator, 1080x2400 at 420dpi. Measured off a capture rather than
# derived from dp: the gesture bar's inset is not the same as its drawn height.
CHROME_TOP = 132
CHROME_BOTTOM = 108

# (filename stem, caption, background). Two lines of caption maximum — the
# third one gets cropped by Play's own card on some surfaces.
#
# Four rather than six. "My picks" and the league table are both captured in
# store/raw/unused/ and both are near-empty before a ball is kicked — a table of
# nothing but zeroes undersells the app to anyone scrolling the listing. Add
# them back mid-season, when they have something in them.
SHOTS: list[tuple[str, str, tuple[int, int, int]]] = [
    ("01-standings", "See who’s still\nstanding", ACCENT),
    ("02-make-pick", "One team a week.\nPick and commit.", CREAM),
    ("04-fixtures", "The whole season,\nweek by week", ACCENT),
    ("06-rules", "Free to play.\nNo stakes, ever.", ACCENT),
]

# Apple: 6.9" iPhone portrait. Play: 9:16, comfortably inside the 320–3840 range
# and the 2:1 aspect cap that a raw 1080x2400 capture would breach.
TARGETS = {"ios": (1260, 2736), "play": (1080, 1920)}


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    sf = Path("/System/Library/Fonts/SFNS.ttf")
    if sf.exists():
        f = ImageFont.truetype(str(sf), size)
        if bold:
            try:
                f.set_variation_by_name("Bold")
            except OSError:
                pass
        return f
    return ImageFont.truetype(
        "/System/Library/Fonts/HelveticaNeue.ttc", size, index=1 if bold else 0
    )


def rounded(img: Image.Image, radius: int) -> Image.Image:
    """Round the screen's corners, so it reads as a phone rather than a slide."""
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def shadow(size: tuple[int, int], radius: int, blur: int) -> Image.Image:
    """A soft drop shadow, drawn as its own layer so it can sit under the screen."""
    w, h = size
    layer = Image.new("RGBA", (w + blur * 4, h + blur * 4), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        (blur * 2, blur * 2, blur * 2 + w, blur * 2 + h), radius, fill=(0, 0, 0, 90)
    )
    return layer.filter(ImageFilter.GaussianBlur(blur))


def compose(
    capture: Image.Image, caption: str, background: tuple[int, int, int],
    size: tuple[int, int], crop_chrome: bool,
) -> Image.Image:
    """One finished screenshot: caption above, phone screen below, bled off the foot."""
    w, h = size
    board = Image.new("RGB", (w, h), background)
    draw = ImageDraw.Draw(board)
    ink = CREAM if background == ACCENT else INK

    if crop_chrome:
        capture = capture.crop((0, CHROME_TOP, capture.width, capture.height - CHROME_BOTTOM))

    # Caption block, then whatever vertical space is left goes to the screen.
    pad = int(w * 0.085)
    title = font(int(w * 0.072), bold=True)
    draw.multiline_text(
        (pad, int(h * 0.052)), caption, font=title, fill=ink, spacing=int(w * 0.018)
    )

    # The screen is as wide as the board minus a margin, and deliberately runs
    # off the bottom edge: a whole phone floating in a box wastes half the
    # canvas, and both stores crop the foot on some surfaces anyway.
    screen_w = w - pad * 2
    screen_h = round(capture.height * screen_w / capture.width)
    screen = rounded(capture.resize((screen_w, screen_h), Image.LANCZOS), int(w * 0.038))

    top = int(h * 0.225)
    blur = max(6, w // 90)
    sh = shadow(screen.size, int(w * 0.038), blur)
    board.paste(sh, (pad - blur * 2, top - blur * 2 + blur // 2), sh)
    board.paste(screen, (pad, top), screen)
    return board


def main() -> None:
    if not RAW.is_dir() or not any(RAW.glob("*.png")):
        sys.exit(
            f"No captures in {RAW}.\n"
            "Capture them first, e.g.:\n"
            "  adb exec-out screencap -p > store/raw/01-standings.png"
        )

    captions = {stem: (text, bg) for stem, text, bg in SHOTS}
    order = [stem for stem, _, _ in SHOTS]

    for raw in sorted(RAW.glob("*.png")):
        if raw.stem not in captions:
            print(f"  ! {raw.name} has no entry in SHOTS — skipped")
            continue
        caption, bg = captions[raw.stem]
        capture = Image.open(raw).convert("RGB")
        for platform, size in TARGETS.items():
            img = compose(capture, caption, bg, size, crop_chrome=platform == "ios")
            n = order.index(raw.stem) + 1
            path = OUT / platform / f"{n:02d}-{raw.stem.split('-', 1)[1]}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            img.save(path)
            print(f"  {path.relative_to(OUT)}  {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
