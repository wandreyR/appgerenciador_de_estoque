"""Gera assets/icon.ico (sistema: cabide) e assets/icon_admin.ico (admin: chave)."""
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parents[1] / "assets"
NAVY = (19, 35, 56, 255)
AMBER = (255, 176, 32, 255)
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def base(size: int) -> tuple[Image.Image, ImageDraw.ImageDraw, float]:
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=NAVY)
    return im, d, size / 64


def hanger(size: int = 256) -> Image.Image:
    im, d, s = base(size)
    w = max(2, int(3.2 * s))
    d.arc((25 * s, 12 * s, 39 * s, 26 * s), start=180, end=90, fill=AMBER, width=w)
    d.line((32 * s, 26 * s, 32 * s, 30 * s), fill=AMBER, width=w)
    d.polygon([(32 * s, 29 * s), (54 * s, 46 * s), (10 * s, 46 * s)], fill=AMBER)
    d.polygon([(32 * s, 34 * s), (44 * s, 43 * s), (20 * s, 43 * s)], fill=NAVY)
    return im


def key(size: int = 256) -> Image.Image:
    im, d, s = base(size)
    d.ellipse((10 * s, 20 * s, 34 * s, 44 * s), fill=AMBER)
    d.ellipse((17 * s, 27 * s, 27 * s, 37 * s), fill=NAVY)
    d.rectangle((32 * s, 29 * s, 54 * s, 35 * s), fill=AMBER)
    d.rectangle((44 * s, 35 * s, 49 * s, 42 * s), fill=AMBER)
    d.rectangle((50 * s, 35 * s, 54 * s, 40 * s), fill=AMBER)
    return im


if __name__ == "__main__":
    ASSETS.mkdir(parents=True, exist_ok=True)
    hanger().save(ASSETS / "icon.ico", sizes=SIZES)
    key().save(ASSETS / "icon_admin.ico", sizes=SIZES)
    print(f"Ícones gerados em {ASSETS}")
