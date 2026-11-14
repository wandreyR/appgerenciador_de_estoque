from __future__ import annotations

import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from ..backup import RestoreError, backup_filename, create_backup_zip, restore_backup_zip
from ..config import APP_DISPLAY_NAME, APP_NAME, APP_VERSION, BACKUP_DIR, DATA_DIR
from ..database import get_db
from ..license import license_manager
from ..models import Setting

router = APIRouter(prefix="/api", tags=["sistema"])

SETTING_KEYS = (
    "company_name",
    "company_document",
    "company_phone",
    "company_address",
    "company_city",
    "print_footer",
)


class SettingsIn(BaseModel):
    company_name: str = ""
    company_document: str = ""
    company_phone: str = ""
    company_address: str = ""
    company_city: str = ""
    print_footer: str = ""


@router.get("/system/ping")
def ping():
    return {"app": APP_NAME, "version": APP_VERSION}


@router.get("/system/info")
def info():
    return {
        "app_name": APP_DISPLAY_NAME,
        "version": APP_VERSION,
        "data_dir": str(DATA_DIR),
        "backup_dir": str(BACKUP_DIR),
    }


@router.post("/system/shutdown")
def shutdown(request: Request):
    server = getattr(request.app.state, "server", None)
    if server is None:
        raise HTTPException(400, "Encerramento disponível apenas no executável.")
    server.should_exit = True
    return {"ok": True}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    rows = {s.key: s.value for s in db.scalars(select(Setting).where(Setting.key.in_(SETTING_KEYS)))}
    return {k: rows.get(k, "") for k in SETTING_KEYS}


@router.put("/settings")
def put_settings(data: SettingsIn, db: Session = Depends(get_db)):
    for k, v in data.model_dump().items():
        s = db.get(Setting, k) or Setting(key=k)
        s.value = (v or "").strip()
        db.add(s)
    db.commit()
    return get_settings(db)


@router.get("/backup")
def download_backup():
    path = Path(tempfile.gettempdir()) / f"estoque_{uuid.uuid4().hex}.zip"
    create_backup_zip(path)
    return FileResponse(
        path,
        media_type="application/zip",
        filename=backup_filename(),
        background=BackgroundTask(lambda: os.path.exists(path) and os.remove(path)),
    )


@router.post("/backup/restore")
def restore_backup(file: UploadFile = File(...)):
    tmp = Path(tempfile.gettempdir()) / f"restore_{uuid.uuid4().hex}.zip"
    try:
        with open(tmp, "wb") as f:
            shutil.copyfileobj(file.file, f)
        safety = restore_backup_zip(tmp)
    except RestoreError as e:
        raise HTTPException(400, str(e))
    except PermissionError:
        raise HTTPException(409, "O banco está em uso. Feche outras abas do sistema e tente novamente.")
    finally:
        tmp.unlink(missing_ok=True)
    license_manager.refresh()  # regrava âncora de data no banco restaurado
    return {"ok": True, "safety_backup": str(safety)}
