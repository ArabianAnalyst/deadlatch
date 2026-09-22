#!/usr/bin/env python3
"""Subset the two Geist variable fonts to the Latin range this site actually renders.

Run from the repo root, once, after a Geist file is replaced by a fresh upstream copy:

    pip install fonttools brotli
    python scripts/subset-geist.py

Why: the full faces are 69.7 KiB and 71.4 KiB and both are preloaded on every
route. The site is English and renders roughly the Latin block, so most of that
weight never paints a glyph. Subsetting pays for the preloaded display serif and
keeps the mobile page-weight gate.

What is preserved:
  * the `wght` variation axis, so `weight: "100 900"` in `app/layout.tsx` still
    resolves every weight the CSS asks for
  * every OpenType layout feature, so the mono's tabular figures, the kerning and
    the ligatures survive
  * every codepoint in BASE_RANGES below, plus every codepoint above U+007E that
    this repo's own source and content actually use, intersected with the font's
    own cmap so a glyph the font never had is never asked for

The originals are copied to `.superpowers/fonts-original/` (git-ignored) before
anything is written, so the change is reversible locally. The committed change is
the two replaced .woff2 files and this script.

Licence: Geist is SIL OFL 1.1 with no Reserved Font Name declared (see
`app/fonts/Geist-OFL.txt`), so a modified version may be redistributed under the
same licence as long as the copyright notice and licence travel with it.
"""

from __future__ import annotations

import html
import re
import shutil
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

REPO = Path(__file__).resolve().parent.parent
FONT_DIR = REPO / "app" / "fonts"
BACKUP_DIR = REPO / ".superpowers" / "fonts-original"
FONTS = ["Geist-Variable.woff2", "GeistMono-Variable.woff2"]

# The Latin range Google Fonts serves for a latin subset, verbatim from the brief.
BASE_RANGES: list[tuple[int, int]] = [
    (0x0020, 0x007E),
    (0x00A0, 0x00FF),
    (0x0131, 0x0131),
    (0x0152, 0x0153),
    (0x02BB, 0x02BC),
    (0x02C6, 0x02C6),
    (0x02DA, 0x02DA),
    (0x02DC, 0x02DC),
    (0x2000, 0x206F),
    (0x20AC, 0x20AC),
    (0x2122, 0x2122),
    (0x2190, 0x2199),
    (0x2212, 0x2212),
    (0x2215, 0x2215),
    (0x25B6, 0x25B6),
    (0x2264, 0x2265),
    (0xFEFF, 0xFEFF),
    (0xFFFD, 0xFFFD),
]

# Everything the site could render a character from: components, route code, the
# data layer, and the markdown the /log posts are built from (lib/log.ts reads
# content/log/*.md through gray-matter and marked).
SCAN_DIRS = ["app", "components", "lib", "content"]
SKIP_SUFFIXES = {
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".avif",
    ".pdf",
    ".zip",
}


def base_codepoints() -> set[int]:
    out: set[int] = set()
    for lo, hi in BASE_RANGES:
        out.update(range(lo, hi + 1))
    return out


JS_ESCAPE = re.compile(r"\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})")
CSS_ESCAPE = re.compile(r"\\([0-9a-fA-F]{2,6})\s?")


def rendered_codepoints(text: str) -> set[int]:
    """Every codepoint a file can put on screen: the literal characters, plus the
    ones hidden behind an HTML entity or a JS/CSS escape. `&#10003;` in
    components/Console.tsx is the case that proves a literal-only scan is wrong."""
    out = {ord(c) for c in text}
    out |= {ord(c) for c in html.unescape(text)}
    for m in JS_ESCAPE.finditer(text):
        out.add(int(next(g for g in m.groups() if g), 16))
    if "content:" in text or text.lstrip().startswith(("/*", ":root")):
        for m in CSS_ESCAPE.finditer(text):
            cp = int(m.group(1), 16)
            if 0 < cp <= 0x10FFFF:
                out.add(cp)
    return out


def source_codepoints() -> dict[int, str]:
    """Every codepoint above U+007E used by the repo's own source and content,
    mapped to the first file it was seen in, so the report can say where it came from."""
    found: dict[int, str] = {}
    for d in SCAN_DIRS:
        root = REPO / d
        if not root.is_dir():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix.lower() in SKIP_SUFFIXES:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            rel = str(path.relative_to(REPO)).replace("\\", "/")
            for cp in rendered_codepoints(text):
                if cp > 0x007E and cp not in found:
                    found[cp] = rel
    return found


def axes_of(font: TTFont) -> str:
    if "fvar" not in font:
        return "none (static)"
    return ", ".join(
        f"{a.axisTag} {a.minValue}-{a.maxValue} (default {a.defaultValue})"
        for a in font["fvar"].axes
    )


def main() -> int:
    if not FONT_DIR.is_dir():
        print(f"no font directory at {FONT_DIR}", file=sys.stderr)
        return 1

    base = base_codepoints()
    used = source_codepoints()
    extra_candidates = {cp: where for cp, where in used.items() if cp not in base}

    print(f"scanned {', '.join(SCAN_DIRS)} for codepoints above U+007E")
    print(f"  {len(used)} distinct, {len(extra_candidates)} of them outside the base range")

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    total_before = 0
    total_after = 0

    for name in FONTS:
        src = FONT_DIR / name
        if not src.is_file():
            print(f"missing {src}", file=sys.stderr)
            return 1

        backup = BACKUP_DIR / name
        if backup.exists():
            print(f"\n{name}: backup already present at {backup.relative_to(REPO)}, keeping it")
        else:
            shutil.copy2(src, backup)
            print(f"\n{name}: original copied to {backup.relative_to(REPO)}")

        before = src.stat().st_size
        font = TTFont(str(src))
        cmap = set(font.getBestCmap().keys())
        print(f"  axes before: {axes_of(font)}")

        added = sorted(cp for cp in extra_candidates if cp in cmap)
        missing = sorted(cp for cp in extra_candidates if cp not in cmap)
        for cp in added:
            print(f"  + U+{cp:04X} {chr(cp)!r} ({extra_candidates[cp]})")
        for cp in missing:
            print(f"  - U+{cp:04X} not in this font's cmap, skipped ({extra_candidates[cp]})")

        unicodes = sorted(base | set(added))

        opts = Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]  # '*' keeps every OpenType layout feature
        opts.name_IDs = ["*"]
        opts.name_legacy = True
        opts.name_languages = ["*"]
        opts.notdef_outline = True
        opts.recalc_bounds = True
        opts.ignore_missing_unicodes = True

        subsetter = Subsetter(options=opts)
        subsetter.populate(unicodes=unicodes)
        subsetter.subset(font)

        font.flavor = "woff2"
        # Without this, fontTools stamps head.modified with the current time and two
        # runs of this script produce two different byte streams for the same subset.
        font.recalcTimestamp = False
        font.save(str(src))
        font.close()

        after = src.stat().st_size
        check = TTFont(str(src))
        print(f"  axes after:  {axes_of(check)}")
        print(f"  glyphs after: {len(check.getGlyphOrder())}")
        check.close()
        print(
            f"  {name}: {before} -> {after} bytes "
            f"({before / 1024:.1f} -> {after / 1024:.1f} KiB, "
            f"-{(before - after) / 1024:.1f} KiB)"
        )
        total_before += before
        total_after += after

    print(
        f"\ntotal: {total_before / 1024:.1f} -> {total_after / 1024:.1f} KiB, "
        f"saved {(total_before - total_after) / 1024:.1f} KiB"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
