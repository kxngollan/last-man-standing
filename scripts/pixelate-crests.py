#!/usr/bin/env python3
"""
Downloads the club crests and writes pixelated copies we host ourselves.

    python3 scripts/pixelate-crests.py

Why this exists: the app renders club badges fetched live from
crests.football-data.org. Those badges are the clubs' registered trade marks,
and fetching them through an API is not a licence to publish them — see
"Third-party content" in mobile/STORE_SUBMISSION.md.

Read this before assuming the output is safe. Pixelating REDUCES the exposure;
it does not remove it. A badge has to stay recognisable to be useful on a team
row, and recognisable is exactly what a trade mark protects — so a pixelated
crest still identifies the club, and is now also a derivative of the club's
artwork. It is a smaller target, not a legal defence. The genuinely safe setting
is CREST_STYLE=none, which falls both clients back to the lettered disc they
already draw when a badge is missing (see lib/crests.ts).

What it writes:
  public/crests/<TLA>.png   the pixelated badge, served from our own domain
  lib/crests.generated.ts   the TLAs we have a file for, for lib/crests.ts

Hosting them ourselves is half the point: it drops the runtime dependency on
someone else's CDN, so a team row can no longer be a broken image on a slow
train, and it means one place to delete everything from if a rights holder ever
asks.

After running it, re-sync the teams so the new paths reach the database —
`npm run seed`, or Seed from /admin. Nothing reads these files directly.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "crests"
MANIFEST = ROOT / "lib" / "crests.generated.ts"

FD_TEAMS = "https://api.football-data.org/v4/competitions/PL/teams"
# Fallback source: our own table endpoint returns the same tla/crest pairs off
# the synced database, which is enough when there is no API key to hand.
SITE_TEAMS = "https://www.footballlms.com/api/mobile/table"

# The badge is reduced to BLOCKS x BLOCKS and blown back up, so this is the
# whole knob: lower is blockier and less recognisable. 18 keeps a club's colours
# and rough shape at the 24-48px these render at, which is what makes a row
# scannable, while losing the fine detail — lettering, crowns, animals — that
# makes a crest the crest.
BLOCKS = 18
SIZE = 144  # 3x the largest on-screen size (48px on the make-pick cards).


def env(name: str) -> str | None:
    """Read one key out of .env.local. Not a parser — one variable, one line."""
    path = ROOT / ".env.local"
    if not path.is_file():
        return None
    for line in path.read_text().splitlines():
        m = re.match(rf"\s*{name}\s*=\s*(.*)", line)
        if m:
            return m.group(1).strip().strip('"').strip("'") or None
    return None


def get(url: str, headers: dict[str, str] | None = None) -> bytes:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read()


def teams() -> list[tuple[str, str]]:
    """(tla, crest url) pairs, from football-data.org if we have a key."""
    key = env("FOOTBALL_API")
    if key:
        data = json.loads(get(FD_TEAMS, {"X-Auth-Token": key}))
        pairs = [(t["tla"], t["crest"]) for t in data.get("teams", []) if t.get("crest")]
        if pairs:
            return pairs
        print("  football-data.org returned no crests; falling back to the site")

    data = json.loads(get(SITE_TEAMS))
    return [(r["tla"], r["crest"]) for r in data.get("rows", []) if r.get("crest")]


def pixelate(raw: bytes) -> Image.Image:
    """
    Down to BLOCKS across, then back up with no interpolation.

    The crop comes first: crests arrive with wildly different amounts of
    transparent padding, and without trimming to the artwork the pixel grid
    lands at a different scale on every badge, which reads as sloppy rather
    than as a style.
    """
    img = Image.open(BytesIO(raw)).convert("RGBA")
    box = img.getbbox()
    if box:
        img = img.crop(box)

    # Square it on transparency so the aspect ratio survives the round trip.
    side = max(img.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - img.width) // 2, (side - img.height) // 2))

    # BOX on the way down averages each block (BILINEAR would blur across block
    # edges); NEAREST on the way up is what keeps the edges hard.
    small = square.resize((BLOCKS, BLOCKS), Image.BOX)
    return small.resize((SIZE, SIZE), Image.NEAREST)


def main() -> None:
    try:
        pairs = teams()
    except Exception as err:  # noqa: BLE001 - the message is the whole point
        sys.exit(f"Could not fetch the team list: {err}")

    if not pairs:
        sys.exit("No teams with crests came back. Nothing to do.")

    OUT.mkdir(parents=True, exist_ok=True)
    done: list[str] = []

    for tla, url in sorted(pairs):
        try:
            pixelate(get(url)).save(OUT / f"{tla}.png")
        except Exception as err:  # noqa: BLE001
            # Usually an SVG, which Pillow can't open. Skipping is safe: with no
            # file, lib/crests.ts returns nothing and the client draws the disc.
            print(f"  ! {tla}: {err}")
            continue
        done.append(tla)
        print(f"  {tla}.png")

    MANIFEST.write_text(
        "// Generated by scripts/pixelate-crests.py — do not edit.\n"
        "// The clubs we have a pixelated badge on disk for; see lib/crests.ts.\n"
        "export const PIXELATED_CRESTS = new Set<string>([\n"
        + "".join(f'  "{tla}",\n' for tla in done)
        + "]);\n"
    )

    print(f"\n{len(done)} crests -> {OUT.relative_to(ROOT)}")
    print(f"manifest -> {MANIFEST.relative_to(ROOT)}")
    print("\nNow re-sync the teams so the database points at them:  npm run seed")


if __name__ == "__main__":
    main()
