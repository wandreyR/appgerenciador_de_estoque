"""Otimização e armazenamento de imagens em %APPDATA%/EstoqueConfeccao/media.

Cada upload gera:
  <pasta>/<id>.jpg     -> até 1400px, usado na impressão do romaneio (nítido)
  <pasta>/<id>_t.jpg   -> miniatura 400px, usada nas listas da interface
"""
from __future__ import annotations

import io
import uuid
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import MEDIA_DIR

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_SIDE = 1400
THUMB_SIDE = 400
Image.MAX_IMAGE_PIXELS = 80_000_000


def thumb_rel(rel: str) -> str:
    p = Path(rel)
    return (p.parent / f"{p.stem}_t{p.suffix}").as_posix()


def _to_rgb(img: Image.Image) -> Image.Image:
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        return bg
    return img.convert("RGB")


def save_image(data: bytes, folder: str) -> str:
    if not data:
        raise HTTPException(400, "Arquivo de imagem vazio.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Imagem muito grande (máximo 20 MB).")
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        img = _to_rgb(img)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "Arquivo enviado não é uma imagem válida (use JPG, PNG ou WEBP).")

    name = uuid.uuid4().hex
    rel = f"{folder}/{name}.jpg"
    target = MEDIA_DIR / rel
    target.parent.mkdir(parents=True, exist_ok=True)

    full = img.copy()
    full.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    full.save(target, "JPEG", quality=88, optimize=True, progressive=True)

    thumb = img.copy()
    thumb.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.Resampling.LANCZOS)
    thumb.save(MEDIA_DIR / thumb_rel(rel), "JPEG", quality=84, optimize=True)
    return rel


def release_image(db: Session, rel: str | None) -> None:
    """Apaga o arquivo se nenhum pedido antigo ainda usa a foto no romaneio."""
    if not rel:
        return
    from .models import OrderItem, Product, ProductColor

    refs = (
        db.scalar(select(func.count()).select_from(OrderItem).where(OrderItem.image_path == rel))
        + db.scalar(select(func.count()).select_from(Product).where(Product.image_path == rel))
        + db.scalar(select(func.count()).select_from(ProductColor).where(ProductColor.image_path == rel))
    )
    if refs:
        return
    for p in (MEDIA_DIR / rel, MEDIA_DIR / thumb_rel(rel)):
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass
