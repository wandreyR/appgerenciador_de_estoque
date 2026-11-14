"""Ponto de entrada do LicencasAdmin.exe (uso exclusivo do fornecedor)."""
from __future__ import annotations

import json
import logging
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from logging.handlers import RotatingFileHandler

if sys.stdout is None or sys.stderr is None:
    _devnull = open(os.devnull, "w", encoding="utf-8")
    sys.stdout = sys.stdout or _devnull
    sys.stderr = sys.stderr or _devnull

from admin_app.config import APP_NAME, DEFAULT_PORT, FROZEN, LOG_DIR, PORT_FILE, ensure_dirs  # noqa: E402

HOST = "127.0.0.1"


def setup_logging() -> None:
    ensure_dirs()
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    fh = RotatingFileHandler(LOG_DIR / "admin.log", maxBytes=1_000_000, backupCount=2, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    root.addHandler(fh)
    if not FROZEN:
        root.addHandler(logging.StreamHandler())


def port_free(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        if s.connect_ex((HOST, port)) == 0:
            return False
    with socket.socket() as s:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            s.bind((HOST, port))
            return True
        except OSError:
            return False


def is_ours(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/api/ping", timeout=2) as r:
            return json.loads(r.read()).get("app") == APP_NAME
    except Exception:
        return False


def main() -> None:
    setup_logging()
    log = logging.getLogger("launcher")
    try:
        last = int(PORT_FILE.read_text().strip())
    except (OSError, ValueError):
        last = DEFAULT_PORT
    for p in dict.fromkeys((last, DEFAULT_PORT)):
        if is_ours(p):
            webbrowser.open(f"http://{HOST}:{p}/")
            return
    port = next((p for p in range(DEFAULT_PORT, DEFAULT_PORT + 50) if port_free(p)), 0)
    if not port:
        log.error("Nenhuma porta livre.")
        return
    PORT_FILE.write_text(str(port))

    import uvicorn

    from admin_app.main import create_app

    app = create_app()
    server = uvicorn.Server(uvicorn.Config(app, host=HOST, port=port, log_config=None, access_log=False))
    app.state.server = server
    url = f"http://{HOST}:{port}/"

    def open_browser() -> None:
        for _ in range(300):
            if server.started:
                webbrowser.open(url)
                return
            time.sleep(0.1)

    if "--no-browser" not in sys.argv:
        threading.Thread(target=open_browser, daemon=True).start()
    log.info("LicencasAdmin em %s", url)
    server.run()


if __name__ == "__main__":
    main()
