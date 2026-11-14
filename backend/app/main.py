from __future__ import annotations

import logging
import threading
import time

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .backup import auto_backup
from .config import APP_DISPLAY_NAME, APP_VERSION, FROZEN, FRONTEND_DIST, MEDIA_DIR, ensure_dirs
from .database import init_engine
from .license import license_manager
from .routers import categories, customers, dashboard, license, orders, products, stock, system

log = logging.getLogger(__name__)

# Rotas liberadas sem licença ativa
OPEN_API_PATHS = ("/api/license", "/api/system/ping", "/api/system/shutdown", "/api/system/info")


def _license_scheduler() -> None:
    """Verificação online da licença: tenta ao iniciar e a cada hora; só consulta
    a internet quando a última verificação bem-sucedida tem mais de 24h."""
    while True:
        try:
            license_manager.online_check()
        except Exception:
            log.exception("Erro na verificação online da licença")
        time.sleep(3600)


def create_app() -> FastAPI:
    ensure_dirs()
    init_engine()
    license_manager.refresh()
    threading.Thread(target=auto_backup, daemon=True).start()
    threading.Thread(target=_license_scheduler, daemon=True, name="license-check").start()

    app = FastAPI(
        title=APP_DISPLAY_NAME,
        version=APP_VERSION,
        docs_url=None if FROZEN else "/api/docs",
        redoc_url=None,
        openapi_url=None if FROZEN else "/api/openapi.json",
    )

    @app.middleware("http")
    async def license_guard(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") and not path.startswith(OPEN_API_PATHS):
            st = await run_in_threadpool(license_manager.current)
            if not st.valid:
                return JSONResponse({"detail": st.message, "license": st.status}, status_code=403)
        response = await call_next(request)
        # index.html sempre revalidado (após atualizar o .exe o navegador pega a versão nova);
        # arquivos de /assets têm hash no nome e podem ficar em cache.
        if path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif not path.startswith("/media/"):
            response.headers["Cache-Control"] = "no-cache"
        return response

    for r in (license, categories, products, stock, customers, orders, dashboard, system):
        app.include_router(r.router)

    app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

    if (FRONTEND_DIST / "index.html").exists():
        app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
    else:
        @app.get("/", include_in_schema=False)
        def no_frontend():
            return HTMLResponse(
                "<h2>Frontend não compilado.</h2><p>Rode <code>npm run build</code> em frontend/ "
                "ou use o servidor de desenvolvimento em http://localhost:5173</p>"
            )

    log.info("%s %s iniciado", APP_DISPLAY_NAME, APP_VERSION)
    return app
