"""Caminhos do LicencasAdmin (somente no computador do fornecedor)."""
from __future__ import annotations

import json
import os
import sys
import threading
from pathlib import Path
from typing import Any

APP_NAME = "EstoqueLicencasAdmin"
APP_DISPLAY_NAME = "Licenças · Gestor de Estoque"
APP_VERSION = "1.0.0"
DEFAULT_PORT = 8765
FROZEN = bool(getattr(sys, "frozen", False))


def _data_dir() -> Path:
    override = os.environ.get("LICADMIN_DATA_DIR")
    if override:
        return Path(override)
    return Path(os.environ.get("APPDATA") or Path.home() / ".local" / "share") / APP_NAME


DATA_DIR = _data_dir()
PRIVATE_KEY = DATA_DIR / "private_key.pem"
DB_PATH = DATA_DIR / "licencas.db"
CONFIG_FILE = DATA_DIR / "config.json"
LOG_DIR = DATA_DIR / "logs"
PORT_FILE = DATA_DIR / "instance.port"

if FROZEN:
    FRONTEND_DIST = Path(getattr(sys, "_MEIPASS")) / "admin_dist"
    _EXE_DIR = Path(sys.executable).parent
    _LEGACY_KEY_DIRS = [_EXE_DIR / "keys", _EXE_DIR.parent / "keygen_admin" / "keys"]
    # se o .exe estiver em <projeto>\dist, já sugere a pasta do projeto
    DEFAULT_PROJECT_DIR = str(_EXE_DIR.parent) if (_EXE_DIR.parent / "backend" / "app" / "license").is_dir() else ""
else:
    _ROOT = Path(__file__).resolve().parents[2]
    FRONTEND_DIST = _ROOT / "frontend" / "dist-admin"
    _LEGACY_KEY_DIRS = [_ROOT / "keygen_admin" / "keys"]
    DEFAULT_PROJECT_DIR = str(_ROOT)

LEGACY_PRIVATE_KEYS = [d / "private_key.pem" for d in _LEGACY_KEY_DIRS]


def ensure_dirs() -> None:
    for d in (DATA_DIR, LOG_DIR):
        d.mkdir(parents=True, exist_ok=True)


_cfg_lock = threading.Lock()
DEFAULTS: dict[str, Any] = {
    "github_token_enc": "",
    "gist_id": "",
    "list_url": "",
    "seq": 0,
    "dirty": False,
    "last_published_at": None,
    "project_dir": DEFAULT_PROJECT_DIR,
}


def load_config() -> dict[str, Any]:
    with _cfg_lock:
        try:
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = {}
    return {**DEFAULTS, **data}


def save_config(cfg: dict[str, Any]) -> None:
    with _cfg_lock:
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = CONFIG_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(CONFIG_FILE)


def update_config(**changes: Any) -> dict[str, Any]:
    cfg = load_config()
    cfg.update(changes)
    save_config(cfg)
    return cfg
