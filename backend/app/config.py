"""Caminhos e constantes da aplicação.

Os dados do cliente ficam em %APPDATA%\\EstoqueConfeccao para que a troca do
executável (atualização) nunca apague banco, fotos ou licença.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "EstoqueConfeccao"
APP_DISPLAY_NAME = "Gestor de Estoque Confecção"
APP_VERSION = "1.0.0"

FROZEN = bool(getattr(sys, "frozen", False))


def _data_dir() -> Path:
    override = os.environ.get("ESTOQUE_DATA_DIR")
    if override:
        return Path(override)
    base = os.environ.get("APPDATA") or str(Path.home() / ".local" / "share")
    return Path(base) / APP_NAME


DATA_DIR = _data_dir()
DB_PATH = DATA_DIR / "estoque.db"
MEDIA_DIR = DATA_DIR / "media"
BACKUP_DIR = DATA_DIR / "backups"
LOG_DIR = DATA_DIR / "logs"
LICENSE_FILE = DATA_DIR / "license.dat"


def _frontend_dist() -> Path:
    if FROZEN:
        return Path(getattr(sys, "_MEIPASS")) / "frontend_dist"
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


FRONTEND_DIST = _frontend_dist()


def ensure_dirs() -> None:
    for d in (DATA_DIR, MEDIA_DIR, BACKUP_DIR, LOG_DIR):
        d.mkdir(parents=True, exist_ok=True)
