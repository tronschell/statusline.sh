"""
Build the macOS / Linux / Windows OS-tab icons used by InstallDrawer.

Pipeline per source SVG:
  1. Rasterize to a high-resolution RGBA PNG with cairosvg.
  2. Reduce to a single foreground color (white) on a transparent background by
     using the alpha channel as the shape mask. This makes the icons true B&W
     and matches the dark UI theme (#E8E8E6 text).
  3. Auto-trim fully transparent margins so each glyph hugs its bounding box.
  4. Fit-and-center into a fixed square canvas so every icon is the exact
     same size and dimensions.
  5. Save as a WebP with alpha, lossless + max compression effort.

Source images are SVGs from Wikimedia Commons. Flaticon's "mac-os-logo_2235"
page returns 403 to scripted clients (browser fingerprinting), so we use the
canonical Apple silhouette from Wikimedia Commons instead — it's the same
glyph and goes through identical processing.

Run with: python scripts/build-os-icons.py
"""

from __future__ import annotations

import io
import urllib.request
from pathlib import Path

import resvg_py
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "scripts" / "icon-sources"
OUT_DIR = ROOT / "src" / "frontend" / "components" / "Install" / "icons"

# Final on-disk dimensions for each WebP. 128px gives crisp 2x/3x rendering at
# the ~20-28px the install drawer tabs will display them.
CANVAS = 128
# Leave a tiny breathing-room margin inside the square so glyphs aren't flush
# against the edge when packed next to text in the tab.
PADDING = 4

USER_AGENT = (
    "Mozilla/5.0 (statusline-maker icon build script; contact via repo)"
)

SOURCES = [
    (
        "macos",
        "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
    ),
    (
        "linux",
        "https://upload.wikimedia.org/wikipedia/commons/f/f1/Icons8_flat_linux.svg",
    ),
    (
        "windows",
        "https://upload.wikimedia.org/wikipedia/commons/5/5f/Windows_logo_-_2012.svg",
    ),
]


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  cached {dest.name}")
        return
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        dest.write_bytes(r.read())
    print(f"  downloaded {dest.name} ({dest.stat().st_size} bytes)")


def rasterize(svg_path: Path, target_px: int) -> Image.Image:
    # Rasterize at 4x the canvas so we have plenty of resolution for trim+resample.
    # resvg_py returns a list[int] of raw PNG bytes.
    side = target_px * 4
    raw = resvg_py.svg_to_bytes(
        svg_path=str(svg_path),
        width=side,
        height=side,
    )
    img = Image.open(io.BytesIO(bytes(raw))).convert("RGBA")
    return img


def to_monochrome(img: Image.Image) -> Image.Image:
    """Use the alpha channel as the shape; recolor everything opaque to white."""
    alpha = img.split()[-1]
    # Anything that's even slightly visible becomes a hard mask — kills
    # mid-tone color fringing from the source SVG's anti-aliased fills.
    mask = alpha.point(lambda v: 255 if v > 10 else 0)
    white = Image.new("RGBA", img.size, (255, 255, 255, 0))
    white.putalpha(alpha)  # keep original alpha gradient for smooth edges
    # Replace RGB with pure white wherever there was any visible pixel.
    rgb_white = Image.new("RGB", img.size, (255, 255, 255))
    out = Image.composite(
        Image.merge("RGBA", (*rgb_white.split(), alpha)),
        Image.new("RGBA", img.size, (0, 0, 0, 0)),
        mask,
    )
    return out


def trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.split()[-1].getbbox()
    if bbox is None:
        return img
    return img.crop(bbox)


def fit_square(img: Image.Image, canvas: int, padding: int) -> Image.Image:
    inner = canvas - padding * 2
    w, h = img.size
    scale = min(inner / w, inner / h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(
        resized,
        ((canvas - new_w) // 2, (canvas - new_h) // 2),
        resized,
    )
    return out


def process(name: str, svg_path: Path) -> Path:
    raster = rasterize(svg_path, CANVAS)
    mono = to_monochrome(raster)
    trimmed = trim_alpha(mono)
    framed = fit_square(trimmed, CANVAS, PADDING)
    out_path = OUT_DIR / f"{name}.webp"
    framed.save(out_path, format="WEBP", lossless=True, quality=100, method=6)
    print(f"  wrote {out_path.relative_to(ROOT)} ({out_path.stat().st_size} bytes)")
    return out_path


def main() -> None:
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Downloading sources...")
    for name, url in SOURCES:
        download(url, SRC_DIR / f"{name}.svg")
    print("Processing icons...")
    for name, _ in SOURCES:
        process(name, SRC_DIR / f"{name}.svg")
    print("Done.")


if __name__ == "__main__":
    main()
