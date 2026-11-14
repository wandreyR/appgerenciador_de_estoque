"""Ponto de entrada do executável.

Uso:
  GestorEstoque.exe               -> inicia o servidor e abre o navegador padrão
  GestorEstoque.exe --webview     -> abre em janela nativa (requer pywebview no build)
  GestorEstoque.exe --no-browser  -> só inicia o servidor
"""
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

# No modo janela (console=False) o PyInstaller deixa stdout/stderr = None,
# o que quebra o logging do uvicorn. Redireciona para devnull.
if sys.stdout is None or sys.stderr is None:
    _devnull = open(os.devnull, "w", encoding="utf-8")
    sys.stdout = sys.stdout or _devnull
    sys.stderr = sys.stderr or _devnull

from app.config import APP_DISPLAY_NAME, APP_NAME, DATA_DIR, FROZEN, LOG_DIR, ensure_dirs  # noqa: E402

HOST = "127.0.0.1"
DEFAULT_PORT = 8000
PORT_FILE = DATA_DIR / "instance.port"


def setup_logging() -> None:
    ensure_dirs()
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    fh = RotatingFileHandler(LOG_DIR / "app.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)
    if not FROZEN:
        sh = logging.StreamHandler()
        sh.setFormatter(fmt)
        root.addHandler(sh)


def port_free(port: int) -> bool:
    # 1) Alguém já atende nessa porta? (no Windows um bind em 127.0.0.1 pode
    #    "funcionar" mesmo com outro programa escutando em 0.0.0.0)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        if s.connect_ex((HOST, port)) == 0:
            return False
    # 2) Bind exclusivo para confirmar
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            s.bind((HOST, port))
            return True
        except OSError:
            return False


def is_our_instance(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/api/system/ping", timeout=2) as r:
            return json.loads(r.read()).get("app") == APP_NAME
    except Exception:
        return False


def wait_started(server, timeout: float = 30) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if server.started:
            return True
        time.sleep(0.1)
    return False


def main() -> None:
    setup_logging()
    log = logging.getLogger("launcher")
    args = sys.argv[1:]

    # Instância única: se o sistema já está rodando, apenas abre o navegador.
    try:
        last_port = int(PORT_FILE.read_text().strip())
    except (OSError, ValueError):
        last_port = DEFAULT_PORT
    for p in dict.fromkeys((last_port, DEFAULT_PORT)):
        if is_our_instance(p):
            log.info("Sistema já está aberto na porta %s; abrindo o navegador.", p)
            webbrowser.open(f"http://{HOST}:{p}/")
            return

    port = next((p for p in range(DEFAULT_PORT, DEFAULT_PORT + 100) if port_free(p)), 0)
    if not port:
        log.error("Nenhuma porta livre entre 8000 e 8100.")
        return
    PORT_FILE.write_text(str(port))

    import uvicorn

    from app.main import create_app

    app = create_app()
    server = uvicorn.Server(uvicorn.Config(app, host=HOST, port=port, log_config=None, access_log=False))
    app.state.server = server
    url = f"http://{HOST}:{port}/"

    use_webview = "--webview" in args
    if use_webview:
        try:
            import webview  # type: ignore
        except ImportError:
            log.warning("pywebview não instalado; usando o navegador padrão.")
            use_webview = False

    if use_webview:
        t = threading.Thread(target=server.run, daemon=True)
        t.start()
        wait_started(server)
        webview.create_window(APP_DISPLAY_NAME, url, width=1440, height=900, min_size=(1100, 700))
        webview.start()
        server.should_exit = True
        t.join(timeout=5)
        return

    if "--no-browser" not in args:
        threading.Thread(target=lambda: wait_started(server) and webbrowser.open(url), daemon=True).start()
    log.info("Servidor em %s", url)
    server.run()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logging.getLogger("launcher").exception("Falha fatal")
        raise
