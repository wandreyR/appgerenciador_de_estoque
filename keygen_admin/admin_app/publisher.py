"""Publicação da lista assinada em um GitHub Gist privado (secreto).

O Gist "secreto" não aparece em buscas, mas quem tem o link consegue ler —
por isso a lista contém apenas IDs de licenças canceladas (sem nomes) e é
assinada: ninguém consegue alterá-la sem a chave privada.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

API = os.environ.get("LICADMIN_GITHUB_API", "https://api.github.com")
FILE_NAME = "licencas.json"


class PublishError(Exception):
    pass


def _request(method: str, path: str, token: str, body: dict | None = None) -> dict[str, Any]:
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "LicencasAdmin",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise PublishError("Token do GitHub inválido ou expirado.")
        if e.code in (403, 404):
            raise PublishError("Sem permissão: o token precisa do escopo 'gist' e o Gist precisa ser da mesma conta.")
        raise PublishError(f"GitHub respondeu erro {e.code}.")
    except urllib.error.URLError as e:
        raise PublishError(f"Sem conexão com o GitHub ({e.reason}).")


def raw_url(owner: str, gist_id: str) -> str:
    return f"https://gist.githubusercontent.com/{owner}/{gist_id}/raw/{FILE_NAME}"


def create_gist(token: str, content: str) -> tuple[str, str]:
    r = _request(
        "POST",
        "/gists",
        token,
        {"description": "Gestor de Estoque - lista de licenças", "public": False, "files": {FILE_NAME: {"content": content}}},
    )
    return r["id"], raw_url(r["owner"]["login"], r["id"])


def update_gist(token: str, gist_id: str, content: str) -> str:
    r = _request("PATCH", f"/gists/{gist_id}", token, {"files": {FILE_NAME: {"content": content}}})
    return raw_url(r["owner"]["login"], r["id"])


def fetch_url(url: str) -> str:
    sep = "&" if "?" in url else "?"
    import time

    req = urllib.request.Request(f"{url}{sep}t={int(time.time())}", headers={"User-Agent": "LicencasAdmin", "Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read(2_000_000).decode()
    except urllib.error.URLError as e:
        raise PublishError(f"Não foi possível baixar a lista ({getattr(e, 'reason', e)}).")
