from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import crypto, db, publisher
from .config import APP_DISPLAY_NAME, APP_NAME, APP_VERSION, DATA_DIR, FRONTEND_DIST, ensure_dirs, load_config, update_config
from .crypto import CryptoError
from .publisher import PublishError

log = logging.getLogger(__name__)


class LicenseIn(BaseModel):
    hwid: str = Field(min_length=10, max_length=40)
    customer: str = Field(min_length=1, max_length=160)
    mode: Literal["dias", "data", "vitalicia"]
    days: int | None = Field(default=None, ge=1, le=36500)
    date: str | None = None
    notes: str | None = Field(default=None, max_length=1000)


class NotesIn(BaseModel):
    notes: str | None = Field(default=None, max_length=1000)


class KeyIn(BaseModel):
    key: str = Field(min_length=10, max_length=4000)


class SettingsIn(BaseModel):
    github_token: str | None = None  # None = não altera; "" = apaga
    gist_id: str | None = None
    list_url: str | None = None
    project_dir: str | None = None


class ConfirmIn(BaseModel):
    confirm: str


def _status() -> dict:
    cfg = load_config()
    has_key = crypto.has_private()
    return {
        "app_name": APP_DISPLAY_NAME,
        "version": APP_VERSION,
        "data_dir": str(DATA_DIR),
        "has_private_key": has_key,
        "public_key": crypto.public_b64() if has_key else None,
        "has_token": bool(cfg["github_token_enc"]),
        "gist_id": cfg["gist_id"],
        "list_url": cfg["list_url"],
        "seq": cfg["seq"],
        "dirty": cfg["dirty"],
        "last_published_at": cfg["last_published_at"],
        "project_dir": cfg["project_dir"],
        "counts": db.counts(),
    }


def _publish() -> dict:
    """Assina a lista de licenças excluídas e publica no Gist configurado."""
    cfg = load_config()
    token = crypto.unprotect(cfg["github_token_enc"])
    if not token:
        raise PublishError("Configure o token do GitHub na aba 'Publicação online'.")
    seq = int(cfg["seq"]) + 1
    content = crypto.sign_revocation_list(seq, db.revoked_ids())
    if cfg["gist_id"]:
        url = publisher.update_gist(token, cfg["gist_id"], content)
        changes = {}
    else:
        gist_id, url = publisher.create_gist(token, content)
        changes = {"gist_id": gist_id}
    if not cfg["list_url"] or changes:
        changes["list_url"] = url
    update_config(seq=seq, dirty=False, last_published_at=datetime.now().replace(microsecond=0).isoformat(), **changes)
    log.info("Lista publicada (seq %s)", seq)
    return _status()


def _after_change() -> dict:
    """Marca a lista como pendente e tenta publicar automaticamente."""
    update_config(dirty=True)
    cfg = load_config()
    result = {"published": False, "publish_error": None}
    if cfg["github_token_enc"]:
        try:
            _publish()
            result["published"] = True
        except (PublishError, CryptoError) as e:
            result["publish_error"] = str(e)
    return result


