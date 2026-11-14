"""Backup (.zip com estoque.db + media/) e restauração."""
from __future__ import annotations

import json
import logging
import shutil
import sqlite3
import threading
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

from .config import APP_NAME, APP_VERSION, BACKUP_DIR, DB_PATH, MEDIA_DIR
from .database import dispose_engine, init_engine

log = logging.getLogger(__name__)
restore_lock = threading.Lock()
REQUIRED_TABLES = {"products", "variants", "orders", "categories"}
AUTO_KEEP = 10


def create_backup_zip(dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_db = dest.parent / f"_tmp_{uuid.uuid4().hex}.db"
    try:
        src = sqlite3.connect(DB_PATH)
        dst = sqlite3.connect(tmp_db)
        with dst:
            src.backup(dst)  # cópia consistente mesmo com o sistema em uso
        dst.close()
        src.close()
        with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(tmp_db, "estoque.db")
            if MEDIA_DIR.exists():
                for f in MEDIA_DIR.rglob("*"):
                    if f.is_file():
                        z.write(f, "media/" + f.relative_to(MEDIA_DIR).as_posix(), compress_type=zipfile.ZIP_STORED)
            z.writestr(
                "manifest.json",
                json.dumps({"app": APP_NAME, "version": APP_VERSION, "created_at": datetime.now().isoformat()}, indent=2),
            )
    finally:
        tmp_db.unlink(missing_ok=True)
    return dest


def backup_filename(prefix: str = "backup_estoque") -> str:
    return f"{prefix}_{datetime.now():%Y%m%d_%H%M%S}.zip"


def auto_backup() -> None:
    """Um backup automático por dia em %APPDATA%/EstoqueConfeccao/backups (mantém os 10 últimos)."""
    try:
        if not DB_PATH.exists():
            return
        today = datetime.now().strftime("%Y%m%d")
        if any(BACKUP_DIR.glob(f"auto_{today}_*.zip")):
            return
        create_backup_zip(BACKUP_DIR / backup_filename("auto"))
        autos = sorted(BACKUP_DIR.glob("auto_*.zip"))
        for old in autos[:-AUTO_KEEP]:
            old.unlink(missing_ok=True)
    except Exception:
        log.exception("Falha no backup automático")


class RestoreError(Exception):
    pass


def _validate_db(path: Path) -> None:
    try:
        con = sqlite3.connect(path)
        try:
            ok = con.execute("PRAGMA integrity_check").fetchone()[0]
            tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        finally:
            con.close()
    except sqlite3.DatabaseError as e:
        raise RestoreError(f"Banco de dados do backup está corrompido: {e}")
    if ok != "ok":
        raise RestoreError("Banco de dados do backup falhou na verificação de integridade.")
    if not REQUIRED_TABLES <= tables:
        raise RestoreError("O arquivo não parece ser um backup deste sistema.")


def restore_backup_zip(zip_path: Path) -> Path:
    """Restaura o backup. Antes, salva o estado atual em backups/pre_restauracao_*.zip."""
    if not zipfile.is_zipfile(zip_path):
        raise RestoreError("Arquivo inválido: envie o .zip gerado pelo botão de backup.")
    work = BACKUP_DIR / f"_restore_{uuid.uuid4().hex}"
    work.mkdir(parents=True)
    try:
        with zipfile.ZipFile(zip_path) as z:
            names = z.namelist()
            if "estoque.db" not in names:
                raise RestoreError("O backup não contém o arquivo estoque.db.")
            new_db = work / "estoque.db"
            with z.open("estoque.db") as fsrc, open(new_db, "wb") as fdst:
                shutil.copyfileobj(fsrc, fdst)
            _validate_db(new_db)

            safety = create_backup_zip(BACKUP_DIR / backup_filename("pre_restauracao"))

            with restore_lock:
                dispose_engine()
                try:
                    for suffix in ("-wal", "-shm", ""):
                        Path(str(DB_PATH) + suffix).unlink(missing_ok=True)
                    shutil.move(str(new_db), DB_PATH)

                    media_root = MEDIA_DIR.resolve()
                    shutil.rmtree(MEDIA_DIR, ignore_errors=True)
                    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
                    for info in z.infolist():
                        if info.is_dir() or not info.filename.startswith("media/"):
                            continue
                        target = (MEDIA_DIR / info.filename[len("media/"):]).resolve()
                        if media_root not in target.parents:  # proteção contra path traversal
                            continue
                        target.parent.mkdir(parents=True, exist_ok=True)
                        with z.open(info) as fsrc, open(target, "wb") as fdst:
                            shutil.copyfileobj(fsrc, fdst)
                finally:
                    init_engine()
            return safety
    finally:
        shutil.rmtree(work, ignore_errors=True)
