from __future__ import annotations

import re
import unicodedata

SIZE_ORDER = ["RN", "PP", "P", "M", "G", "GG", "XG", "XGG", "EG", "EGG", "G1", "G2", "G3", "G4", "G5", "U", "UNICO"]


def size_key(size: str) -> tuple:
    s = size.strip().upper()
    if s in SIZE_ORDER:
        return (0, SIZE_ORDER.index(s), "")
    try:
        return (1, float(s.replace(",", ".")), "")
    except ValueError:
        return (2, 0, s)


def unaccent(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def color_code(name: str) -> str:
    """'Azul Marinho' -> 'AZM', 'Preto' -> 'PRE'."""
    words = [w for w in re.split(r"[^A-Za-z0-9]+", unaccent(name).upper()) if w]
    if not words:
        return "COR"
    if len(words) == 1:
        return words[0][:3]
    return (words[0][:2] + "".join(w[0] for w in words[1:]))[:4]


def variant_sku(sku_base: str, color_name: str, size: str) -> str:
    return f"{sku_base}-{color_code(color_name)}-{size}".upper()


def clean_str(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None