def create_app() -> FastAPI:
    ensure_dirs()
    db.init()
    if crypto.migrate_legacy_key():
        log.info("Chave privada importada do keygen antigo.")

    app = FastAPI(title=APP_DISPLAY_NAME, docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(CryptoError)
    async def _crypto_err(_req, exc: CryptoError):
        from fastapi.responses import JSONResponse

        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.exception_handler(PublishError)
    async def _pub_err(_req, exc: PublishError):
        from fastapi.responses import JSONResponse

        return JSONResponse({"detail": str(exc)}, status_code=502)

    @app.middleware("http")
    async def no_cache(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable" if path.startswith("/assets/") else "no-cache"
        return response

    # ---------------- sistema ----------------
    @app.get("/api/ping")
    def ping():
        return {"app": APP_NAME, "version": APP_VERSION}

    @app.get("/api/status")
    def status():
        return _status()

    @app.post("/api/shutdown")
    def shutdown(request: Request):
        server = getattr(request.app.state, "server", None)
        if server is None:
            raise HTTPException(400, "Disponível apenas no executável.")
        server.should_exit = True
        return {"ok": True}

    # ---------------- licenças ----------------
    @app.get("/api/licenses")
    def list_licenses(q: str | None = None, situation: str | None = None):
        items = db.search(q)
        if situation:
            items = [i for i in items if i["situation"] == situation]
        return items

    @app.post("/api/licenses", status_code=201)
    def create_license(data: LicenseIn):
        if data.mode == "vitalicia":
            exp = None
        elif data.mode == "dias":
            if not data.days:
                raise HTTPException(400, "Informe a quantidade de dias.")
            exp = date.today() + timedelta(days=data.days)
        else:
            try:
                exp = date.fromisoformat(data.date or "")
            except ValueError:
                raise HTTPException(400, "Data de validade inválida.")
            if exp < date.today():
                raise HTTPException(400, "A data de validade já passou.")
        key, payload, lid = crypto.make_license(data.hwid, data.customer, exp)
        if db.get(lid):  # mesma licença emitida no mesmo dia: retorna a existente
            return db.get(lid)
        return db.insert(lid, payload["c"], crypto.format_hwid(data.hwid), payload["i"], payload["e"], key, (data.notes or "").strip() or None)

    @app.put("/api/licenses/{lid}/notes")
    def set_notes(lid: str, data: NotesIn):
        lic = db.update_notes(lid, (data.notes or "").strip() or None)
        if not lic:
            raise HTTPException(404, "Licença não encontrada.")
        return lic

    @app.delete("/api/licenses/{lid}")
    def delete_license(lid: str):
        if not db.get(lid):
            raise HTTPException(404, "Licença não encontrada.")
        lic = db.set_status(lid, "excluida")
        return {"license": lic, **_after_change()}

    @app.post("/api/licenses/{lid}/restore")
    def restore_license(lid: str):
        if not db.get(lid):
            raise HTTPException(404, "Licença não encontrada.")
        lic = db.set_status(lid, "ativa")
        return {"license": lic, **_after_change()}

    @app.post("/api/licenses/inspect")
    def inspect(data: KeyIn):
        info = crypto.inspect_license(data.key)
        info["record"] = db.get(info["id"])
        return info

    # ---------------- publicação ----------------
    @app.put("/api/settings")
    def put_settings(data: SettingsIn):
        changes = {}
        if data.github_token is not None:
            changes["github_token_enc"] = crypto.protect(data.github_token.strip())
        if data.gist_id is not None:
            changes["gist_id"] = data.gist_id.strip()
        if data.list_url is not None:
            changes["list_url"] = data.list_url.strip()
        if data.project_dir is not None:
            changes["project_dir"] = data.project_dir.strip()
        update_config(**changes)
        return _status()

    @app.post("/api/publish")
    def publish():
        return _publish()

    @app.get("/api/publish/file")
    def export_list():
        cfg = load_config()
        seq = int(cfg["seq"]) + 1
        content = crypto.sign_revocation_list(seq, db.revoked_ids())
        update_config(seq=seq, dirty=False, last_published_at=datetime.now().replace(microsecond=0).isoformat())
        return Response(content, media_type="application/json", headers={"Content-Disposition": 'attachment; filename="licencas.json"'})

    @app.post("/api/publish/test")
    def test_url():
        cfg = load_config()
        if not cfg["list_url"]:
            raise HTTPException(400, "Nenhuma URL configurada.")
        text = publisher.fetch_url(cfg["list_url"])
        try:
            data = crypto.verify_revocation_list(text)
        except Exception:
            raise HTTPException(400, "O arquivo no endereço não é uma lista assinada por esta chave.")
        return {
            "ok": True,
            "seq": data.get("seq"),
            "expected_seq": cfg["seq"],
            "revoked": len(data.get("revoked", [])),
            "issued_at": data.get("issued_at"),
        }

    # ---------------- chaves e cliente ----------------
    @app.post("/api/keys/generate")
    def generate_keys(data: ConfirmIn):
        if crypto.has_private() and data.confirm != "GERAR NOVA CHAVE":
            raise HTTPException(400, "Digite GERAR NOVA CHAVE para confirmar.")
        crypto.generate_keypair()
        return _status()

    @app.post("/api/keys/import")
    def import_key(file: UploadFile = File(...)):
        crypto.import_private(file.file.read(10_000))
        return _status()

    @app.get("/api/keys/private")
    def download_private():
        return Response(
            crypto.private_pem(),
            media_type="application/x-pem-file",
            headers={"Content-Disposition": 'attachment; filename="private_key_LICENCAS_GUARDAR_EM_SEGURANCA.pem"'},
        )

    @app.get("/api/client-config")
    def client_config():
        cfg = load_config()
        return {"content": _client_config_text(crypto.public_b64(), cfg["list_url"])}

    @app.post("/api/client-config/write")
    def write_client_config():
        cfg = load_config()
        if not cfg["project_dir"]:
            raise HTTPException(400, "Informe a pasta do projeto do sistema.")
        target = Path(cfg["project_dir"]) / "backend" / "app" / "license" / "public_key.py"
        if not target.parent.is_dir():
            raise HTTPException(400, f"Pasta não encontrada: {target.parent}")
        target.write_text(_client_config_text(crypto.public_b64(), cfg["list_url"]), encoding="utf-8")
        return {"ok": True, "path": str(target)}

    if (FRONTEND_DIST / "index.html").exists():
        app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
    else:
        @app.get("/", include_in_schema=False)
        def no_frontend():
            return HTMLResponse("<h2>Frontend do admin não compilado.</h2><p>Rode <code>npm run build:admin</code> em frontend/.</p>")

    return app


def _client_config_text(public_key: str, list_url: str) -> str:
    return (
        "# Configuração de licença embutida no executável do cliente.\n"
        "# Gerado pelo LicencasAdmin (aba \"Chaves e cliente\" > \"Gravar no projeto\").\n"
        "# A chave PRIVADA fica somente no computador do administrador.\n"
        f'PUBLIC_KEY_B64 = "{public_key}"\n'
        "# Endereço da lista de licenças canceladas (verificação diária). Vazio = sem verificação online.\n"
        f'LICENSE_LIST_URL = "{list_url}"\n'
    )
